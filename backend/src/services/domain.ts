import { Product } from '../models/product';
import { DiscountType, Offer, OfferScope } from '../models/offer';
import { PaymentMethod, Sale, SaleItem } from '../models/sale';
import { formatArtDay, formatArtHour, formatArtMonth } from './time';

export interface ProductRecordInput {
  commerceId: string;
  code: string;
  name: string;
  priceBuy: number;
  priceSale: number;
  stock: number;
  uom: string;
  notes?: string;
  isActive?: boolean;
  category?: string;
  brand?: string;
  minStock?: number;
  qtyStep?: number;
  createdAt: string;
  updatedAt?: string;
  lastSaleDate?: string;
}

export interface ProductPatchInput {
  name?: string;
  priceBuy?: number;
  priceSale?: number;
  stock?: number;
  notes?: string;
  uom?: string;
  qtyStep?: number;
  isActive?: boolean;
  category?: string;
  brand?: string;
  minStock?: number;
}

export interface OfferRecordInput {
  commerceId: string;
  offerId: string;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  startDate: string;
  endDate: string;
  scope: OfferScope;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
}

export interface OfferPatchInput {
  name?: string;
  discountType?: DiscountType;
  discountValue?: number;
  startDate?: string;
  endDate?: string;
  scope?: OfferScope;
}

export interface AppliedDiscount {
  discountApplied: number;
  finalPrice: number;
  offerName: string;
  offerId: string;
}

export interface DailySummaryDelta {
  totalDay: number;
  txCount: number;
  methodKey: string;
  hourKey: string;
}

export interface CashCloseTotals {
  systemTotalCash: number;
  systemTotalCard: number;
  systemTotalTransfer: number;
  systemTotalOther: number;
  expectedCash: number;
  difference: number;
}

const DEFAULT_MIN_STOCK = 0;

function shouldAlert(stock: number, minStock?: number): boolean {
  const effectiveMinStock = minStock ?? DEFAULT_MIN_STOCK;
  return effectiveMinStock > 0 && stock <= effectiveMinStock;
}

export function buildProductRecord(input: ProductRecordInput): Product {
  const createdAt = input.createdAt;
  const updatedAt = input.updatedAt ?? createdAt;
  const activeFlag = input.isActive ?? true;
  const minStock = input.minStock && input.minStock > 0 ? input.minStock : undefined;
  const stock = input.stock;
  const item: Product = {
    PK: `COM#${input.commerceId}`,
    SK: `PRODUCT#${input.code}`,
    commerceId: input.commerceId,
    code: input.code,
    name: input.name,
    priceBuy: input.priceBuy,
    priceSale: input.priceSale,
    notes: input.notes,
    stock,
    unitsSold: 0,
    revenue: 0,
    profit: 0,
    createdAt,
    updatedAt,
    lastSaleDate: input.lastSaleDate ?? createdAt,
    uom: input.uom,
    isActive: activeFlag,
    qtyStep: input.qtyStep ?? 1,
    category: input.category,
    brand: input.brand,
    GSI2PK: `COM#${input.commerceId}`,
    GSI2SK: `PRODUCT#${activeFlag ? 'true' : 'false'}#${updatedAt}`,
    minStock,
  };

  if (shouldAlert(stock, minStock)) {
    item.alertStatus = 'LOW';
  }

  return item;
}

export function patchProductRecord(
  existing: Product,
  patch: ProductPatchInput,
  updatedAt: string
): Product {
  const nextIsActive = patch.isActive ?? existing.isActive;
  const nextMinStock =
    patch.minStock !== undefined && patch.minStock > 0
      ? patch.minStock
      : patch.minStock === 0
        ? undefined
        : existing.minStock;
  const nextStock = patch.stock ?? existing.stock;
  const next: Product = {
    ...existing,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.priceBuy !== undefined ? { priceBuy: patch.priceBuy } : {}),
    ...(patch.priceSale !== undefined ? { priceSale: patch.priceSale } : {}),
    ...(patch.stock !== undefined ? { stock: patch.stock } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    ...(patch.uom !== undefined ? { uom: patch.uom } : {}),
    ...(patch.qtyStep !== undefined ? { qtyStep: patch.qtyStep } : {}),
    ...(patch.category !== undefined ? { category: patch.category } : {}),
    ...(patch.brand !== undefined ? { brand: patch.brand } : {}),
    ...(patch.minStock !== undefined ? { minStock: nextMinStock } : {}),
    isActive: nextIsActive,
    updatedAt,
    GSI2PK: `COM#${existing.commerceId}`,
    GSI2SK: `PRODUCT#${nextIsActive ? 'true' : 'false'}#${updatedAt}`,
  };

  if (shouldAlert(nextStock, nextMinStock)) {
    next.alertStatus = 'LOW';
  } else {
    delete next.alertStatus;
  }

  if (nextMinStock === undefined) {
    delete next.minStock;
  }

  return next;
}

export function buildOfferRecord(input: OfferRecordInput): Offer {
  return {
    PK: `COM#${input.commerceId}`,
    SK: `OFFER#${input.offerId}`,
    offerId: input.offerId,
    commerceId: input.commerceId,
    name: input.name.trim(),
    discountType: input.discountType,
    discountValue: input.discountValue,
    startDate: input.startDate,
    endDate: input.endDate,
    scope: input.scope,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt,
    createdBy: input.createdBy,
  };
}

export function patchOfferRecord(existing: Offer, patch: OfferPatchInput, updatedAt: string): Offer {
  return {
    ...existing,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.discountType !== undefined ? { discountType: patch.discountType } : {}),
    ...(patch.discountValue !== undefined ? { discountValue: patch.discountValue } : {}),
    ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
    ...(patch.endDate !== undefined ? { endDate: patch.endDate } : {}),
    ...(patch.scope !== undefined ? { scope: patch.scope } : {}),
    updatedAt,
  };
}

export function isOfferActiveAt(offer: Offer, iso: string): boolean {
  return iso >= offer.startDate && iso <= offer.endDate;
}

export function resolveDiscounts(
  offers: Offer[],
  items: SaleItem[],
  iso: string
): Map<string, AppliedDiscount> {
  const activeOffers = offers.filter((offer) => isOfferActiveAt(offer, iso));
  const discountMap = new Map<string, AppliedDiscount>();

  for (const item of items) {
    if (item.qty <= 0) {
      continue;
    }

    let bestDiscount = 0;
    let bestOffer: Offer | null = null;

    for (const offer of activeOffers) {
      let applies = false;

      switch (offer.scope.type) {
        case 'PRODUCT':
          applies = offer.scope.values.includes(item.code);
          break;
        case 'CATEGORY':
          applies = !!item.category && offer.scope.values.includes(item.category);
          break;
        case 'BRAND':
          applies = !!item.brand && offer.scope.values.includes(item.brand);
          break;
      }

      if (!applies) continue;

      let discount = 0;
      if (offer.discountType === 'PERCENTAGE') {
        discount = (item.priceSale * offer.discountValue) / 100;
      } else {
        discount = Math.min(offer.discountValue, item.priceSale);
      }

      if (discount > bestDiscount) {
        bestDiscount = discount;
        bestOffer = offer;
      }
    }

    if (bestOffer && bestDiscount > 0) {
      discountMap.set(item.code, {
        discountApplied: Math.round(bestDiscount * 100) / 100,
        finalPrice: Math.round((item.priceSale - bestDiscount) * 100) / 100,
        offerName: bestOffer.name,
        offerId: bestOffer.offerId,
      });
    }
  }

  return discountMap;
}

export function buildSaleRecord(input: {
  commerceId: string;
  saleId: string;
  sellerId: string;
  createdAt: string;
  items: SaleItem[];
  total: number;
  profit: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  retentionDays: number;
}): Sale {
  const day = formatArtDay(input.createdAt);
  return {
    PK: `COM#${input.commerceId}`,
    SK: `SALE#${input.createdAt}#${input.saleId}`,
    saleId: input.saleId,
    commerceId: input.commerceId,
    sellerId: input.sellerId,
    createdAt: input.createdAt,
    day,
    ttl: Math.floor(new Date(input.createdAt).getTime() / 1000) + input.retentionDays * 24 * 60 * 60,
    items: input.items,
    total: Math.round(input.total * 100) / 100,
    notes: input.notes,
    profit: Math.round(input.profit * 100) / 100,
    paymentMethod: input.paymentMethod,
    GSI1PK: `COM#${input.commerceId}#${day}`,
    GSI1SK: input.createdAt,
  };
}

export function buildDailySummaryDelta(
  createdAt: string,
  total: number,
  paymentMethod: PaymentMethod
): DailySummaryDelta {
  return {
    totalDay: total,
    txCount: 1,
    methodKey: `method_${paymentMethod}`,
    hourKey: `h${formatArtHour(createdAt)}`,
  };
}

export function computeCashCloseTotals(input: {
  sales: Sale[];
  declaredCash: number;
  expenses: number;
  initialFund: number;
}): CashCloseTotals {
  let systemTotalCash = 0;
  let systemTotalCard = 0;
  let systemTotalTransfer = 0;
  let systemTotalOther = 0;

  for (const sale of input.sales) {
    const paymentMethod = sale.paymentMethod ?? 'CASH';
    const total = sale.total || 0;
    switch (paymentMethod) {
      case 'CASH':
        systemTotalCash += total;
        break;
      case 'CARD':
        systemTotalCard += total;
        break;
      case 'TRANSFER':
        systemTotalTransfer += total;
        break;
      case 'OTHER':
        systemTotalOther += total;
        break;
    }
  }

  const expectedCash = systemTotalCash - input.expenses + input.initialFund;
  const difference = input.declaredCash - expectedCash;

  return {
    systemTotalCash,
    systemTotalCard,
    systemTotalTransfer,
    systemTotalOther,
    expectedCash,
    difference,
  };
}

export function monthFromIso(iso: string): string {
  return formatArtMonth(iso);
}
