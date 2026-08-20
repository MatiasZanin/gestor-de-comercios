import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { buildOfferRecord, buildProductRecord, patchOfferRecord, patchProductRecord } from '../../../services/domain';
import { DEFAULT_SCALE_BARCODE_CONFIG } from '../../../models/commerce';
import { logAudit } from '../../auditLogger';
import {
  addDaysToDay,
  dayToIso,
  deterministicId,
  resolveSeedProductStock,
  SEED_CONFIG,
  SEED_PRODUCTS,
} from './shared';
import { cleanCommerceItems, chunkArray } from './runtime';
import { buildSeedOffers } from './scenario';

const TABLE_NAME = process.env.TABLE_NAME || 'GestionComercios-dev';
const COMMERCE_ID = SEED_CONFIG.commerceId;
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function seedCommerceProfile(): Promise<void> {
  const now = SEED_CONFIG.productCreatedAt;
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `COM#${COMMERCE_ID}`,
        SK: 'PROFILE',
        type: 'COMMERCE',
        commerceId: COMMERCE_ID,
        merchantName: 'G&S Comercio Demo',
        ownerCognitoSub: SEED_CONFIG.seedActorId,
        ownerEmail: SEED_CONFIG.seedActorEmail,
        scaleBarcodeConfig: DEFAULT_SCALE_BARCODE_CONFIG,
        createdAt: now,
        updatedAt: now,
      },
    })
  );
}

async function seedMetadata(): Promise<void> {
  const categories = [...new Set(SEED_PRODUCTS.map((product) => product.category).filter(Boolean))] as string[];

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `COM#${COMMERCE_ID}`,
        SK: 'METADATA#CONFIG',
        categories,
        iva_rates: [0, 10.5, 21, 27],
      },
    })
  );
}

async function seedProducts(): Promise<void> {
  const createdAt = SEED_CONFIG.productCreatedAt;
  const productRequests = SEED_PRODUCTS.map((spec) => {
    const stock = resolveSeedProductStock(spec);
    const item = buildProductRecord({
      commerceId: COMMERCE_ID,
      code: spec.code,
      name: spec.name,
      priceBuy: spec.priceBuy,
      priceSale: spec.priceSale,
      stock,
      uom: spec.uom,
      notes: spec.notes,
      isActive: spec.isActive,
      category: spec.category,
      brand: spec.brand,
      minStock: spec.minStock,
      qtyStep: spec.qtyStep,
      createdAt,
      updatedAt: createdAt,
      lastSaleDate: createdAt,
    });

    return {
      PutRequest: {
        Item: item,
      },
    };
  });

  for (const batch of chunkArray(productRequests, 25)) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: batch,
        },
      })
    );
  }

  for (const [index, spec] of SEED_PRODUCTS.entries()) {
    await logAudit(
      TABLE_NAME,
      COMMERCE_ID,
      SEED_CONFIG.seedActorId,
      SEED_CONFIG.seedActorEmail,
      'PRODUCT_CREATE',
      { code: spec.code, name: spec.name },
      createdAt,
      deterministicId('audit-product-create', index)
    );
  }
}

async function applyProductTweaks(): Promise<void> {
  const tweakDay1 = addDaysToDay(SEED_CONFIG.salesStartDay, 5);
  const tweakDay2 = addDaysToDay(SEED_CONFIG.salesStartDay, 28);
  const tweakDay3 = addDaysToDay(SEED_CONFIG.salesStartDay, 47);
  const tweaks = [
    {
      code: 'FRE-MANTECA-200',
      patch: { priceSale: 1410, minStock: 5, notes: 'Ajuste de precio para rotación baja' },
      at: dayToIso(tweakDay1, 10, 0),
    },
    {
      code: 'BEB-COCA-1500',
      patch: { priceSale: 2250, notes: 'Ajuste de precio de temporada' },
      at: dayToIso(tweakDay2, 11, 0),
    },
    {
      code: 'ALM-AZUCAR-1',
      patch: { minStock: 8, notes: 'Stock mínimo ajustado' },
      at: dayToIso(tweakDay3, 9, 0),
    },
  ];

  for (const [index, tweak] of tweaks.entries()) {
    const existing = SEED_PRODUCTS.find((spec) => spec.code === tweak.code);
    if (!existing) {
      continue;
    }

    const baseItem = buildProductRecord({
      commerceId: COMMERCE_ID,
      code: existing.code,
      name: existing.name,
      priceBuy: existing.priceBuy,
      priceSale: existing.priceSale,
      stock: existing.stock,
      uom: existing.uom,
      notes: existing.notes,
      isActive: existing.isActive,
      category: existing.category,
      brand: existing.brand,
      minStock: existing.minStock,
      qtyStep: existing.qtyStep,
      createdAt: SEED_CONFIG.productCreatedAt,
      updatedAt: SEED_CONFIG.productCreatedAt,
      lastSaleDate: SEED_CONFIG.productCreatedAt,
    });

    const nextItem = patchProductRecord(baseItem, tweak.patch, tweak.at);

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: nextItem,
      })
    );

    await logAudit(
      TABLE_NAME,
      COMMERCE_ID,
      SEED_CONFIG.seedActorId,
      SEED_CONFIG.seedActorEmail,
      'PRODUCT_UPDATE',
      { code: tweak.code, changes: tweak.patch },
      tweak.at,
      deterministicId('audit-product-update', index)
    );
  }
}

async function seedOffers(): Promise<void> {
  const offers = buildSeedOffers(SEED_CONFIG.salesStartDay, SEED_CONFIG.salesEndDay);

  for (const [index, spec] of offers.entries()) {
    const item = buildOfferRecord({
      commerceId: COMMERCE_ID,
      offerId: spec.offerId,
      name: spec.name,
      discountType: spec.discountType,
      discountValue: spec.discountValue,
      startDate: spec.startDate,
      endDate: spec.endDate,
      scope: spec.scope,
      createdAt: spec.createdAt,
      updatedAt: spec.createdAt,
      createdBy: SEED_CONFIG.seedActorId,
    });

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );

    await logAudit(
      TABLE_NAME,
      COMMERCE_ID,
      SEED_CONFIG.seedActorId,
      SEED_CONFIG.seedActorEmail,
      'OFFER_CREATE',
      {
        offerId: spec.offerId,
        name: spec.name,
        discountType: spec.discountType,
        discountValue: spec.discountValue,
      },
      spec.createdAt,
      deterministicId('audit-offer-create', index)
    );
  }
}

async function applyOfferTweaks(): Promise<void> {
  const offers = buildSeedOffers(SEED_CONFIG.salesStartDay, SEED_CONFIG.salesEndDay);
  const offerTweaks = [
    {
      offerId: 'offer-kiosco-cierre',
      patch: { discountValue: 60 },
      at: dayToIso(addDaysToDay(SEED_CONFIG.salesStartDay, 84), 9, 0),
      action: 'OFFER_UPDATE' as const,
    },
    {
      offerId: 'offer-bebidas-verano',
      patch: { endDate: dayToIso(addDaysToDay(SEED_CONFIG.salesStartDay, 22), 23, 59, 59, 999) },
      at: dayToIso(addDaysToDay(SEED_CONFIG.salesStartDay, 22), 10, 0),
      action: 'OFFER_FINISH' as const,
    },
  ];

  for (const [index, tweak] of offerTweaks.entries()) {
    const existing = offers.find((spec) => spec.offerId === tweak.offerId);
    if (!existing) {
      continue;
    }

    const baseItem = buildOfferRecord({
      commerceId: COMMERCE_ID,
      offerId: existing.offerId,
      name: existing.name,
      discountType: existing.discountType,
      discountValue: existing.discountValue,
      startDate: existing.startDate,
      endDate: existing.endDate,
      scope: existing.scope,
      createdAt: existing.createdAt,
      updatedAt: existing.createdAt,
      createdBy: SEED_CONFIG.seedActorId,
    });

    const nextItem = patchOfferRecord(baseItem, tweak.patch, tweak.at);

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: nextItem,
      })
    );

    await logAudit(
      TABLE_NAME,
      COMMERCE_ID,
      SEED_CONFIG.seedActorId,
      SEED_CONFIG.seedActorEmail,
      tweak.action,
      tweak.action === 'OFFER_FINISH'
        ? { offerId: tweak.offerId, finishedAt: tweak.at }
        : { offerId: tweak.offerId, changes: tweak.patch },
      tweak.at,
      deterministicId(`audit-${tweak.action.toLowerCase()}`, index)
    );
  }
}

async function main(): Promise<void> {
  console.log(`Seeding base data for COM#${COMMERCE_ID}`);
  await cleanCommerceItems(docClient, TABLE_NAME, COMMERCE_ID);
  await seedCommerceProfile();
  await seedMetadata();
  await seedProducts();
  await applyProductTweaks();
  await seedOffers();
  await applyOfferTweaks();
  console.log('Base seed completed');
}

main().catch((error) => {
  console.error('Seed init failed:', error);
  process.exitCode = 1;
});
