import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createSaleUseCase } from '../../../services/saleUseCase';
import { PaymentMethod, SaleItem } from '../../../models/sale';
import {
  buildSeedSalesTimeline,
  saleIso,
  SeedDerivedSaleTemplate,
  SeedItemSpec,
  SeedSaleTemplate,
} from './scenario';
import {
  cleanAuditItemsByAction,
  cleanCommerceItems,
} from './runtime';
import { deterministicId, SEED_CONFIG, SEED_PRODUCTS } from './shared';

const TABLE_NAME = process.env.TABLE_NAME || 'GestionComercios-dev';
const COMMERCE_ID = SEED_CONFIG.commerceId;
const REGION = process.env.AWS_REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCT_BY_CODE = new Map(SEED_PRODUCTS.map((product) => [product.code, product]));

function buildSaleItem(spec: SeedItemSpec): SaleItem {
  if (spec.code === '-1') {
    return {
      code: '-1',
      name: spec.name ?? 'Otros',
      qty: spec.qty,
      priceBuy: spec.priceBuy ?? 0,
      priceSale: spec.priceSale ?? 0,
      uom: spec.uom ?? 'u',
      category: spec.category ?? 'Misceláneos',
      brand: spec.brand,
    };
  }

  const product = PRODUCT_BY_CODE.get(spec.code);
  if (!product) {
    throw new Error(`Seed product not found for code ${spec.code}`);
  }

  return {
    code: product.code,
    name: product.name,
    qty: spec.qty,
    priceBuy: product.priceBuy,
    priceSale: product.priceSale,
    uom: product.uom,
    category: product.category,
    brand: product.brand,
  };
}

function buildSaleItemsFromTemplate(template: SeedSaleTemplate): SaleItem[] {
  return template.items.map((item) => buildSaleItem(item));
}

function buildDerivedItems(template: SeedDerivedSaleTemplate, sourceSale: { items: SaleItem[] }): SaleItem[] {
  const selectedCodes = template.itemCodes?.length ? new Set(template.itemCodes) : undefined;
  const sourceItems = selectedCodes
    ? sourceSale.items.filter((item) => selectedCodes.has(item.code))
    : sourceSale.items;

  if (sourceItems.length === 0) {
    throw new Error(`No items available to derive sale ${template.saleId} from ${template.sourceSaleId}`);
  }

  return sourceItems.map((item) => ({
    ...item,
    qty: -Math.abs(item.qty),
  }));
}

async function cleanSeedArtifacts(): Promise<void> {
  await cleanCommerceItems(docClient, TABLE_NAME, COMMERCE_ID, 'SALE#');
  await cleanCommerceItems(docClient, TABLE_NAME, COMMERCE_ID, 'SUMMARY#');
  await cleanCommerceItems(docClient, TABLE_NAME, COMMERCE_ID, 'STAT#');
  await cleanAuditItemsByAction(docClient, TABLE_NAME, COMMERCE_ID, ['SALE_CREATE']);
}

async function createBaseSales(
  baseTemplates: SeedSaleTemplate[]
): Promise<Map<string, { items: SaleItem[]; paymentMethod: PaymentMethod }>> {
  const createdSales = new Map<string, { items: SaleItem[]; paymentMethod: PaymentMethod }>();

  for (const [index, template] of baseTemplates.entries()) {
    const createdAt = saleIso(template.day, template.hour, template.minute);
    const sale = await createSaleUseCase(docClient, TABLE_NAME, {
      commerceId: COMMERCE_ID,
      sellerId: template.sellerId,
      userEmail: SEED_CONFIG.seedActorEmail,
      items: buildSaleItemsFromTemplate(template),
      notes: template.notes,
      paymentMethod: template.paymentMethod,
      createdAt,
      saleId: template.saleId,
      retentionDays: SEED_CONFIG.retentionDays,
      auditAt: createdAt,
      auditId: deterministicId('audit-sale-create', index, template.saleId),
    });

    createdSales.set(template.saleId, {
      items: sale.items,
      paymentMethod: sale.paymentMethod ?? template.paymentMethod,
    });
  }

  return createdSales;
}

async function createDerivedSales(
  templates: SeedDerivedSaleTemplate[],
  kind: 'return' | 'cancellation',
  baseSales: Map<string, { items: SaleItem[]; paymentMethod: PaymentMethod }>
): Promise<void> {
  for (const [index, template] of templates.entries()) {
    const sourceSale = baseSales.get(template.sourceSaleId);
    if (!sourceSale) {
      throw new Error(`Source sale ${template.sourceSaleId} not found for ${template.saleId}`);
    }

    const createdAt = saleIso(template.day, template.hour, template.minute);
    const sale = await createSaleUseCase(docClient, TABLE_NAME, {
      commerceId: COMMERCE_ID,
      sellerId: template.sellerId,
      userEmail: SEED_CONFIG.seedActorEmail,
      items: buildDerivedItems(template, sourceSale),
      notes: `${template.notes} - ticket ${template.sourceSaleId}`,
      paymentMethod: sourceSale.paymentMethod ?? template.paymentMethod,
      createdAt,
      saleId: template.saleId,
      retentionDays: SEED_CONFIG.retentionDays,
      auditAt: createdAt,
      auditId: deterministicId(`audit-sale-${kind}`, index, template.saleId),
    });

    baseSales.set(template.saleId, {
      items: sale.items,
      paymentMethod: sale.paymentMethod ?? template.paymentMethod,
    });
  }
}

async function main(): Promise<void> {
  console.log(`Seeding sales for COM#${COMMERCE_ID}`);
  await cleanSeedArtifacts();

  const timeline = buildSeedSalesTimeline(SEED_CONFIG.salesStartDay, SEED_CONFIG.salesEndDay);
  const createdSales = await createBaseSales(timeline.baseSales);
  await createDerivedSales(timeline.returnSales, 'return', createdSales);
  await createDerivedSales(timeline.cancellationSales, 'cancellation', createdSales);

  console.log('Sales seed completed');
}

main().catch((error) => {
  console.error('Sales seed failed:', error);
  process.exitCode = 1;
});
