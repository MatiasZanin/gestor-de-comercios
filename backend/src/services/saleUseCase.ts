import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { BadRequestError, NotFoundError } from '../helpers/errors';
import { logAudit } from '../helpers/auditLogger';
import { updateDailyStats } from '../helpers/updateDailyStats';
import { updateStock } from '../helpers/updateStock';
import { Offer } from '../models/offer';
import { PaymentMethod, Sale, SaleItem } from '../models/sale';
import {
  buildDailySummaryDelta,
  buildSaleRecord,
  resolveDiscounts,
} from './domain';
import { formatArtDay, formatArtMonth } from './time';

export interface CreateSaleUseCaseInput {
  commerceId: string;
  sellerId: string;
  userEmail?: string;
  items: SaleItem[];
  notes?: string;
  paymentMethod?: PaymentMethod;
  createdAt?: string;
  saleId?: string;
  retentionDays?: number;
  auditAt?: string;
  auditId?: string;
}

async function fetchOffersAt(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  commerceId: string
): Promise<Offer[]> {
  const pk = `COM#${commerceId}`;
  let offers: Offer[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ConsistentRead: true,
        ExpressionAttributeValues: {
          ':pk': pk,
          ':prefix': 'OFFER#',
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    offers = offers.concat((result.Items ?? []) as Offer[]);
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return offers;
}

async function updateDailySummary(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  commerceId: string,
  createdAt: string,
  total: number,
  paymentMethod: PaymentMethod
): Promise<void> {
  const delta = buildDailySummaryDelta(createdAt, total, paymentMethod);
  const day = formatArtDay(createdAt);

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
            ${delta.methodKey} :saleTotal,
            ${delta.hourKey} :one
      `,
      ExpressionAttributeValues: {
        ':one': 1,
        ':saleTotal': total,
      },
    })
  );
}

async function updateMonthlyRanking(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  commerceId: string,
  currentMonth: string,
  item: SaleItem,
  createdAt: string
): Promise<void> {
  if (item.code === '-1') {
    return;
  }

  const ttlSeconds = Math.floor(new Date(createdAt).getTime() / 1000) + 365 * 24 * 60 * 60;

  await docClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        PK: `COM#${commerceId}`,
        SK: `STAT#${currentMonth}#PRODUCT#${item.code}`,
      },
      UpdateExpression:
        'ADD monthlyUnits :qty SET statPK = :statPk, #name = :name, code = :code, uom = :uom, priceSale = :priceSale, #ttl = :ttl',
      ExpressionAttributeNames: {
        '#name': 'name',
        '#ttl': 'ttl',
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

function compactSaleItem(item: SaleItem): SaleItem {
  const compacted: SaleItem = {
    code: item.code,
    name: item.name,
    qty: item.qty,
    priceSale: item.priceSale,
    uom: item.uom,
  };

  if (item.priceBuy !== undefined) {
    compacted.priceBuy = item.priceBuy;
  }
  if (item.profit !== undefined) {
    compacted.profit = item.profit;
  }
  if (item.originalPrice !== undefined) {
    compacted.originalPrice = item.originalPrice;
  }
  if (item.discountApplied !== undefined) {
    compacted.discountApplied = item.discountApplied;
  }
  if (item.offerId !== undefined) {
    compacted.offerId = item.offerId;
  }
  if (item.offerName !== undefined) {
    compacted.offerName = item.offerName;
  }
  if (item.brand !== undefined) {
    compacted.brand = item.brand;
  }
  if (item.category !== undefined) {
    compacted.category = item.category;
  }

  return compacted;
}

export async function createSaleUseCase(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  input: CreateSaleUseCaseInput
): Promise<Sale> {
  if (!tableName) {
    throw new Error('TABLE_NAME env var is required');
  }

  if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
    throw new BadRequestError('items must be a non-empty array');
  }

  for (const item of input.items) {
    if (
      !item.code ||
      !item.name ||
      typeof item.qty !== 'number' ||
      item.qty === 0 ||
      item.priceSale === undefined ||
      !item.uom
    ) {
      throw new BadRequestError('Each item must include code, name, qty (non-zero), priceSale and uom');
    }
    if (item.priceBuy === undefined) {
      throw new BadRequestError('Each item must include priceBuy');
    }
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  const saleId = input.saleId ?? randomUUID();
  const retentionDays = input.retentionDays ?? 90;
  const paymentMethod = input.paymentMethod ?? 'CASH';
  const offers = await fetchOffersAt(docClient, tableName, input.commerceId);
  const discountMap = resolveDiscounts(offers, input.items, createdAt);

  let total = 0;
  let profit = 0;
  const saleItems: SaleItem[] = [];

  for (const originalItem of input.items) {
    const item = { ...originalItem };

    if (item.qty > 0) {
      const discount = discountMap.get(item.code);
      if (discount) {
        item.originalPrice = item.priceSale;
        item.discountApplied = discount.discountApplied;
        item.offerId = discount.offerId;
        item.offerName = discount.offerName;
        item.priceSale = discount.finalPrice;
      }
    }

    total += item.priceSale * item.qty;
    profit += (item.priceSale - (item.priceBuy || 0)) * item.qty;

    if (item.code !== '-1') {
      await updateStock(input.commerceId, item.code, item.qty, createdAt);
      await updateDailyStats(
        input.commerceId,
        item.code,
        item.qty,
        item.priceBuy!,
        item.priceSale,
        item.uom,
        createdAt
      );
      await updateMonthlyRanking(
        docClient,
        tableName,
        input.commerceId,
        formatArtMonth(createdAt),
        item,
        createdAt
      );
    }

    saleItems.push(compactSaleItem(item));
  }

  const sale = buildSaleRecord({
    commerceId: input.commerceId,
    saleId,
    sellerId: input.sellerId,
    createdAt,
    items: saleItems,
    total,
    profit,
    paymentMethod,
    notes: input.notes,
    retentionDays,
  });

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: sale,
    })
  );

  await updateDailySummary(docClient, tableName, input.commerceId, createdAt, total, paymentMethod);

  await logAudit(
    tableName,
    input.commerceId,
    input.sellerId,
    input.userEmail ?? '',
    'SALE_CREATE',
    { saleId, total, paymentMethod },
    input.auditAt ?? createdAt,
    input.auditId
  );

  return sale;
}
