import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, QueryCommandOutput } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { BadRequestError, buildErrorResponse } from '../helpers/errors';
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';
import { assertRole } from '../helpers/assertRole';
import { sanitizeForRole } from '../helpers/sanitizeForRole';
import { formatJSONResponse } from '../utils/api-response';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const BATCH_SIZE = 100;

// Campos necesarios para la exportación (evitar traer datos innecesarios)
const PROJECTION_FIELDS = 'saleId, createdAt, #day, #items, #total, profit, paymentMethod, sellerId, notes';

const EXPRESSION_ATTRIBUTE_NAMES: Record<string, string> = {
    '#day': 'day',
    '#items': 'items',
    '#total': 'total',
};

const fetchAllByDay = async (tableName: string, commerceId: string, day: string) => {
    const items: any[] = [];
    let currentKey: Record<string, any> | undefined = undefined;

    while (true) {
        const result: QueryCommandOutput = await docClient.send(new QueryCommand({
            TableName: tableName,
            IndexName: 'GSI-Ventas-Por-Dia',
            KeyConditionExpression: 'GSI1PK = :gsiPk',
            FilterExpression: 'begins_with(SK, :salePrefix)',
            ProjectionExpression: PROJECTION_FIELDS,
            ExpressionAttributeNames: EXPRESSION_ATTRIBUTE_NAMES,
            ExpressionAttributeValues: { ':gsiPk': `COM#${commerceId}#${day}`, ':salePrefix': 'SALE#' },
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
    const expressionValues: Record<string, any> = { ':pk': `COM#${commerceId}`, ':prefix': 'SALE#' };
    const expressionNames: Record<string, string> = { ...EXPRESSION_ATTRIBUTE_NAMES };
    let filterExpression: string | undefined;

    if (start && end) {
        filterExpression = '#day BETWEEN :start AND :end';
        expressionValues[':start'] = start;
        expressionValues[':end'] = end;
    } else if (start) {
        filterExpression = '#day >= :start';
        expressionValues[':start'] = start;
    } else if (end) {
        filterExpression = '#day <= :end';
        expressionValues[':end'] = end;
    }

    const items: any[] = [];
    let currentKey: Record<string, any> | undefined = undefined;

    while (true) {
        const result: QueryCommandOutput = await docClient.send(new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
            FilterExpression: filterExpression,
            ProjectionExpression: PROJECTION_FIELDS,
            ExpressionAttributeNames: Object.keys(expressionNames).length > 0 ? expressionNames : undefined,
            ExpressionAttributeValues: expressionValues,
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

        const role: any = event.requestContext.authorizer?.jwt?.claims?.['cognito:groups'];
        const sanitizedItems = items.map(sale => sanitizeForRole(sale, role));

        return formatJSONResponse({
            items: sanitizedItems,
            totalCount: sanitizedItems.length,
        });
    } catch (err) {
        return buildErrorResponse(err);
    }
};
