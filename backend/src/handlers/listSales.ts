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
    if (!commerceId) {
      throw new BadRequestError('Missing commerceId');
    }
    const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
    const role: any = claims['cognito:groups'];
    const queryParams = event.queryStringParameters || {};
    const day = queryParams.day;
    const start = queryParams.start;
    const end = queryParams.end;
    let exclusiveStartKey;
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
    let items: any[] = [];
    let lastKeyBase64: string | undefined;
    const pk = `COM#${commerceId}`;
    if (day) {
      // Consulta por día a través de GSI
      const gsiPk = `COM#${commerceId}#${day}`;
      const result = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'GSI-Ventas-Por-Dia',
          KeyConditionExpression: 'GSI1PK = :gsiPk',
          ExpressionAttributeValues: { ':gsiPk': gsiPk },
          ExclusiveStartKey: exclusiveStartKey,
          Limit: 25,
        })
      );
      items = result.Items ?? [];
      if (result.LastEvaluatedKey) {
        lastKeyBase64 = Buffer.from(
          JSON.stringify(result.LastEvaluatedKey)
        ).toString('base64');
      }
    } else {
      // Consulta general por comercio; filtra por rango si se proveen start/end
      const expressionValues: Record<string, any> = {
        ':pk': pk,
        ':prefix': 'SALE#',
      };
      let filterExpression: string | undefined;
      if (start && end) {
        filterExpression = 'day BETWEEN :start AND :end';
        expressionValues[':start'] = start;
        expressionValues[':end'] = end;
      } else if (start) {
        filterExpression = 'day >= :start';
        expressionValues[':start'] = start;
      } else if (end) {
        filterExpression = 'day <= :end';
        expressionValues[':end'] = end;
      }
      const result = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          FilterExpression: filterExpression,
          ExpressionAttributeValues: expressionValues,
          ExclusiveStartKey: exclusiveStartKey,
          Limit: 25,
        })
      );
      items = result.Items ?? [];
      if (result.LastEvaluatedKey) {
        lastKeyBase64 = Buffer.from(
          JSON.stringify(result.LastEvaluatedKey)
        ).toString('base64');
      }
    }
    // Sanitizar cada venta
    const sanitized = items.map(sale => sanitizeForRole(sale, role!));
    return {
      statusCode: 200,
      body: JSON.stringify({ items: sanitized, lastKey: lastKeyBase64 }),
    };
  } catch (err) {
    return buildErrorResponse(err);
  }
};
