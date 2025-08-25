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
    const isActiveParam = queryParams.isActive;
    let isActiveFilter: boolean | undefined;
    if (isActiveParam !== undefined) {
      isActiveFilter = isActiveParam === 'true';
    }
    let exclusiveStartKey;
    if (queryParams.lastKey) {
      try {
        const decoded = Buffer.from(queryParams.lastKey, 'base64').toString(
          'utf-8'
        );
        exclusiveStartKey = JSON.parse(decoded);
      } catch (e) {
        throw new BadRequestError('Invalid lastKey');
      }
    }
    const pageSize = Math.min(
      Math.max(parseInt(queryParams.pageSize ?? '25', 10) || 25, 1),
      100
    );

    const pk = `COM#${commerceId}`;

    let result;
    if (typeof isActiveFilter === 'boolean') {
      // Query sparse GSI for products by active flag
      result = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'GSI-Productos-Activos',
          KeyConditionExpression:
            'GSI2PK = :pk AND begins_with(GSI2SK, :gsiPrefix)',
          ExpressionAttributeValues: {
            ':pk': pk,
            ':gsiPrefix': `PRODUCT#${isActiveFilter ? 'true' : 'false'}#`,
          },
          ExclusiveStartKey: exclusiveStartKey,
          Limit: pageSize,
        })
      );
    } else {
      // Default: list all products for the commerce (any active state)
      result = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: {
            ':pk': pk,
            ':prefix': 'PRODUCT#',
          },
          ExclusiveStartKey: exclusiveStartKey,
          Limit: pageSize,
        })
      );
    }

    let items = result.Items ?? [];
    // Sanitizar cada producto según rol
    const sanitized = items.map(item => sanitizeForRole(item, role!));
    let lastKeyBase64: string | undefined;
    if (result.LastEvaluatedKey) {
      lastKeyBase64 = Buffer.from(
        JSON.stringify(result.LastEvaluatedKey)
      ).toString('base64');
    }
    return {
      statusCode: 200,
      body: JSON.stringify({ items: sanitized, lastKey: lastKeyBase64 }),
    };
  } catch (err) {
    return buildErrorResponse(err);
  }
};
