import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    BatchWriteCommand,
    QueryCommand,
    QueryCommandOutput, // <--- IMPORTANTE: Agregar esto
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

// --- CONFIGURACIÓN ---
const TABLE_NAME = process.env.TABLE_NAME || 'CommerceData-dev';
const COMMERCE_ID = 'gs';
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

// --- UTILIDADES ---
const chunkArray = <T>(arr: T[], size: number): T[][] =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size)
    );

// --- FUNCIONES ---

/**
 * 1. Limpiar cierres existentes
 */
const cleanExistingClosures = async () => {
    console.log('🧹 Limpiando cierres de caja antiguos...');
    let itemsToDelete: any[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined; // Tipado explícito para evitar error

    do {
        const command = new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
                ':pk': `COM#${COMMERCE_ID}`,
                ':sk': 'CLOSE#',
            },
            ExclusiveStartKey: lastEvaluatedKey,
        });

        // CORRECCIÓN AQUÍ: Castear la respuesta
        const response = (await docClient.send(command)) as QueryCommandOutput;

        if (response.Items) itemsToDelete.push(...response.Items);
        lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    if (itemsToDelete.length > 0) {
        const batches = chunkArray(itemsToDelete, 25);
        for (const batch of batches) {
            const deleteRequests = batch.map((item) => ({
                DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
            }));
            await docClient.send(
                new BatchWriteCommand({ RequestItems: { [TABLE_NAME]: deleteRequests } })
            );
        }
        console.log(`🗑️ Se eliminaron ${itemsToDelete.length} cierres anteriores.`);
    }
};

/**
 * 2. Obtener todas las ventas del comercio
 */
const fetchAllSales = async () => {
    console.log('📥 Obteniendo historial de ventas...');
    let allSales: any[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;

    do {
        const command = new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues: {
                ':pk': `COM#${COMMERCE_ID}`,
                ':sk': 'SALE#',
            },
            ExclusiveStartKey: lastEvaluatedKey,
        });

        // CORRECCIÓN AQUÍ: Castear la respuesta
        const response = (await docClient.send(command)) as QueryCommandOutput;

        if (response.Items) allSales.push(...response.Items);
        lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`📊 Se encontraron ${allSales.length} ventas totales.`);
    return allSales;
};

/**
 * 3. Lógica principal de generación
 */
const seedClosures = async () => {
    try {
        await cleanExistingClosures();
        const sales = await fetchAllSales();

        if (sales.length === 0) {
            console.log('⚠️ No hay ventas. Ejecuta primero seedSales.ts');
            return;
        }

        // A. Agrupar ventas por día (YYYY-MM-DD)
        const salesByDay: Record<string, any[]> = {};
        sales.forEach((sale) => {
            // Asumimos que createdAt es ISO string. Tomamos la parte de fecha.
            const day = sale.createdAt.split('T')[0];
            if (!salesByDay[day]) {
                salesByDay[day] = [];
            }
            salesByDay[day].push(sale);
        });

        // B. Obtener lista de días ordenados
        const sortedDays = Object.keys(salesByDay).sort();

        // C. Eliminar el ÚLTIMO día (para dejarlo abierto)
        const lastDay = sortedDays.pop();
        console.log(`📅 Se omitirá el cierre del día ${lastDay} (quedará abierto).`);

        const closuresToWrite: any[] = [];

        // D. Generar cierre para cada día restante
        for (const day of sortedDays) {
            const daySales = salesByDay[day];
            const closureId = randomUUID();

            const openedAt = `${day}T09:00:00.000Z`;
            const closedAt = `${day}T21:00:00.000Z`;

            let systemTotalCash = 0;
            let systemTotalCard = 0;
            let systemTotalTransfer = 0;
            let systemTotalOther = 0;

            daySales.forEach((s) => {
                const amount = s.total;
                const method = s.paymentMethod || 'EFECTIVO';

                if (method === 'EFECTIVO') systemTotalCash += amount;
                else if (['DEBITO', 'CREDITO'].includes(method)) systemTotalCard += amount;
                else if (['TRANSFERENCIA', 'MERCADOPAGO'].includes(method)) systemTotalTransfer += amount;
                else systemTotalOther += amount;
            });

            const initialFund = 5000;
            const expenses = Math.floor(Math.random() * 2000);

            const expectedCash = systemTotalCash + initialFund - expenses;

            let declaredCash = expectedCash;
            const hasError = Math.random() < 0.2;
            if (hasError) {
                const errorAmount = Math.floor(Math.random() * 1000) - 500;
                declaredCash += errorAmount;
            }

            const difference = declaredCash - expectedCash;

            const closureItem = {
                PK: `COM#${COMMERCE_ID}`,
                SK: `CLOSE#${closedAt}#${closureId}`,
                GSI1PK: `COM#${COMMERCE_ID}#${day}`,
                GSI1SK: closedAt,

                closureId,
                commerceId: COMMERCE_ID,
                userId: 'seed-admin-user',
                openedAt,
                closedAt,

                systemTotalCash,
                systemTotalCard,
                systemTotalTransfer,
                systemTotalOther,

                initialFund,
                expenses,
                declaredCash,
                difference,

                notes: hasError
                    ? `Diferencia de ${difference}. Posible error de cambio.`
                    : 'Cierre correcto.',
            };

            closuresToWrite.push({
                PutRequest: { Item: closureItem },
            });
        }

        const batches = chunkArray(closuresToWrite, 25);
        let count = 0;
        for (const batch of batches) {
            await docClient.send(
                new BatchWriteCommand({
                    RequestItems: {
                        [TABLE_NAME]: batch,
                    },
                })
            );
            count += batch.length;
        }

        console.log(`✅ Seed de cierres finalizado. ${count} cierres creados.`);

    } catch (err) {
        console.error('❌ Error:', err);
    }
};

seedClosures();