import { createHash } from 'crypto';
import { DiscountType, OfferScope } from '../../../models/offer';
import { formatArtDay } from '../../../services/time';

const SEED_TODAY_DAY = formatArtDay(new Date().toISOString());
const SEED_START_DAY = addMonthsToDay(SEED_TODAY_DAY, -1);
const SEED_PRODUCT_STOCK_BOOST = 200;

export const SEED_CONFIG = {
  anchorDate: dayToIso(SEED_TODAY_DAY, 12, 0),
  commerceId: 'gs',
  seedName: 'gestor-comercios-dev-seed',
  seedActorId: 'seed-admin',
  seedActorEmail: 'seed@local',
  productCreatedAt: dayToIso(SEED_START_DAY, 8, 0),
  salesStartDay: SEED_START_DAY,
  salesEndDay: SEED_TODAY_DAY,
  retentionDays: 90,
  defaultInitialFund: 5000,
  defaultExpensesMin: 250,
  defaultExpensesMax: 2200,
  defaultMinSalesPerDay: 1,
  defaultMaxSalesPerDay: 20,
  defaultItemsPerSaleMin: 1,
  defaultItemsPerSaleMax: 3,
  defaultReturnsPerWeek: 1,
  defaultCancellationsPerMonth: 1,
  defaultClosuresPerDay: 1,
};

export interface SeedProductSpec {
  code: string;
  name: string;
  priceBuy: number;
  priceSale: number;
  stock: number;
  uom: string;
  category?: string;
  brand?: string;
  minStock?: number;
  qtyStep?: number;
  isActive?: boolean;
  notes?: string;
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

export interface SeedSaleReference {
  saleId: string;
  createdAt: string;
  day: string;
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
  total: number;
  itemCodes: string[];
}

export interface SeedClosureReference {
  closedAt: string;
  day: string;
  declaredCash: number;
  expenses: number;
  initialFund: number;
  note?: string;
}

export const SEED_PRODUCTS: SeedProductSpec[] = [
  {
    code: '-1',
    name: 'Otros',
    priceBuy: 0,
    priceSale: 0,
    stock: 0,
    uom: 'u',
    category: 'Misceláneos',
    isActive: true,
    qtyStep: 1,
    notes: 'Producto virtual para precio custom',
  },
  {
    code: 'BEB-COCA-500',
    name: 'Coca-Cola 500ml',
    priceBuy: 420,
    priceSale: 850,
    stock: 72,
    uom: 'ml',
    category: 'Bebidas',
    brand: 'Coca-Cola',
    minStock: 18,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'BEB-COCA-1500',
    name: 'Coca-Cola 1.5L',
    priceBuy: 1100,
    priceSale: 2100,
    stock: 54,
    uom: 'l',
    category: 'Bebidas',
    brand: 'Coca-Cola',
    minStock: 12,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'BEB-COCA-2250',
    name: 'Coca-Cola 2.25L',
    priceBuy: 1450,
    priceSale: 2750,
    stock: 36,
    uom: 'l',
    category: 'Bebidas',
    brand: 'Coca-Cola',
    minStock: 8,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'BEB-PEPSI-500',
    name: 'Pepsi 500ml',
    priceBuy: 390,
    priceSale: 780,
    stock: 30,
    uom: 'ml',
    category: 'Bebidas',
    brand: 'Pepsi',
    minStock: 10,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'BEB-AGUA-600',
    name: 'Agua mineral 600ml',
    priceBuy: 250,
    priceSale: 650,
    stock: 88,
    uom: 'ml',
    category: 'Bebidas',
    brand: 'Manaos',
    minStock: 20,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'BEB-ENERG-473',
    name: 'Energizante 473ml',
    priceBuy: 800,
    priceSale: 1550,
    stock: 26,
    uom: 'ml',
    category: 'Bebidas',
    brand: 'Monster',
    minStock: 8,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'ALM-YERBA-500',
    name: 'Yerba mate 500g',
    priceBuy: 1450,
    priceSale: 2500,
    stock: 45,
    uom: 'g',
    category: 'Almacén',
    brand: 'Cruz de Malta',
    minStock: 12,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'ALM-YERBA-1000',
    name: 'Yerba mate 1kg',
    priceBuy: 2250,
    priceSale: 3900,
    stock: 34,
    uom: 'kg',
    category: 'Almacén',
    brand: 'Cruz de Malta',
    minStock: 10,
    qtyStep: 0.5,
    isActive: true,
  },
  {
    code: 'ALM-ARROZ-1',
    name: 'Arroz 1kg',
    priceBuy: 850,
    priceSale: 1600,
    stock: 58,
    uom: 'kg',
    category: 'Almacén',
    brand: 'Arcor',
    minStock: 14,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'ALM-FIDEO-500',
    name: 'Fideos spaghetti 500g',
    priceBuy: 620,
    priceSale: 1350,
    stock: 66,
    uom: 'g',
    category: 'Almacén',
    brand: 'Matarazzo',
    minStock: 18,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'ALM-AZUCAR-1',
    name: 'Azúcar 1kg',
    priceBuy: 720,
    priceSale: 1450,
    stock: 18,
    uom: 'kg',
    category: 'Almacén',
    brand: 'Ledesma',
    minStock: 6,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'ALM-ACEITE-900',
    name: 'Aceite girasol 900ml',
    priceBuy: 2100,
    priceSale: 3550,
    stock: 22,
    uom: 'ml',
    category: 'Almacén',
    brand: 'Cañuelas',
    minStock: 6,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'LIM-LAV-2L',
    name: 'Lavandina 2L',
    priceBuy: 670,
    priceSale: 1350,
    stock: 24,
    uom: 'l',
    category: 'Limpieza',
    brand: 'Ayudín',
    minStock: 8,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'LIM-DET-900',
    name: 'Detergente 900ml',
    priceBuy: 980,
    priceSale: 1800,
    stock: 32,
    uom: 'ml',
    category: 'Limpieza',
    brand: 'Skip',
    minStock: 10,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'LIM-SAB-LIQ-500',
    name: 'Jabón líquido 500ml',
    priceBuy: 750,
    priceSale: 1490,
    stock: 14,
    uom: 'ml',
    category: 'Limpieza',
    brand: 'Dove',
    minStock: 5,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'PER-DES-50',
    name: 'Desodorante 50g',
    priceBuy: 930,
    priceSale: 1750,
    stock: 16,
    uom: 'g',
    category: 'Perfumería',
    brand: 'Natura',
    minStock: 5,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'PER-SHAM-400',
    name: 'Shampoo 400ml',
    priceBuy: 1100,
    priceSale: 2100,
    stock: 20,
    uom: 'ml',
    category: 'Perfumería',
    brand: 'Sedal',
    minStock: 6,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'KIO-GAL-CHOC-150',
    name: 'Galletitas chocolate 150g',
    priceBuy: 350,
    priceSale: 780,
    stock: 60,
    uom: 'g',
    category: 'Kiosco',
    brand: 'Bagley',
    minStock: 15,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'KIO-CHOC-BAR-80',
    name: 'Chocolate barrita 80g',
    priceBuy: 210,
    priceSale: 520,
    stock: 0,
    uom: 'g',
    category: 'Kiosco',
    brand: 'Arcor',
    minStock: 0,
    qtyStep: 1,
    isActive: false,
  },
  {
    code: 'KIO-PAPAS-100',
    name: 'Papas fritas 100g',
    priceBuy: 420,
    priceSale: 990,
    stock: 22,
    uom: 'g',
    category: 'Kiosco',
    brand: 'Lays',
    minStock: 6,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'KIO-CHUPA-50',
    name: 'Chupetines pack x50',
    priceBuy: 260,
    priceSale: 620,
    stock: 18,
    uom: 'u',
    category: 'Kiosco',
    brand: 'Arcor',
    minStock: 5,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'FRE-LECHE-1L',
    name: 'Leche entera 1L',
    priceBuy: 480,
    priceSale: 1100,
    stock: 26,
    uom: 'l',
    category: 'Frescos',
    brand: 'La Serenísima',
    minStock: 8,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'FRE-QUESO-500',
    name: 'Queso cremoso 500g',
    priceBuy: 1700,
    priceSale: 3300,
    stock: 12,
    uom: 'kg',
    category: 'Frescos',
    brand: 'Sancor',
    minStock: 4,
    qtyStep: 0.25,
    isActive: true,
  },
  {
    code: 'FRE-MANTECA-200',
    name: 'Manteca 200g',
    priceBuy: 760,
    priceSale: 1450,
    stock: 18,
    uom: 'g',
    category: 'Frescos',
    brand: 'La Serenísima',
    minStock: 5,
    qtyStep: 1,
    isActive: true,
  },
  {
    code: 'CAR-MILA-1KG',
    name: 'Milanesas 1kg',
    priceBuy: 3400,
    priceSale: 6200,
    stock: 10,
    uom: 'kg',
    category: 'Carnicería',
    brand: 'Frigor',
    minStock: 3,
    qtyStep: 0.25,
    isActive: true,
  },
  {
    code: 'CAR-CARNE-1KG',
    name: 'Carne picada 1kg',
    priceBuy: 2900,
    priceSale: 5600,
    stock: 14,
    uom: 'kg',
    category: 'Carnicería',
    brand: 'Frigor',
    minStock: 4,
    qtyStep: 0.25,
    isActive: true,
  },
  {
    code: 'FER-CABLE-1M',
    name: 'Cable 1m',
    priceBuy: 390,
    priceSale: 860,
    stock: 18,
    uom: 'm',
    category: 'Ferretería',
    brand: 'Genérico',
    minStock: 4,
    qtyStep: 0.5,
    isActive: false,
  },
  {
    code: 'FER-MANGUERA-2M',
    name: 'Manguera 2m',
    priceBuy: 1600,
    priceSale: 2800,
    stock: 0,
    uom: 'm',
    category: 'Ferretería',
    brand: 'Genérico',
    minStock: 0,
    qtyStep: 0.5,
    isActive: false,
  },
];

export function createSeedPrng(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += h << 13;
    h ^= h >>> 7;
    h += h << 3;
    h ^= h >>> 17;
    h += h << 5;
    return (h >>> 0) / 4294967296;
  };
}

export function deterministicId(
  prefix: string,
  index: number,
  scope = SEED_CONFIG.seedName
): string {
  const hash = createHash('sha1')
    .update(`${scope}:${prefix}:${index}`)
    .digest('hex');
  return `${prefix}-${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export function addDaysToDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonthsToDay(day: string, months: number): string {
  const d = new Date(`${day}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function dayToIso(
  day: string,
  hour: number,
  minute: number,
  second = 0,
  millisecond = 0
): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(
    Date.UTC(year, month - 1, date, hour + 3, minute, second, millisecond)
  ).toISOString();
}

export function monthRange(startMonth: string, endMonth: string): string[] {
  const months: string[] = [];
  let cursor = new Date(`${startMonth}-01T00:00:00.000Z`);
  const end = new Date(`${endMonth}-01T00:00:00.000Z`);

  while (cursor <= end) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

export function enumerateDays(startDay: string, endDay: string): string[] {
  const days: string[] = [];
  let cursor = new Date(`${startDay}T00:00:00.000Z`);
  const end = new Date(`${endDay}T00:00:00.000Z`);

  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

export function resolveSeedProductStock(spec: SeedProductSpec): number {
  if (spec.code === '-1' || spec.isActive === false || spec.stock <= 0) {
    return spec.stock;
  }

  return spec.stock + SEED_PRODUCT_STOCK_BOOST;
}
