import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { randomUUID } from 'crypto';
import {
  BadRequestError,
  ForbiddenError,
  buildErrorResponse,
} from '../helpers/errors';
import { sanitizeForRole } from '../helpers/sanitizeForRole';
import { updateDailyStats } from '../helpers/updateDailyStats';
import { updateStock } from '../helpers/updateStock';
import { Sale, SaleItem } from '../models/sale';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const tableName = process.env.TABLE_NAME;
    const retentionDays = parseInt(process.env.RETENTION_DAYS || '90', 10);
    if (!tableName) {
      throw new Error('TABLE_NAME env var is required');
    }
    const commerceId = event.pathParameters?.commerceId;
    if (!commerceId) {
      throw new BadRequestError('Missing commerceId');
    }
    const claims = (event.requestContext.authorizer as any)?.jwt?.claims ?? {};
    const roles: string[] | undefined = claims['cognito:groups'];
    if (
      !roles ||
      (roles.includes('admin') === false &&
        roles.includes('vendedor') === false)
    ) {
      throw new ForbiddenError('Not authorized to create sales');
    }
    if (!event.body) {
      throw new BadRequestError('Missing body');
    }
    const body = JSON.parse(event.body);
    const items: SaleItem[] = body.items;
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestError('items must be a non-empty array');
    }
    // Validar campos de cada item
    for (const item of items) {
      if (
        !item.code ||
        !item.name ||
        typeof item.qty !== 'number' ||
        item.priceSale === undefined
      ) {
        throw new BadRequestError(
          'Each item must include code, name, qty and priceSale'
        );
      }
      if (item.priceBuy === undefined) {
        throw new BadRequestError('Each item must include priceBuy');
      }
    }
    const createdAt = new Date().toISOString();
    const day = createdAt.slice(0, 10);
    const saleId = randomUUID();
    // Calcular total y profit
    let total = 0;
    let profit = 0;
    for (const item of items) {
      total += item.priceSale * item.qty;
      profit += (item.priceSale - (item.priceBuy || 0)) * item.qty;
    }
    // Actualizar stock y stats para cada item
    for (const item of items) {
      await updateStock(commerceId, item.code, item.qty);
      await updateDailyStats(
        commerceId,
        item.code,
        item.qty,
        item.priceBuy!,
        item.priceSale
      );
    }
    const ttlSeconds =
      Math.floor(Date.now() / 1000) + retentionDays * 24 * 60 * 60;
    const pk = `COM#${commerceId}`;
    const isoDate = createdAt;
    const sk = `SALE#${isoDate}#${saleId}`;
    const sale: Sale = {
      PK: pk,
      SK: sk,
      saleId,
      commerceId,
      sellerId: claims.sub || 'unknown',
      createdAt,
      day,
      ttl: ttlSeconds,
      items,
      total,
      notes: body.notes,
      profit,
    };
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: sale,
      })
    );
    const response = sanitizeForRole(sale, roles);
    return {
      statusCode: 201,
      body: JSON.stringify(response),
    };
  } catch (err) {
    return buildErrorResponse(err);
  }
};
