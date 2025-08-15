import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { BadRequestError, ForbiddenError, buildErrorResponse } from '../helpers/errors';
import { sanitizeForRole } from '../helpers/sanitizeForRole';
import { Product } from '../models/product';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Handler para crear un producto. Solo permite rol admin.
 */
export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
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
    const roles: any = claims['cognito:groups'];
    if (!roles?.includes('admin')) {
      throw new ForbiddenError('Only admin can create products');
    }
    if (!event.body) {
      throw new BadRequestError('Missing body');
    }
    const body = JSON.parse(event.body);
    const { code, name, priceBuy, priceSale, notes, uom, qtyStep, isActive } = body;
    if (!code || !name || priceBuy === undefined || priceSale === undefined || !uom || qtyStep === undefined) {
      throw new BadRequestError('Missing required fields');
    }
    const now = new Date().toISOString();
    const pk = `COM#${commerceId}`;
    const sk = `PRODUCT#${code}`;
    const item: Product = {
      PK: pk,
      SK: sk,
      commerceId,
      code,
      name,
      priceBuy,
      priceSale,
      notes,
      stock: 0,
      unitsSold: 0,
      revenue: 0,
      profit: 0,
      createdAt: now,
      updatedAt: now,
      uom,
      isActive: isActive !== undefined ? !!isActive : true,
      qtyStep,
    };
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      }),
    );
    // Sanitize for seller just in case; but here role is admin
    const responseItem = sanitizeForRole(item, roles);
    return {
      statusCode: 201,
      body: JSON.stringify(responseItem),
    };
  } catch (err) {
    return buildErrorResponse(err);
  }
};