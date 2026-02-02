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
import { sanitizeForRole } from '../helpers/sanitizeForRole';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (
    event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
    try {
        const tableName = process.env.TABLE_NAME;
        const gsiName = process.env.SALES_BY_DAY_GSI || 'GSI-Ventas-Por-Dia';

        if (!tableName) {
            throw new Error('TABLE_NAME env var is required');
        }

        const commerceId = event.pathParameters?.commerceId;
        if (!commerceId) {
            throw new BadRequestError('Missing commerceId');
        }

        // Verify permissions: ADMIN ONLY
        const claims = (event.requestContext.authorizer as any)?.jwt?.claims ?? {};
        const roles: string[] | undefined = claims['cognito:groups'];
        if (!roles || !roles.includes('admin')) {
            throw new ForbiddenError('Only admins can view closure history');
        }

        const queryParams = event.queryStringParameters || {};
        const day = queryParams.day;

        if (!day) {
            throw new BadRequestError('day query parameter is required (YYYY-MM-DD)');
        }

        // Validate day format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
            throw new BadRequestError('day must be in YYYY-MM-DD format');
        }

        let exclusiveStartKey: Record<string, any> | undefined;
        if (queryParams.lastKey) {
            try {
                const decoded = Buffer.from(queryParams.lastKey, 'base64').toString(
                    'utf-8'
                );
                exclusiveStartKey = JSON.parse(decoded);
            } catch {
                throw new BadRequestError('Invalid lastKey');
            }
        }

        const gsiPk = `COM#${commerceId}#${day}`;

        // Query GSI filtering for CLOSE# items
        const result = await docClient.send(
            new QueryCommand({
                TableName: tableName,
                IndexName: gsiName,
                KeyConditionExpression: 'GSI1PK = :gsiPk',
                FilterExpression: 'begins_with(SK, :closePrefix)',
                ExpressionAttributeValues: {
                    ':gsiPk': gsiPk,
                    ':closePrefix': 'CLOSE#',
                },
                ExclusiveStartKey: exclusiveStartKey,
                Limit: 25,
                ScanIndexForward: false, // Descending order (most recent first)
            })
        );

        const items = result.Items ?? [];

        let lastKeyBase64: string | undefined;
        if (result.LastEvaluatedKey) {
            lastKeyBase64 = Buffer.from(
                JSON.stringify(result.LastEvaluatedKey)
            ).toString('base64');
        }

        // Sanitize each closure
        const sanitized = items.map((closure) => sanitizeForRole(closure, roles));

        return {
            statusCode: 200,
            body: JSON.stringify({ items: sanitized, lastKey: lastKeyBase64 }),
        };
    } catch (err) {
        return buildErrorResponse(err);
    }
};
