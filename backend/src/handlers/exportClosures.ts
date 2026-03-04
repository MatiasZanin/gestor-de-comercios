import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, QueryCommandOutput } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { BadRequestError, buildErrorResponse } from '../helpers/errors';
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';
import { assertRole } from '../helpers/assertRole';
import { formatJSONResponse } from '../utils/api-response';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const BATCH_SIZE = 100;

const PROJECTION_FIELDS = [
    'closureId', 'initialFund', 'closedAt', 'openedAt',
    'systemTotalTransfer', 'systemTotalCash', 'declaredCash',
    'expenses', 'userId', 'notes', 'systemTotalCard',
    'difference', 'systemTotalOther',
].join(', ');

const fetchAllByDay = async (tableName: string, commerceId: string, day: string) => {
    const items: any[] = [];
    let currentKey: Record<string, any> | undefined = undefined;

    while (true) {
        const result: QueryCommandOutput = await docClient.send(new QueryCommand({
            TableName: tableName,
            IndexName: 'GSI-Ventas-Por-Dia',
            KeyConditionExpression: 'GSI1PK = :gsiPk',
            FilterExpression: 'begins_with(SK, :closePrefix)',
            ProjectionExpression: PROJECTION_FIELDS,
            ExpressionAttributeValues: {
                ':gsiPk': `COM#${commerceId}#${day}`,
                ':closePrefix': 'CLOSE#',
            },
            ExclusiveStartKey: currentKey,
            Limit: BATCH_SIZE,
            ScanIndexForward: false,
        }));

        items.push(...(result.Items ?? []));
        if (!result.LastEvaluatedKey) break;
        currentKey = result.LastEvaluatedKey;
    }

    return items;
};

const fetchAllByDateRange = async (tableName: string, commerceId: string, start?: string, end?: string) => {
    const pk = `COM#${commerceId}`;
    const skStart = start ? `CLOSE#${start}` : 'CLOSE#';
    const skEnd = end ? `CLOSE#${end}\uffff` : 'CLOSE#\uffff';

    const items: any[] = [];
    let currentKey: Record<string, any> | undefined = undefined;

    while (true) {
        const result: QueryCommandOutput = await docClient.send(new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: 'PK = :pk AND SK BETWEEN :skStart AND :skEnd',
            ProjectionExpression: PROJECTION_FIELDS,
            ExpressionAttributeValues: {
                ':pk': pk,
                ':skStart': skStart,
                ':skEnd': skEnd,
            },
            ExclusiveStartKey: currentKey,
            Limit: BATCH_SIZE,
            ScanIndexForward: false,
        }));

        items.push(...(result.Items ?? []));
        if (!result.LastEvaluatedKey) break;
        currentKey = result.LastEvaluatedKey;
    }

    return items;
};

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> => {
    try {
        const tableName = process.env.TABLE_NAME;
        if (!tableName) throw new Error('TABLE_NAME env var is required');

        const commerceId = event.pathParameters?.commerceId;
        if (!commerceId) throw new BadRequestError('Missing commerceId');

        assertCommerceAccess(event, commerceId);
        assertRole(event, 'admin');

        const queryParams = event.queryStringParameters || {};

        let items: any[];
        if (queryParams.day) {
            items = await fetchAllByDay(tableName, commerceId, queryParams.day);
        } else {
            if (!queryParams.start && !queryParams.end) {
                throw new BadRequestError('At least one of day, start, or end must be provided');
            }
            items = await fetchAllByDateRange(tableName, commerceId, queryParams.start, queryParams.end);
        }

        return formatJSONResponse({
            items,
            totalCount: items.length,
        });
    } catch (err) {
        return buildErrorResponse(err);
    }
};
