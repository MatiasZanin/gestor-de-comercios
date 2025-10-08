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

    // Fetch all pages and concatenate
    let aggregatedItems: any[] = [];
    let lastEvaluatedKey = exclusiveStartKey;

    do {
      const baseParams: any = {
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: pageSize,
      };

      let page;
      if (typeof isActiveFilter === 'boolean') {
        // Query sparse GSI for products by active flag
        page = await docClient.send(
          new QueryCommand({
            ...baseParams,
            IndexName: 'GSI-Productos-Activos',
            KeyConditionExpression:
              'GSI2PK = :pk AND begins_with(GSI2SK, :gsiPrefix)',
            ExpressionAttributeValues: {
              ':pk': pk,
              ':gsiPrefix': `PRODUCT#${isActiveFilter ? 'true' : 'false'}#`,
            },
          })
        );
      } else {
        // Default: list all products for the commerce (any active state)
        page = await docClient.send(
          new QueryCommand({
            ...baseParams,
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
            ExpressionAttributeValues: {
              ':pk': pk,
              ':prefix': 'PRODUCT#',
            },
          })
        );
      }

      if (page.Items && page.Items.length) {
        aggregatedItems.push(...page.Items);
      }
      lastEvaluatedKey = page.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    let items = aggregatedItems;
    // Optional in-memory filters after fetching all items
    const nameFilter = (queryParams.name ?? '').toString().trim().toLowerCase();
    const codeFilter = (queryParams.code ?? '').toString().trim().toLowerCase();

    if (nameFilter) {
      items = items.filter((it: any) =>
        (it.name ?? '').toString().toLowerCase().includes(nameFilter)
      );
    }
    if (codeFilter) {
      items = items.filter((it: any) =>
        (it.code ?? '').toString().toLowerCase().includes(codeFilter)
      );
    }

    // Sanitizar cada producto según rol
    const sanitized = items.map(item => sanitizeForRole(item, role!));
    return {
      statusCode: 200,
      body: JSON.stringify({ items: sanitized }),
    };
  } catch (err) {
    return buildErrorResponse(err);
  }
};
