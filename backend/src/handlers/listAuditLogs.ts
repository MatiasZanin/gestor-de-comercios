import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
    APIGatewayProxyEventV2WithJWTAuthorizer,
    APIGatewayProxyResultV2,
} from 'aws-lambda';
import {
    BadRequestError,
    ForbiddenError,
    buildErrorResponse,
} from '../helpers/errors';
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';
import { formatJSONResponse } from '../utils/api-response';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

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

        // Admin only
        const claims = (event.requestContext.authorizer as any)?.jwt?.claims ?? {};
        const roles: string[] | undefined = claims['cognito:groups'];
        if (!roles || !roles.includes('admin')) {
            throw new ForbiddenError('Only admins can view audit logs');
        }

        const queryParams = event.queryStringParameters || {};

        let exclusiveStartKey: Record<string, any> | undefined;
        if (queryParams.lastKey) {
            try {
                const decoded = Buffer.from(queryParams.lastKey, 'base64').toString('utf-8');
                exclusiveStartKey = JSON.parse(decoded);
            } catch {
                throw new BadRequestError('Invalid lastKey');
            }
        }

        const pk = `COM#${commerceId}`;

        const command = new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
            ExpressionAttributeValues: {
                ':pk': pk,
                ':prefix': 'AUDIT#',
            },
            ExclusiveStartKey: exclusiveStartKey,
            Limit: 50,
            ScanIndexForward: false, // Más recientes primero
        });

        const result = await docClient.send(command);
        const items = result.Items ?? [];

        let lastKeyBase64: string | undefined;
        if (result.LastEvaluatedKey) {
            lastKeyBase64 = Buffer.from(
                JSON.stringify(result.LastEvaluatedKey)
            ).toString('base64');
        }

        return formatJSONResponse({ items, lastKey: lastKeyBase64 });
    } catch (err) {
        return buildErrorResponse(err);
    }
};
