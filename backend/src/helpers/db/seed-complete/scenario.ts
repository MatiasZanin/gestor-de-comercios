import { DiscountType, OfferScope } from '../../../models/offer';
import { PaymentMethod } from '../../../models/sale';
import {
  addDaysToDay,
  createSeedPrng,
  dayToIso,
  enumerateDays,
  SEED_CONFIG,
  SEED_PRODUCTS,
} from './shared';

export interface SeedItemSpec {
  code: string;
  qty: number;
  name?: string;
  priceBuy?: number;
  priceSale?: number;
  uom?: string;
  category?: string;
  brand?: string;
}

export interface SeedSaleTemplate {
  saleId: string;
  day: string;
  hour: number;
  minute: number;
  sellerId: string;
  paymentMethod: PaymentMethod;
  notes: string;
  items: SeedItemSpec[];
}

export interface SeedDerivedSaleTemplate {
  saleId: string;
  day: string;
  hour: number;
  minute: number;
  sellerId: string;
  paymentMethod: PaymentMethod;
  notes: string;
  sourceSaleId: string;
  itemCodes?: string[];
}

export interface SeedClosureTemplate {
  day: string;
  hour: number;
  minute: number;
  initialFund: number;
  expenses: number;
  difference: number;
  notes: string;
}

export interface SeedOfferSpec {
  offerId: string;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  startDate: string;
  endDate: string;
  scope: OfferScope;
  createdAt: string;
}

export interface SeedOfferDraft {
  offerId: string;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  startOffsetDays: number;
  endOffsetDays: number;
  scope: OfferScope;
  createdOffsetDays: number;
}

const SELLABLE_PRODUCTS = SEED_PRODUCTS.filter((product) => product.code !== '-1' && product.stock > 0);
const SELLABLE_CODES = SELLABLE_PRODUCTS.map((product) => product.code);
const PRODUCT_BY_CODE = new Map(SEED_PRODUCTS.map((product) => [product.code, product]));
const SELLERS = ['seed-caja-1', 'seed-caja-2', 'seed-caja-3'];

function pick<T>(items: T[], prng: () => number): T {
  if (items.length === 0) {
    throw new Error('Cannot pick from an empty collection');
  }

  return items[Math.floor(prng() * items.length)] ?? items[0];
}

function uniqueSample<T>(items: T[], count: number, prng: () => number): T[] {
  const pool = [...items];
  const selected: T[] = [];

  while (pool.length > 0 && selected.length < count) {
    const index = Math.floor(prng() * pool.length);
    const [item] = pool.splice(index, 1);
    selected.push(item);
  }

  return selected;
}

function activeOffersAt(offers: SeedOfferSpec[], createdAt: string): SeedOfferSpec[] {
  return offers.filter((offer) => createdAt >= offer.startDate && createdAt <= offer.endDate);
}

function buildOfferWindow(
  offerId: string,
  name: string,
  discountType: DiscountType,
  discountValue: number,
  scope: OfferScope,
  startOffsetDays: number,
  endOffsetDays: number,
  createdOffsetDays: number
): SeedOfferDraft {
  return {
    offerId,
    name,
    discountType,
    discountValue,
    startOffsetDays,
    endOffsetDays,
    createdOffsetDays,
    scope,
  };
}

function toOfferSpec(draft: SeedOfferDraft, startDay: string, endDay: string): SeedOfferSpec {
  const startDate = dayToIso(addDaysToDay(startDay, draft.startOffsetDays), 0, 0, 0, 0);
  const endCandidate = addDaysToDay(startDay, draft.endOffsetDays);
  const createdDay = addDaysToDay(startDay, draft.createdOffsetDays);
  const effectiveEndDay = endCandidate > endDay ? endDay : endCandidate;

  return {
    offerId: draft.offerId,
    name: draft.name,
    discountType: draft.discountType,
    discountValue: draft.discountValue,
    startDate,
    endDate: dayToIso(effectiveEndDay, 23, 59, 59, 999),
    scope: draft.scope,
    createdAt: dayToIso(createdDay, 8, 30, 0, 0),
  };
}

function getProduct(code: string) {
  const product = PRODUCT_BY_CODE.get(code);
  if (!product) {
    throw new Error(`Seed product not found for code ${code}`);
  }
  return product;
}

function buildQty(code: string, prng: () => number): number {
  const product = getProduct(code);
  const step = product.qtyStep ?? 1;

  if (step < 1) {
    const multiplier = prng() < 0.7 ? 1 : 2;
    return Math.round(step * multiplier * 100) / 100;
  }

  const multiplier = prng() < 0.75 ? 1 : 2;
  return Math.round(step * multiplier * 100) / 100;
}

function saleTime(dayIndex: number, slotIndex: number, totalSlots: number, prng: () => number): { hour: number; minute: number } {
  const minHour = 9;
  const maxHour = 21;
  const windowMinutes = (maxHour - minHour) * 60;
  const bucket = Math.floor((slotIndex / Math.max(totalSlots, 1)) * windowMinutes);
  const jitter = Math.floor(prng() * 35);
  const minuteOfDay = Math.min(windowMinutes - 1, bucket + jitter + dayIndex % 17);
  const hour = minHour + Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;

  return { hour, minute };
}

function lateSaleTime(dayIndex: number, slotIndex: number, totalSlots: number, prng: () => number): { hour: number; minute: number } {
  const minHour = 16;
  const maxHour = 20;
  const windowMinutes = (maxHour - minHour) * 60;
  const bucket = Math.floor((slotIndex / Math.max(totalSlots, 1)) * windowMinutes);
  const jitter = Math.floor(prng() * 20);
  const minuteOfDay = Math.min(windowMinutes - 1, bucket + jitter + (dayIndex % 9));
  const hour = minHour + Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;

  return { hour, minute };
}

function buildTargetedCodes(offers: SeedOfferSpec[]): string[] {
  const codes = new Set<string>();

  for (const offer of offers) {
    switch (offer.scope.type) {
      case 'PRODUCT':
        for (const code of offer.scope.values) {
          codes.add(code);
        }
        break;
      case 'CATEGORY':
        for (const product of SELLABLE_PRODUCTS) {
          if (product.category && offer.scope.values.includes(product.category)) {
            codes.add(product.code);
          }
        }
        break;
      case 'BRAND':
        for (const product of SELLABLE_PRODUCTS) {
          if (product.brand && offer.scope.values.includes(product.brand)) {
            codes.add(product.code);
          }
        }
        break;
    }
  }

  return [...codes];
}

function buildPositiveItems(day: string, prng: () => number, offers: SeedOfferSpec[], saleIndex: number): SeedItemSpec[] {
  const activeOffers = activeOffersAt(offers, dayToIso(day, 12, 0, 0, 0));
  const targetedCodes = buildTargetedCodes(activeOffers);
  const itemCount = 1 + Math.floor(prng() * 3);
  const wantsCustomItem = prng() < 0.2;
  const items: SeedItemSpec[] = [];
  const usedCodes = new Set<string>();

  for (let i = 0; i < itemCount; i += 1) {
    let code = pick(SELLABLE_CODES, prng);

    if (i === 0 && targetedCodes.length > 0 && prng() < 0.8) {
      code = pick(targetedCodes, prng);
    }

    let guard = 0;
    while (usedCodes.has(code) && guard < SELLABLE_CODES.length) {
      code = pick(SELLABLE_CODES, prng);
      guard += 1;
    }

    usedCodes.add(code);
    const product = getProduct(code);
    items.push({
      code,
      qty: buildQty(code, prng),
      brand: product.brand,
      category: product.category,
    });
  }

  if (wantsCustomItem && items.length < 3) {
    items.push({
      code: '-1',
      qty: 1,
      name: saleIndex % 2 === 0 ? 'Servicio de envío' : 'Recargo manual',
      priceBuy: 0,
      priceSale: saleIndex % 2 === 0 ? 180 : 120,
      uom: 'u',
      category: 'Misceláneos',
    });
  }

  return items;
}

function buildDerivedItems(sourceItems: SeedItemSpec[], prng: () => number, partial: boolean): SeedItemSpec[] {
  const nonCustomItems = sourceItems.filter((item) => item.code !== '-1');
  if (nonCustomItems.length === 0) {
    throw new Error('Cannot derive return or cancellation from a ticket without sellable items');
  }

  const baseItems = partial
    ? uniqueSample(nonCustomItems, Math.min(nonCustomItems.length, 1 + Math.floor(prng() * Math.min(2, nonCustomItems.length))), prng)
    : nonCustomItems;

  return baseItems.map((item) => ({
    ...item,
    qty: -Math.abs(item.qty),
  }));
}

function choosePaymentMethod(dayIndex: number, saleIndex: number, prng: () => number): PaymentMethod {
  const seeded = (dayIndex + saleIndex + Math.floor(prng() * 11)) % 4;
  return ['CASH', 'CARD', 'TRANSFER', 'OTHER'][seeded] as PaymentMethod;
}

function chooseSourceSale(
  ledger: Array<{
    saleId: string;
    day: string;
    createdAt: string;
    sellerId: string;
    paymentMethod: PaymentMethod;
    items: SeedItemSpec[];
  }>,
  currentDay: string,
  prng: () => number
) {
  const currentDayStart = dayToIso(currentDay, 0, 0, 0, 0);
  const candidates = ledger.filter(
    (sale) => sale.createdAt < currentDayStart && sale.items.some((item) => item.code !== '-1')
  );

  if (candidates.length === 0) {
    return undefined;
  }

  return pick(candidates, prng);
}

export function buildSeedOffers(startDay: string, endDay: string): SeedOfferSpec[] {
  const drafts = [
    buildOfferWindow(
      'offer-bebidas-verano',
      'Bebidas verano',
      'PERCENTAGE',
      12,
      { type: 'CATEGORY', values: ['Bebidas'] },
      0,
      24,
      0
    ),
    buildOfferWindow(
      'offer-yerba-lanzamiento',
      'Yerba lanzamiento',
      'FIXED',
      250,
      { type: 'PRODUCT', values: ['ALM-YERBA-500', 'ALM-YERBA-1000'] },
      10,
      46,
      8
    ),
    buildOfferWindow(
      'offer-perfumeria-foco',
      'Perfumería foco',
      'PERCENTAGE',
      15,
      { type: 'CATEGORY', values: ['Perfumería'] },
      20,
      40,
      18
    ),
    buildOfferWindow(
      'offer-limpieza-activa',
      'Limpieza activa',
      'PERCENTAGE',
      10,
      { type: 'CATEGORY', values: ['Limpieza'] },
      35,
      70,
      30
    ),
    buildOfferWindow(
      'offer-coca-brand',
      'Coca promo',
      'PERCENTAGE',
      10,
      { type: 'BRAND', values: ['Coca-Cola'] },
      58,
      82,
      55
    ),
    buildOfferWindow(
      'offer-kiosco-cierre',
      'Kiosco combo',
      'FIXED',
      50,
      { type: 'CATEGORY', values: ['Kiosco'] },
      75,
      92,
      72
    ),
  ];

  return drafts.map((draft) => toOfferSpec(draft, startDay, endDay));
}

export function buildSeedSalesTimeline(startDay: string, endDay: string): {
  baseSales: SeedSaleTemplate[];
  returnSales: SeedDerivedSaleTemplate[];
  cancellationSales: SeedDerivedSaleTemplate[];
} {
  const offers = buildSeedOffers(startDay, endDay);
  const days = enumerateDays(startDay, endDay);
  const prng = createSeedPrng(`${SEED_CONFIG.seedName}:${startDay}:${endDay}:sales`);
  const baseSales: SeedSaleTemplate[] = [];
  const returnSales: SeedDerivedSaleTemplate[] = [];
  const cancellationSales: SeedDerivedSaleTemplate[] = [];
  const ledger: Array<{
    saleId: string;
    day: string;
    createdAt: string;
    sellerId: string;
    paymentMethod: PaymentMethod;
    items: SeedItemSpec[];
  }> = [];
  let saleSerial = 1;
  let returnSerial = 1;
  let cancellationSerial = 1;

  for (const [dayIndex, day] of days.entries()) {
    const totalSales = 1 + Math.floor(prng() * prng() * SEED_CONFIG.defaultMaxSalesPerDay);
    const canDerive = dayIndex > 6 && totalSales > 1 && ledger.length > 0;
    const returnCount = canDerive && dayIndex % 9 === 0 ? 1 : 0;
    const cancellationCount = canDerive && dayIndex % 17 === 0 ? 1 : 0;
    const positiveCount = Math.max(1, totalSales - returnCount - cancellationCount);
    const activeOffers = activeOffersAt(offers, dayToIso(day, 12, 0, 0, 0));

    for (let saleIndex = 0; saleIndex < positiveCount; saleIndex += 1) {
      const { hour, minute } = saleTime(dayIndex, saleIndex, positiveCount, prng);
      const sellerId = pick(SELLERS, prng);
      const paymentMethod = choosePaymentMethod(dayIndex, saleIndex, prng);
      const items = buildPositiveItems(day, prng, activeOffers, saleIndex);
      const saleId = `TK-${day.split('-').join('')}-${String(saleSerial).padStart(3, '0')}`;

      baseSales.push({
        saleId,
        day,
        hour,
        minute,
        sellerId,
        paymentMethod,
        notes: items.some((item) => item.code === '-1')
          ? 'Venta con producto custom y promociones activas'
          : saleIndex % 2 === 0
            ? 'Venta de mostrador'
            : 'Venta de rotación diaria',
        items,
      });

      ledger.push({
        saleId,
        day,
        createdAt: saleIso(day, hour, minute),
        sellerId,
        paymentMethod,
        items,
      });

      saleSerial += 1;
    }

    if (returnCount > 0) {
      const sourceSale = chooseSourceSale(ledger, day, prng);
      if (sourceSale) {
        const { hour, minute } = lateSaleTime(dayIndex, 0, returnCount, prng);
        const saleId = `TK-${day.split('-').join('')}-R${String(returnSerial).padStart(3, '0')}`;
        const sourceItems = buildDerivedItems(sourceSale.items, prng, true);
        returnSales.push({
          saleId,
          day,
          hour,
          minute,
          sellerId: sourceSale.sellerId,
          paymentMethod: sourceSale.paymentMethod,
          notes: `Devolución parcial por ticket ${sourceSale.saleId}`,
          sourceSaleId: sourceSale.saleId,
          itemCodes: sourceItems.map((item) => item.code),
        });
        returnSerial += 1;
      }
    }

    if (cancellationCount > 0) {
      const sourceSale = chooseSourceSale(ledger, day, prng);
      if (sourceSale) {
        const { hour, minute } = lateSaleTime(dayIndex, 1, cancellationCount + 1, prng);
        const saleId = `TK-${day.split('-').join('')}-C${String(cancellationSerial).padStart(3, '0')}`;
        cancellationSales.push({
          saleId,
          day,
          hour,
          minute,
          sellerId: sourceSale.sellerId,
          paymentMethod: sourceSale.paymentMethod,
          notes: `Anulación por ticket ${sourceSale.saleId}`,
          sourceSaleId: sourceSale.saleId,
        });
        cancellationSerial += 1;
      }
    }
  }

  return {
    baseSales,
    returnSales,
    cancellationSales,
  };
}

export function buildSeedClosures(startDay: string, endDay: string): SeedClosureTemplate[] {
  const days = enumerateDays(startDay, addDaysToDay(endDay, -1));
  const prng = createSeedPrng(`${SEED_CONFIG.seedName}:${startDay}:${endDay}:closures`);
  const differencePattern = [-80, -35, 0, 40, 75, 120, -20, 55];

  return days.map((day, index) => ({
    day,
    hour: 23,
    minute: 45 + (index % 10),
    initialFund: SEED_CONFIG.defaultInitialFund + (index % 4) * 250,
    expenses: SEED_CONFIG.defaultExpensesMin + Math.floor(prng() * (SEED_CONFIG.defaultExpensesMax - SEED_CONFIG.defaultExpensesMin)),
    difference: differencePattern[index % differencePattern.length],
    notes:
      index % 3 === 0
        ? 'Cierre diario con remanente positivo'
        : index % 3 === 1
          ? 'Cierre diario con faltante leve'
          : 'Cierre diario equilibrado',
  }));
}

export function closureIso(template: SeedClosureTemplate): string {
  return dayToIso(template.day, template.hour, template.minute, 0, 0);
}

export function saleIso(day: string, hour: number, minute: number): string {
  return dayToIso(day, hour, minute, 0, 0);
}
