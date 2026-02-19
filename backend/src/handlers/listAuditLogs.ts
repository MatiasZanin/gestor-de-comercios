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
        const { start, end } = queryParams;

        // Build KeyConditionExpression based on date filters
        let keyCondition: string;
        const expressionValues: Record<string, any> = { ':pk': pk };

        if (start && end) {
            keyCondition = 'PK = :pk AND SK BETWEEN :skStart AND :skEnd';
            expressionValues[':skStart'] = `AUDIT#${start}T00:00:00.000Z`;
            expressionValues[':skEnd'] = `AUDIT#${end}T23:59:59.999Z~`;
        } else if (start) {
            keyCondition = 'PK = :pk AND SK >= :skStart';
            expressionValues[':skStart'] = `AUDIT#${start}T00:00:00.000Z`;
        } else if (end) {
            keyCondition = 'PK = :pk AND SK BETWEEN :skStart AND :skEnd';
            expressionValues[':skStart'] = 'AUDIT#';
            expressionValues[':skEnd'] = `AUDIT#${end}T23:59:59.999Z~`;
        } else {
            keyCondition = 'PK = :pk AND begins_with(SK, :prefix)';
            expressionValues[':prefix'] = 'AUDIT#';
        }

        const PAGE_SIZE = 20;
        let items: any[] = [];
        let currentKey = exclusiveStartKey;

        // Loop to fill page when using date filters (FilterExpression may skip items)
        while (items.length < PAGE_SIZE) {
            const command = new QueryCommand({
                TableName: tableName,
                KeyConditionExpression: keyCondition,
                ExpressionAttributeValues: expressionValues,
                ExclusiveStartKey: currentKey,
                Limit: PAGE_SIZE,
                ScanIndexForward: false,
            });

            const result = await docClient.send(command);
            items.push(...(result.Items ?? []));

            if (!result.LastEvaluatedKey) {
                currentKey = undefined;
                break;
            }
            currentKey = result.LastEvaluatedKey;
        }

        const paginatedItems = items.slice(0, PAGE_SIZE);
        const nextKey = (currentKey && items.length >= PAGE_SIZE) ? currentKey : undefined;

        let lastKeyBase64: string | undefined;
        if (nextKey) {
            lastKeyBase64 = Buffer.from(
                JSON.stringify(nextKey)
            ).toString('base64');
        }

        return formatJSONResponse({ items: paginatedItems, lastKey: lastKeyBase64 });
    } catch (err) {
        return buildErrorResponse(err);
    }
};
