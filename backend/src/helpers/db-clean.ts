import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

// CONFIGURACIÓN
const TABLE_NAME = 'CommerceData-dev';
const COMMERCE_ID = 'gs';
const REGION = 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function cleanCommerceData() {
    const pkToClean = `COM#${COMMERCE_ID}`;
    console.log(`🔥 Iniciando borrado total para: ${pkToClean}`);

    try {
        let itemsToDelete: any[] = [];
        let lastEvaluatedKey;
        let totalDeleted = 0;

        // 1. RECOLECTAR TODOS LOS ITEMS (Maneja paginación)
        console.log('🔍 Buscando items en la base de datos...');
        do {
            const result = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: 'PK = :pk',
                ExpressionAttributeValues: { ':pk': pkToClean }
            }));

            if (result.Items) {
                itemsToDelete.push(...result.Items);
            }
            lastEvaluatedKey = result.LastEvaluatedKey;
            process.stdout.write('.'); // Feedback visual
        } while (lastEvaluatedKey);

        console.log(`\n📦 Encontrados ${itemsToDelete.length} items para eliminar.`);

        if (itemsToDelete.length === 0) {
            console.log('✅ No hay datos para borrar. La DB ya está limpia.');
            return;
        }

        // 2. ELIMINAR ITEMS
        // Nota: Para grandes volúmenes (>500 items), sería mejor usar batchWrite o controlar la concurrencia.
        // Aquí mantenemos tu lógica original de Promise.all para mantenerlo simple.
        console.log('🧹 Ejecutando eliminaciones...');

        const deletePromises = itemsToDelete.map(item =>
            docClient.send(new DeleteCommand({
                TableName: TABLE_NAME,
                Key: { PK: item.PK, SK: item.SK }
            }))
        );

        await Promise.all(deletePromises);

        console.log(`✅ ÉXITO: Se eliminaron ${itemsToDelete.length} registros del comercio ${COMMERCE_ID}.`);

    } catch (error) {
        console.error('❌ Error durante la limpieza:', error);
    }
}

cleanCommerceData();