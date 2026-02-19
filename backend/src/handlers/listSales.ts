import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, QueryCommandOutput } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { BadRequestError, buildErrorResponse } from '../helpers/errors';
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';
import { sanitizeForRole } from '../helpers/sanitizeForRole';
import { formatJSONResponse } from '../utils/api-response';

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const PAGE_SIZE = 10;

const parseLastKey = (key?: string) => {
  if (!key) return undefined;
  try {
    return JSON.parse(Buffer.from(key, 'base64').toString('utf-8'));
  } catch {
    throw new BadRequestError('Invalid lastKey');
  }
};

const encodeLastKey = (key?: any) => {
  return key ? Buffer.from(JSON.stringify(key)).toString('base64') : undefined;
};

const fetchBySaleId = async (tableName: string, commerceId: string, saleId: string) => {
  let currentKey: Record<string, any> | undefined = undefined;

  while (true) {
    const result: QueryCommandOutput = await docClient.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      FilterExpression: 'contains(saleId, :saleId)',
      ExpressionAttributeValues: { ':pk': `COM#${commerceId}`, ':prefix': 'SALE#', ':saleId': saleId },
      ExclusiveStartKey: currentKey,
    }));


    const found = result.Items?.find(item => item.saleId.includes(saleId));
    if (found) return { items: [found], lastKey: undefined };

    if (!result.LastEvaluatedKey) break;
    currentKey = result.LastEvaluatedKey;
  }

  return { items: [], lastKey: undefined };
};

const fetchByDay = async (tableName: string, commerceId: string, day: string, exclusiveStartKey?: any) => {
  const result = await docClient.send(new QueryCommand({
    TableName: tableName,
    IndexName: 'GSI-Ventas-Por-Dia',
    KeyConditionExpression: 'GSI1PK = :gsiPk',
    FilterExpression: 'begins_with(SK, :salePrefix)',
    ExpressionAttributeValues: { ':gsiPk': `COM#${commerceId}#${day}`, ':salePrefix': 'SALE#' },
    ExclusiveStartKey: exclusiveStartKey,
    Limit: PAGE_SIZE,
    ScanIndexForward: false,
  }));
  return { items: result.Items ?? [], lastKey: result.LastEvaluatedKey };
};

const fetchByDateRange = async (tableName: string, commerceId: string, start?: string, end?: string, exclusiveStartKey?: any) => {
  const expressionValues: Record<string, any> = { ':pk': `COM#${commerceId}`, ':prefix': 'SALE#' };
  const expressionNames: Record<string, string> = {};
  let filterExpression: string | undefined;

  if (start && end) {
    filterExpression = '#day BETWEEN :start AND :end';
    expressionNames['#day'] = 'day';
    expressionValues[':start'] = start;
    expressionValues[':end'] = end;
  } else if (start) {
    filterExpression = '#day >= :start';
    expressionNames['#day'] = 'day';
    expressionValues[':start'] = start;
  } else if (end) {
    filterExpression = '#day <= :end';
    expressionNames['#day'] = 'day';
    expressionValues[':end'] = end;
  }

  let items: any[] = [];
  let currentKey = exclusiveStartKey;

  while (items.length < PAGE_SIZE) {
    const result = await docClient.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      FilterExpression: filterExpression,
      ExpressionAttributeNames: Object.keys(expressionNames).length > 0 ? expressionNames : undefined,
      ExpressionAttributeValues: expressionValues,
      ExclusiveStartKey: currentKey,
      Limit: PAGE_SIZE,
      ScanIndexForward: false,
    }));

    items.push(...(result.Items ?? []));
    if (!result.LastEvaluatedKey) break;
    currentKey = result.LastEvaluatedKey;
  }

  const paginatedItems = items.slice(0, PAGE_SIZE);
  const nextKey = (currentKey && items.length >= PAGE_SIZE) ? currentKey : undefined;

  return { items: paginatedItems, lastKey: nextKey };
};

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> => {
  try {
    const tableName = process.env.TABLE_NAME;
    if (!tableName) throw new Error('TABLE_NAME env var is required');

    const commerceId = event.pathParameters?.commerceId;
    if (!commerceId) throw new BadRequestError('Missing commerceId');

    assertCommerceAccess(event, commerceId);

    const queryParams = event.queryStringParameters || {};
    const exclusiveStartKey = parseLastKey(queryParams.lastKey);

    let fetchResult;
    if (queryParams.saleId) {
      fetchResult = await fetchBySaleId(tableName, commerceId, queryParams.saleId);
    } else if (queryParams.day) {
      fetchResult = await fetchByDay(tableName, commerceId, queryParams.day, exclusiveStartKey);
    } else {
      fetchResult = await fetchByDateRange(tableName, commerceId, queryParams.start, queryParams.end, exclusiveStartKey);
    }

    const role: any = event.requestContext.authorizer?.jwt?.claims?.['cognito:groups'];
    const sanitizedItems = fetchResult.items.map(sale => sanitizeForRole(sale, role));

    return formatJSONResponse({
      items: sanitizedItems,
      lastKey: encodeLastKey(fetchResult.lastKey)
    });
  } catch (err) {
    return buildErrorResponse(err);
  }
};