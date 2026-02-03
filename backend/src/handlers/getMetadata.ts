import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import {
    APIGatewayProxyEventV2WithJWTAuthorizer,
    APIGatewayProxyResultV2,
} from 'aws-lambda';
import { BadRequestError, buildErrorResponse } from '../helpers/errors';
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Handler para obtener la metadata del tenant (categorías, iva_rates, etc.)
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
        const sk = 'METADATA#CONFIG';

        const result = await docClient.send(
            new GetCommand({
                TableName: tableName,
                Key: { PK: pk, SK: sk },
            })
        );

        // Si no existe el item, retornar valores por defecto
        if (!result.Item) {
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categories: [],
                    iva_rates: [],
                }),
            };
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                categories: result.Item.categories || [],
                iva_rates: result.Item.iva_rates || [],
            }),
        };
    } catch (err) {
        return buildErrorResponse(err);
    }
};
