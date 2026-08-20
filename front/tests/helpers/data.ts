import { randomUUID } from "crypto"
import type { CreateProductRequest, CreateSaleRequest } from "@/lib/types/api"

type ProductOverrides = Partial<CreateProductRequest> & {
  code?: string
  name?: string
}

type SaleItemInput = CreateSaleRequest["items"][number] & {
  brand?: string
  category?: string
}

type OfferStatus = "active" | "scheduled" | "expired"

export function makeRunId(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`
}

export function productPayload(overrides: ProductOverrides = {}, index = 0): CreateProductRequest {
  const runId = overrides.code ?? makeRunId(`P${index + 1}`)

  return {
    code: runId.toUpperCase(),
    name: overrides.name ?? `Producto ${runId.toUpperCase()}`,
    priceBuy: overrides.priceBuy ?? 1000,
    priceSale: overrides.priceSale ?? 1500,
    notes: overrides.notes ?? `Dato E2E ${runId}`,
    uom: overrides.uom ?? "u",
    stock: overrides.stock ?? 25,
    isActive: overrides.isActive ?? true,
    category: overrides.category ?? "Bebidas",
    brand: overrides.brand ?? "Marca E2E",
    minStock: overrides.minStock ?? 5,
  }
}

export function saleItemFromProduct(
  product: { code: string; name: string; priceBuy?: number; priceSale: number; uom: string; brand?: string; category?: string },
  qty = 1,
  overrides: Partial<SaleItemInput> = {}
): SaleItemInput {
  return {
    code: overrides.code ?? product.code,
    name: overrides.name ?? product.name,
    qty: overrides.qty ?? qty,
    priceBuy: overrides.priceBuy ?? product.priceBuy ?? 0,
    priceSale: overrides.priceSale ?? product.priceSale,
    uom: overrides.uom ?? product.uom,
    brand: overrides.brand ?? product.brand,
    category: overrides.category ?? product.category,
  }
}

export function salePayload(
  items: SaleItemInput[],
  overrides: Partial<CreateSaleRequest> & {
    createdAt?: string
    saleId?: string
    auditAt?: string
    auditId?: string
  } = {}
): CreateSaleRequest & {
  createdAt?: string
  saleId?: string
  auditAt?: string
  auditId?: string
} {
  return {
    items,
    notes: overrides.notes,
    paymentMethod: overrides.paymentMethod,
    createdAt: overrides.createdAt,
    saleId: overrides.saleId,
    auditAt: overrides.auditAt,
    auditId: overrides.auditId,
  }
}

function shiftIso(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

function shiftDaysIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

export function offerPayload(
  scopeType: "PRODUCT" | "CATEGORY" | "BRAND",
  scopeValues: string[],
  status: OfferStatus = "active",
  overrides: Record<string, unknown> = {}
) {
  const schedule =
    status === "scheduled"
      ? { startDate: shiftDaysIso(1), endDate: shiftDaysIso(2) }
      : status === "expired"
        ? { startDate: shiftDaysIso(-3), endDate: shiftDaysIso(-1) }
        : { startDate: shiftIso(-1), endDate: shiftDaysIso(1) }

  return {
    name: overrides.name ?? `Oferta ${makeRunId("OFF")}`,
    discountType: overrides.discountType ?? "PERCENTAGE",
    discountValue: overrides.discountValue ?? 15,
    ...schedule,
    scope: {
      type: scopeType,
      values: scopeValues,
    },
    ...overrides,
  }
}

export function closurePayload(overrides: Partial<import("@/lib/types/api").CreateCashCloseRequest> = {}): import("@/lib/types/api").CreateCashCloseRequest {
  return {
    declaredCash: overrides.declaredCash ?? 10000,
    expenses: overrides.expenses ?? 250,
    initialFund: overrides.initialFund ?? 5000,
    notes: overrides.notes ?? `Cierre E2E ${makeRunId("CLS")}`,
    ...overrides,
  }
}
