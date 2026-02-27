import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

// CONFIGURACIÓN
const TABLE_NAME = 'GestionComercios-dev';
const COMMERCE_ID = 'gs';
const REGION = 'us-east-1';

// ⚠️ IMPORTANTE: Ajusta esto si tus ventas tienen otro prefijo en el SK (ej: 'VN#', 'ORDER#', etc.)
const SALE_PREFIX = 'SALE#';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function cleanCommerceSales() {
    const pkToClean = `COM#${COMMERCE_ID}`;
    console.log(`🔥 Iniciando borrado de VENTAS para: ${pkToClean} (Prefijo SK: ${SALE_PREFIX})`);

    try {
        let itemsToDelete: any[] = [];
        let lastEvaluatedKey;

        // 1. RECOLECTAR SOLO LAS VENTAS (Usando begins_with en el SK)
        console.log('🔍 Buscando ventas en la base de datos...');
        do {
            const result = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                // AQUI ESTÁ EL CAMBIO PRINCIPAL: Filtramos por PK y el comienzo del SK
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
                ExpressionAttributeValues: {
                    ':pk': pkToClean,
                    ':skPrefix': SALE_PREFIX
                }
            }));

            if (result.Items) {
                itemsToDelete.push(...result.Items);
            }
            lastEvaluatedKey = result.LastEvaluatedKey;
            process.stdout.write('.'); // Feedback visual
        } while (lastEvaluatedKey);

        console.log(`\n📦 Encontradas ${itemsToDelete.length} ventas para eliminar.`);

        if (itemsToDelete.length === 0) {
            console.log('✅ No hay ventas para borrar con ese prefijo.');
            return;
        }

        // 2. ELIMINAR ITEMS
        console.log('🧹 Ejecutando eliminaciones de ventas...');

        // Usamos map + Promise.all. 
        // Nota: Para producción masiva, considera usar batchWrite o p-limit para no saturar la capacidad de escritura.
        const deletePromises = itemsToDelete.map(item =>
            docClient.send(new DeleteCommand({
                TableName: TABLE_NAME,
                Key: { PK: item.PK, SK: item.SK }
            }))
        );

        await Promise.all(deletePromises);

        console.log(`✅ ÉXITO: Se eliminaron ${itemsToDelete.length} ventas del comercio ${COMMERCE_ID}.`);

    } catch (error) {
        console.error('❌ Error durante la limpieza de ventas:', error);
    }
}

cleanCommerceSales();