import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { BadRequestError, ForbiddenError, NotFoundError, buildErrorResponse } from '../helpers/errors';
import { sanitizeForRole } from '../helpers/sanitizeForRole';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
): Promise<APIGatewayProxyResultV2> => {
  try {
    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
      throw new Error('TABLE_NAME env var is required');
    }
    const commerceId = event.pathParameters?.commerceId;
    const code = event.pathParameters?.code;
    if (!commerceId || !code) {
      throw new BadRequestError('Missing commerceId or code');
    }
    const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
    const roles: any = claims['cognito:groups'];
    if (!roles.includes('admin')) {
      throw new ForbiddenError('Only admin can update products');
    }
    if (!event.body) {
      throw new BadRequestError('Missing body');
    }
    const body = JSON.parse(event.body);
    const allowedFields = ['name', 'priceBuy', 'priceSale', 'stock', 'notes', 'uom', 'qtyStep', 'isActive'];
    const expressionParts: string[] = [];
    const expressionNames: Record<string, string> = {};
    const expressionValues: Record<string, any> = { ':now': new Date().toISOString() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        const placeholder = `:${field}`;
        const attr = field === 'name' ? '#name' : field;
        if (field === 'name') {
          expressionNames['#name'] = 'name';
        }
        expressionParts.push(`${attr} = ${placeholder}`);
        expressionValues[placeholder] = body[field];
      }
    }
    if (expressionParts.length === 0) {
      throw new BadRequestError('No updatable fields provided');
    }
    const updateExpression = `SET ${expressionParts.join(', ')}, updatedAt = :now`;
    const pk = `COM#${commerceId}`;
    const sk = `PRODUCT#${code}`;
    const result = await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: { PK: pk, SK: sk },
        UpdateExpression: updateExpression,
        ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
        ExpressionAttributeValues: expressionValues,
        ExpressionAttributeNames: Object.keys(expressionNames).length ? expressionNames : undefined,
        ReturnValues: 'ALL_NEW',
      }),
    );
    if (!result.Attributes) {
      throw new NotFoundError('Product not found');
    }
    const updatedItem = result.Attributes;
    const responseItem = sanitizeForRole(updatedItem, roles);
    return {
      statusCode: 200,
      body: JSON.stringify(responseItem),
    };
  } catch (err) {
    return buildErrorResponse(err);
  }
};