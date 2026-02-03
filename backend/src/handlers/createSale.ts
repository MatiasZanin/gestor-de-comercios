import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
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

type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';

/**
 * Actualiza atómicamente el registro de resumen diario (SUMMARY#YYYY-MM-DD)
 * para habilitar reportes instantáneos de "Mapa de Calor" y "Arqueo de Caja".
 * Usa ADD para operaciones atómicas y concurrentes-safe.
 */
async function updateDailySummary(
  tableName: string,
  commerceId: string,
  day: string,
  createdAt: string,
  total: number,
  paymentMethod: PaymentMethod
): Promise<void> {
  // Extraer la hora (0-23) del timestamp ISO
  const hour = new Date(createdAt).getHours();
  const hourKey = `h${hour}`;

  // Determinar el key del método de pago
  const methodKey = `method_${paymentMethod}`;

  await docClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: `COM#${commerceId}`,
        SK: `SUMMARY#${day}`,
      },
      UpdateExpression: `
        ADD txCount :one,
            totalDay :saleTotal,
            ${methodKey} :saleTotal,
            ${hourKey} :one
      `,
      ExpressionAttributeValues: {
        ':one': 1,
        ':saleTotal': total,
      },
    })
  );
}

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
        item.priceSale === undefined ||
        !item.uom
      ) {
        throw new BadRequestError(
          'Each item must include code, name, qty, priceSale and uom'
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
        item.priceSale,
        item.uom
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
      paymentMethod: body.paymentMethod,
      // 👉 clave para el GSI
      GSI1PK: `COM#${commerceId}#${day}`,
      GSI1SK: createdAt, // opcional: para ordenar por fecha
    };
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: sale,
      })
    );

    // Write-Time Aggregation: Actualizar resumen diario para reportes instantáneos
    await updateDailySummary(
      tableName,
      commerceId,
      day,
      createdAt,
      total,
      body.paymentMethod as PaymentMethod
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
