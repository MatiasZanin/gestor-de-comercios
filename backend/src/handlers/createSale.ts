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
import { assertCommerceAccess } from '../helpers/assertCommerceAccess';
import { updateDailyStats } from '../helpers/updateDailyStats';
import { updateStock } from '../helpers/updateStock';
import { logAudit } from '../helpers/auditLogger';
import { resolveOffers } from '../helpers/resolveOffers';
import { Sale, SaleItem } from '../models/sale';
import { formatJSONResponse } from '../utils/api-response';

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
  // Extraer la hora (0-23) en zona horaria Argentina
  const hour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: 'numeric', hour12: false,
    }).format(new Date(createdAt)),
    10
  );
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

/**
 * Write-Time Aggregation: Actualiza la estadística mensual de cada producto
 * para habilitar el "Ranking de Rotación Mensual" usando el GSI-Ranking-Mensual.
 * Crea items temporales con TTL de 365 días para auto-borrado.
 */
async function updateMonthlyRanking(
  tableName: string,
  commerceId: string,
  currentMonth: string,
  item: SaleItem
): Promise<void> {
  const ttlSeconds = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

  await docClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: `COM#${commerceId}`,
        SK: `STAT#${currentMonth}#PRODUCT#${item.code}`,
      },
      // 1. Cambiamos 'ttl = :ttl' por '#ttl = :ttl'
      UpdateExpression:
        'ADD monthlyUnits :qty SET statPK = :statPk, #name = :name, code = :code, uom = :uom, priceSale = :priceSale, #ttl = :ttl',
      ExpressionAttributeNames: {
        '#name': 'name',
        '#ttl': 'ttl', // 2. Definimos el alias aquí para evitar el conflicto
      },
      ExpressionAttributeValues: {
        ':qty': item.qty,
        ':statPk': `COM#${commerceId}#${currentMonth}`,
        ':name': item.name,
        ':code': item.code,
        ':uom': item.uom,
        ':priceSale': item.priceSale,
        ':ttl': ttlSeconds,
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

    // Validate user has access to this commerce
    assertCommerceAccess(event, commerceId);

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
        item.qty === 0 ||
        item.priceSale === undefined ||
        !item.uom
      ) {
        throw new BadRequestError(
          'Each item must include code, name, qty (non-zero), priceSale and uom'
        );
      }
      if (item.priceBuy === undefined) {
        throw new BadRequestError('Each item must include priceBuy');
      }
    }
    const now = new Date();
    const createdAt = now.toISOString();
    // Computar el día en zona horaria Argentina (UTC-3) para que las ventas
    // nocturnas (ej: 23:45 ART = 02:45 UTC+0) se asignen al día local correcto.
    const artParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now); // en-CA da formato "YYYY-MM-DD"
    const day = artParts;
    const saleId = randomUUID();

    // Resolver ofertas activas para los items de la venta
    const discountMap = await resolveOffers(commerceId, items, tableName);

    // Aplicar descuentos y calcular total y profit
    let total = 0;
    let profit = 0;
    for (const item of items) {
      const discount = discountMap.get(item.code);
      if (discount) {
        item.originalPrice = item.priceSale;
        item.discountApplied = discount.discountApplied;
        item.offerId = discount.offerId;
        item.offerName = discount.offerName;
        // El precio efectivo de venta es el precio con descuento
        item.priceSale = discount.finalPrice;
      }
      total += item.priceSale * item.qty;
      profit += (item.priceSale - (item.priceBuy || 0)) * item.qty;
    }
    // Mes actual para el ranking de rotación mensual (derivado del día local)
    const currentMonth = day.slice(0, 7); // "YYYY-MM"

    // Actualizar stock, stats históricas y ranking mensual para cada item
    // Nota: updateDailyStats y updateMonthlyRanking usan item.priceSale que ya está post-descuento
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
      // Write-Time Aggregation: Ranking de rotación mensual
      await updateMonthlyRanking(tableName, commerceId, currentMonth, item);
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

    const userId = claims.sub as string;
    const userEmail = (claims.email as string) || '';
    await logAudit(tableName, commerceId, userId, userEmail, 'SALE_CREATE', {
      saleId, total, paymentMethod: body.paymentMethod,
    });

    const response = sanitizeForRole(sale, roles);
    return formatJSONResponse(response, 201);
  } catch (err) {
    return buildErrorResponse(err);
  }
};
