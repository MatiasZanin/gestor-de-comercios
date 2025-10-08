import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import {
  BadRequestError,
  NotFoundError,
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
    if (!tableName) {
      throw new Error('TABLE_NAME env var is required');
    }

    const commerceId = event.pathParameters?.commerceId;
    const code = event.pathParameters?.code;

    if (!commerceId) {
      throw new BadRequestError('Missing commerceId');
    }

    if (!code) {
      throw new BadRequestError('Missing product code');
    }

    const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
    const role: any = claims['cognito:groups'];

    const pk = `COM#${commerceId}`;
    const sk = `PRODUCT#${code}`;

    const result = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          PK: pk,
          SK: sk,
        },
      })
    );

    if (!result.Item) {
      throw new NotFoundError(`Product with code ${code} not found`);
    }

    // Sanitizar el producto según el rol del usuario
    const sanitizedProduct = sanitizeForRole(result.Item, role!);

    return {
      statusCode: 200,
      body: JSON.stringify(sanitizedProduct),
    };
  } catch (err) {
    return buildErrorResponse(err);
  }
};
