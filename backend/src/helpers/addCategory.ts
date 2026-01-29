import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Agrega una categoría al item METADATA#CONFIG del tenant si no existe.
 * Si el item no existe, lo crea con la categoría.
 * Si la categoría ya existe, no hace nada.
 */
export async function addCategory(
    tableName: string,
    commerceId: string,
    category: string
): Promise<void> {
    if (!category || !category.trim()) {
        return;
    }

    const pk = `COM#${commerceId}`;
    const sk = 'METADATA#CONFIG';
    const trimmedCategory = category.trim();

    // Primero obtener el item actual
    const result = await docClient.send(
        new GetCommand({
            TableName: tableName,
            Key: { PK: pk, SK: sk },
        })
    );

    if (!result.Item) {
        // El item no existe, crearlo con la categoría
        await docClient.send(
            new PutCommand({
                TableName: tableName,
                Item: {
                    PK: pk,
                    SK: sk,
                    categories: [trimmedCategory],
                    iva_rates: [],
                },
            })
        );
    } else {
        // El item existe, verificar si la categoría ya está
        const existingCategories: string[] = result.Item.categories || [];
        if (!existingCategories.includes(trimmedCategory)) {
            // Agregar la categoría
            await docClient.send(
                new UpdateCommand({
                    TableName: tableName,
                    Key: { PK: pk, SK: sk },
                    UpdateExpression:
                        'SET categories = list_append(if_not_exists(categories, :empty), :newCat)',
                    ExpressionAttributeValues: {
                        ':empty': [],
                        ':newCat': [trimmedCategory],
                    },
                })
            );
        }
    }
}
