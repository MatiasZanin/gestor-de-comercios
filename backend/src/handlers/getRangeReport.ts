import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { BadRequestError, buildErrorResponse } from '../helpers/errors';

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
    const queryParams = event.queryStringParameters || {};
    const start = queryParams.start;
    const end = queryParams.end;
    if (!commerceId || !start || !end) {
      throw new BadRequestError('Missing commerceId, start or end');
    }
    const claims = (event.requestContext.authorizer as any)?.jwt?.claims ?? {};
    const role: string | undefined = claims['cognito:groups'];
    const order = queryParams.orderBy || 'units';
    const pk = `COM#${commerceId}`;
    const aggregated: Record<string, any> = {};
    let exclusiveStartKey;
    do {
      const expressionValues: Record<string, any> = {
        ':pk': pk,
        ':prefix': 'SALE#',
        ':start': start,
        ':end': end,
      };
      const result: any = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          FilterExpression: 'day BETWEEN :start AND :end',
          ExpressionAttributeValues: expressionValues,
          ExclusiveStartKey: exclusiveStartKey,
        })
      );
      const items = result.Items ?? [];
      for (const sale of items) {
        const saleItems = sale.items || [];
        for (const item of saleItems) {
          const key = item.code;
          if (!aggregated[key]) {
            aggregated[key] = {
              code: item.code,
              name: item.name,
              units: 0,
              revenue: 0,
              profit: 0,
            };
          }
          aggregated[key].units += item.qty;
          aggregated[key].revenue += item.priceSale * item.qty;
          aggregated[key].profit +=
            (item.priceSale - (item.priceBuy || 0)) * item.qty;
        }
      }
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);
    const list = Object.values(aggregated);
    const sortKey =
      order === 'revenue' ? 'revenue' : order === 'profit' ? 'profit' : 'units';
    list.sort((a: any, b: any) => b[sortKey] - a[sortKey]);
    if (role !== 'admin') {
      for (const entry of list) {
        delete entry.profit;
      }
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ start, end, results: list }),
    };
  } catch (err) {
    return buildErrorResponse(err);
  }
};
