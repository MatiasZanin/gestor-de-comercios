import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    BatchWriteCommand,
    QueryCommand,
    QueryCommandOutput,
} from '@aws-sdk/lib-dynamodb';

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

// --- TIPOS ---
interface DailySummary {
    totalDay: number;
    txCount: number;
    methods: Record<string, number>; // method_CASH, method_CARD, etc.
    hours: Record<string, number>;   // h9, h10, h11, etc.
}

interface ProductStat {
    code: string;
    name: string;
    uom: string;
    priceSale: number;
    monthlyUnits: number;
}

// --- FUNCIONES ---

const fetchAllSales = async () => {
    console.log('📥 Leyendo todas las ventas para calcular agregaciones...');
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

        const response = (await docClient.send(command)) as QueryCommandOutput;
        if (response.Items) allSales.push(...response.Items);
        lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    console.log(`📊 Procesando ${allSales.length} ventas...`);
    return allSales;
};

const seedAggregations = async () => {
    try {
        const sales = await fetchAllSales();
        if (sales.length === 0) {
            console.log('⚠️ No hay ventas. Ejecuta primero seedSales.ts');
            return;
        }

        const itemsToWrite: any[] = [];

        // ---------------------------------------------------------
        // 1. CALCULAR SUMMARY#YYYY-MM-DD (Dashboard Diario)
        // ---------------------------------------------------------
        const dailySummaries: Record<string, DailySummary> = {};

        sales.forEach((sale) => {
            const day = sale.createdAt.split('T')[0]; // YYYY-MM-DD
            const hour = new Date(sale.createdAt).getHours();
            const method = sale.paymentMethod || 'OTHER';
            const total = sale.total || 0;

            if (!dailySummaries[day]) {
                dailySummaries[day] = {
                    totalDay: 0,
                    txCount: 0,
                    methods: {},
                    hours: {},
                };
            }

            const summary = dailySummaries[day];
            summary.totalDay += total;
            summary.txCount += 1;

            // Sumar por método de pago
            const methodKey = `method_${method}`;
            summary.methods[methodKey] = (summary.methods[methodKey] || 0) + total;

            // Contar por hora (mapa de calor)
            const hourKey = `h${hour}`;
            summary.hours[hourKey] = (summary.hours[hourKey] || 0) + 1;
        });

        // Convertir a Items de DynamoDB
        Object.entries(dailySummaries).forEach(([day, data]) => {
            itemsToWrite.push({
                PutRequest: {
                    Item: {
                        PK: `COM#${COMMERCE_ID}`,
                        SK: `SUMMARY#${day}`,
                        commerceId: COMMERCE_ID,
                        totalDay: data.totalDay,
                        txCount: data.txCount,
                        ...data.methods, // Spread methods (method_CASH: 100...)
                        ...data.hours,   // Spread hours (h10: 5...)
                        type: 'DAILY_SUMMARY' // Metadata útil
                    },
                },
            });
        });

        console.log(`✅ Generados ${Object.keys(dailySummaries).length} resúmenes diarios.`);

        // ---------------------------------------------------------
        // 2. CALCULAR STAT#YYYY-MM#PRODUCT (Ranking Mensual)
        // ---------------------------------------------------------
        // Mapa: "YYYY-MM_PRODUCT-CODE" -> Datos acumulados
        const productStats: Record<string, ProductStat> = {};

        sales.forEach((sale) => {
            const month = sale.createdAt.slice(0, 7); // YYYY-MM

            if (sale.items && Array.isArray(sale.items)) {
                sale.items.forEach((item: any) => {
                    const key = `${month}#${item.code}`;

                    if (!productStats[key]) {
                        productStats[key] = {
                            code: item.code,
                            name: item.name,
                            uom: item.uom,
                            priceSale: item.priceSale,
                            monthlyUnits: 0,
                        };
                    }

                    productStats[key].monthlyUnits += (item.qty || 0);
                });
            }
        });

        // Convertir a Items de DynamoDB
        Object.entries(productStats).forEach(([key, data]) => {
            const [month, code] = key.split('#');
            const ttlSeconds = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 año

            itemsToWrite.push({
                PutRequest: {
                    Item: {
                        PK: `COM#${COMMERCE_ID}`,
                        SK: `STAT#${month}#PRODUCT#${code}`,

                        // GSI Keys para "GSI-Ranking-Mensual"
                        statPK: `COM#${COMMERCE_ID}#${month}`,
                        monthlyUnits: data.monthlyUnits,

                        // Atributos proyectados en el GSI
                        name: data.name,
                        code: data.code,
                        uom: data.uom,
                        priceSale: data.priceSale,

                        ttl: ttlSeconds
                    },
                },
            });
        });

        console.log(`✅ Generados ${Object.keys(productStats).length} estadísticas de productos mensuales.`);

        // ---------------------------------------------------------
        // 3. GUARDAR EN DYNAMODB
        // ---------------------------------------------------------
        const batches = chunkArray(itemsToWrite, 25);
        let count = 0;

        console.log(`💾 Escribiendo ${itemsToWrite.length} items de agregación...`);

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

        console.log(`🚀 Seed de agregaciones finalizado. Total items creados: ${count}`);

    } catch (err) {
        console.error('❌ Error:', err);
    }
};

seedAggregations();