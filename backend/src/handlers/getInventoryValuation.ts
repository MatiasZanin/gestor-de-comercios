import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
    APIGatewayProxyEventV2WithJWTAuthorizer,
    APIGatewayProxyResultV2,
} from 'aws-lambda';
import { BadRequestError, buildErrorResponse } from '../helpers/errors';
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface ProductValuation {
    stock?: number;
    priceBuy?: number;
    priceSale?: number;
}

/**
 * Calcula el valor monetario total del inventario de un comercio.
 * 
 * - totalCost: Suma de (stock * priceBuy) para todos los productos.
 * - totalRetail: Suma de (stock * priceSale) para todos los productos.
 * - count: Cantidad de productos con stock > 0.
 * 
 * Maneja paginación automática para asegurar que se procesen TODOS los productos.
 */
export const handler = async (
    event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
    try {
        const tableName = process.env.TABLE_NAME;
        if (!tableName) {
            throw new Error('TABLE_NAME env var is required');
        }

        const commerceId = event.pathParameters?.commerceId;
        if (!commerceId) {
            throw new BadRequestError('Missing commerceId');
        }

        // Validate user has access to this commerce
        assertCommerceAccess(event, commerceId);

        const pk = `COM#${commerceId}`;

        let totalCost = 0;
        let totalRetail = 0;
        let count = 0;
        let lastEvaluatedKey: Record<string, any> | undefined;

        // Query exhaustiva con paginación para obtener TODOS los productos
        do {
            const result = await docClient.send(
                new QueryCommand({
                    TableName: tableName,
                    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
                    ExpressionAttributeValues: {
                        ':pk': pk,
                        ':prefix': 'PRODUCT#',
                    },
                    ProjectionExpression: 'stock, priceBuy, priceSale',
                    ExclusiveStartKey: lastEvaluatedKey,
                })
            );

            const items = (result.Items ?? []) as ProductValuation[];

            for (const item of items) {
                const stock = item.stock ?? 0;
                const priceBuy = item.priceBuy ?? 0;
                const priceSale = item.priceSale ?? 0;

                totalCost += stock * priceBuy;
                totalRetail += stock * priceSale;

                if (stock > 0) {
                    count++;
                }
            }

            lastEvaluatedKey = result.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                totalCost,
                totalRetail,
                count,
            }),
        };
    } catch (err) {
        return buildErrorResponse(err);
    }
};
