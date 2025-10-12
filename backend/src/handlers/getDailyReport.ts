import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { BadRequestError, buildErrorResponse } from '../helpers/errors';
import { sanitizeForRole } from '../helpers/sanitizeForRole';

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
    const day = queryParams.day;
    if (!commerceId || !day) {
      throw new BadRequestError('Missing commerceId or day');
    }
    const claims = (event.requestContext.authorizer as any)?.jwt?.claims ?? {};
    const role: any = claims['cognito:groups'];
    const order = queryParams.orderBy || 'units';
    const gsiPk = `COM#${commerceId}#${day}`;
    // Obtener todas las ventas del día
    let exclusiveStartKey;
    const aggregated: Record<string, any> = {};
    do {
      const result: any = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'GSI-Ventas-Por-Dia',
          KeyConditionExpression: 'GSI1PK = :gsiPk',
          ExpressionAttributeValues: { ':gsiPk': gsiPk },
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
    // Ordenar según parámetro
    const sanitized = list.map(item => sanitizeForRole(item, role!));
    const sortKey =
      order === 'revenue' ? 'revenue' : order === 'profit' ? 'profit' : 'units';
    sanitized.sort((a: any, b: any) => b[sortKey] - a[sortKey]);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day, results: sanitized }),
    };
  } catch (err) {
    return buildErrorResponse(err);
  }
};
