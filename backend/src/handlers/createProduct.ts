import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import {
  BadRequestError,
  ForbiddenError,
  buildErrorResponse,
} from '../helpers/errors';
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';
import { sanitizeForRole } from '../helpers/sanitizeForRole';
import { addCategory } from '../helpers/addCategory';
import { logAudit } from '../helpers/auditLogger';
import { Product } from '../models/product';
import { formatJSONResponse } from '../utils/api-response';
import { buildProductRecord } from '../services/domain';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Handler para crear un producto. Solo permite rol admin.
 */
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

    // Validate user has access to this commerce
    assertCommerceAccess(event, commerceId);

    const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
    const roles: any = claims['cognito:groups'];
    if (!roles?.includes('admin')) {
      throw new ForbiddenError('Only admin can create products');
    }
    if (!event.body) {
      throw new BadRequestError('Missing body');
    }
    const body = JSON.parse(event.body);
    const { code, name, priceBuy, priceSale, notes, uom, stock, isActive, category, brand, minStock } =
      body;
    if (
      !code ||
      !name ||
      priceBuy === undefined ||
      priceSale === undefined ||
      !uom ||
      stock === undefined
    ) {
      throw new BadRequestError('Missing required fields');
    }
    const now = new Date().toISOString();
    const item: Product = buildProductRecord({
      commerceId,
      code,
      name,
      priceBuy,
      priceSale,
      notes,
      stock,
      uom,
      isActive: isActive !== undefined ? !!isActive : true,
      category: category || undefined,
      brand: brand || undefined,
      minStock,
      qtyStep: body.qtyStep || 1,
      createdAt: now,
      updatedAt: now,
      lastSaleDate: now,
    });
    // Si se proporciona una categoría, agregarla a METADATA#CONFIG si no existe
    if (category) {
      await addCategory(tableName, commerceId, category);
    }
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
        ConditionExpression:
          'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      })
    );

    const userId = claims.sub as string;
    const userEmail = (claims.email as string) || '';
    await logAudit(tableName, commerceId, userId, userEmail, 'PRODUCT_CREATE', { code, name });

    // Sanitize for seller just in case; but here role is admin
    const responseItem = sanitizeForRole(item, roles);
    return formatJSONResponse(responseItem, 201);
  } catch (err) {
    return buildErrorResponse(err);
  }
};
