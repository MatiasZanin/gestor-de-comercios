import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
    APIGatewayProxyEventV2WithJWTAuthorizer,
    APIGatewayProxyResultV2,
} from 'aws-lambda';
import { BadRequestError, buildErrorResponse } from '../helpers/errors';
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';
import { formatJSONResponse } from '../utils/api-response';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Obtiene todos los productos con stock crítico (alertStatus = 'LOW')
 * utilizando el GSI-Stock-Critico (Sparse Index).
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

        // Query usando GSI-Stock-Critico para obtener productos con alertStatus = 'LOW'
        const result = await docClient.send(
            new QueryCommand({
                TableName: tableName,
                IndexName: 'GSI-Stock-Critico',
                KeyConditionExpression: 'PK = :pk AND alertStatus = :status',
                ExpressionAttributeValues: {
                    ':pk': pk,
                    ':status': 'LOW',
                },
            })
        );

        const items = result.Items ?? [];

        return formatJSONResponse({
            items,
            count: items.length,
        });
    } catch (err) {
        return buildErrorResponse(err);
    }
};
