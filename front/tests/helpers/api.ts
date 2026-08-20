import fs from "fs"
import path from "path"
import { API_BASE_URL } from "./env"
import { ADMIN_STATE_PATH, VENDOR_STATE_PATH } from "./paths"
import type {
  CashClose,
  CashCloseDetailResponse,
  CashCloseListParams,
  CashCloseListResponse,
  CreateCashCloseRequest,
  CreateProductRequest,
  CreateSaleRequest,
  DailyReportResponse,
  Product,
  ProductListParams,
  ProductListResponse,
  RangeReportResponse,
  Sale,
  SaleListParams,
  SaleListResponse,
  ScaleBarcodeConfig,
  ScaleBarcodeConfigResponse,
} from "@/lib/types/api"

type Role = "admin" | "vendor"

interface StoredAuthState {
  origins?: Array<{
    origin: string
    localStorage?: Array<{ name: string; value: string }>
  }>
}

interface ParsedAuthSession {
  token: string
  commerceId: string
}

export interface AuthedRequestOptions extends RequestInit {
  role?: Role
  commerceId?: string
  parse?: "json" | "text"
}

const AUTH_STATE_PATHS: Record<Role, string> = {
  admin: ADMIN_STATE_PATH,
  vendor: VENDOR_STATE_PATH,
}

function readAuthSession(role: Role): ParsedAuthSession {
  const statePath = AUTH_STATE_PATHS[role]
  const raw = fs.readFileSync(path.resolve(statePath), "utf8")
  const storageState = JSON.parse(raw) as StoredAuthState

  const authEntry = storageState.origins
    ?.flatMap((origin) => origin.localStorage ?? [])
    .find((item) => item.name === "authState")

  if (!authEntry) {
    throw new Error(`Missing authState in ${statePath}`)
  }

  const parsedAuth = JSON.parse(authEntry.value) as {
    token?: string
    commerceId?: string
    user?: { commerceId?: string }
  }

  const token = parsedAuth.token
  const commerceId = parsedAuth.user?.commerceId ?? parsedAuth.commerceId

  if (!token || !commerceId) {
    throw new Error(`Missing token or commerceId in ${statePath}`)
  }

  return { token, commerceId }
}

async function requestWithAuth<T>(endpoint: string, options: AuthedRequestOptions = {}): Promise<T> {
  const role = options.role ?? "admin"
  const session = readAuthSession(role)
  const commerceId = options.commerceId ?? session.commerceId
  const headers = new Headers(options.headers ?? {})

  if (!headers.has("Content-Type") && options.body !== undefined) {
    headers.set("Content-Type", "application/json")
  }
  headers.set("Authorization", `Bearer ${session.token}`)

  const response = await fetch(`${API_BASE_URL}/${commerceId}${endpoint}`, {
    ...options,
    headers,
  })

  const raw = await response.text()
  let body: any = raw

  if (raw) {
    try {
      body = JSON.parse(raw)
    } catch {
      body = raw
    }
  } else {
    body = null
  }

  if (!response.ok) {
    const message =
      body?.error?.message ??
      body?.message ??
      body ??
      `Request to ${endpoint} failed with ${response.status}`
    throw new Error(typeof message === "string" ? message : JSON.stringify(message))
  }

  if (options.parse === "text") {
    return body as T
  }

  return body as T
}

export function getCommerceId(role: Role = "admin") {
  return readAuthSession(role).commerceId
}

export async function authedRequest<T>(endpoint: string, options: AuthedRequestOptions = {}) {
  return requestWithAuth<T>(endpoint, options)
}

export async function createProduct(
  data: CreateProductRequest,
  options: { role?: Role; commerceId?: string } = {}
) {
  return requestWithAuth<Product>("/products", {
    method: "POST",
    body: JSON.stringify(data),
    role: options.role,
    commerceId: options.commerceId,
  })
}

export async function updateProduct(
  code: string,
  data: Partial<CreateProductRequest>,
  options: { role?: Role; commerceId?: string } = {}
) {
  return requestWithAuth<Product>(`/products/${encodeURIComponent(code)}`, {
    method: "PUT",
    body: JSON.stringify(data),
    role: options.role,
    commerceId: options.commerceId,
  })
}

export async function deleteProduct(code: string, options: { role?: Role; commerceId?: string } = {}) {
  return updateProduct(code, { isActive: false }, options)
}

export async function listProducts(params: ProductListParams = {}, options: { role?: Role; commerceId?: string } = {}) {
  const searchParams = new URLSearchParams()
  if (params.isActive !== undefined) searchParams.set("isActive", String(params.isActive))
  if (params.name) searchParams.set("name", params.name)
  if (params.code) searchParams.set("code", params.code)
  if (params.lastKey) searchParams.set("lastKey", params.lastKey)

  const query = searchParams.toString()
  return requestWithAuth<ProductListResponse>(`/products${query ? `?${query}` : ""}`, {
    role: options.role,
    commerceId: options.commerceId,
  })
}

export async function getMetadata(options: { role?: Role; commerceId?: string } = {}) {
  return requestWithAuth<{ categories: string[]; iva_rates: number[] }>("/metadata", {
    role: options.role,
    commerceId: options.commerceId,
  })
}

export async function getScaleBarcodeConfig(options: { role?: Role; commerceId?: string } = {}) {
  return requestWithAuth<ScaleBarcodeConfigResponse>("/scale-barcode-config", {
    role: options.role,
    commerceId: options.commerceId,
  })
}

export async function updateScaleBarcodeConfig(
  scaleBarcodeConfig: ScaleBarcodeConfig,
  options: { role?: Role; commerceId?: string } = {}
) {
  return requestWithAuth<ScaleBarcodeConfigResponse>("/scale-barcode-config", {
    method: "PUT",
    body: JSON.stringify({ scaleBarcodeConfig }),
    role: options.role,
    commerceId: options.commerceId,
  })
}

export async function createSale(
  data: CreateSaleRequest & { createdAt?: string; saleId?: string; auditAt?: string; auditId?: string },
  options: { role?: Role; commerceId?: string } = {}
) {
  return requestWithAuth<Sale>("/sales", {
    method: "POST",
    body: JSON.stringify(data),
    role: options.role,
    commerceId: options.commerceId,
  })
}

export async function listSales(params: SaleListParams = {}, options: { role?: Role; commerceId?: string } = {}) {
  const searchParams = new URLSearchParams()
  if (params.saleId) searchParams.set("saleId", params.saleId)
  if (params.day) searchParams.set("day", params.day)
  if (params.start) searchParams.set("start", params.start)
  if (params.end) searchParams.set("end", params.end)
  if (params.lastKey) searchParams.set("lastKey", params.lastKey)

  const query = searchParams.toString()
  return requestWithAuth<SaleListResponse>(`/sales${query ? `?${query}` : ""}`, {
    role: options.role,
    commerceId: options.commerceId,
  })
}

export async function createOffer(
  data: Record<string, unknown>,
  options: { role?: Role; commerceId?: string } = {}
) {
  return requestWithAuth<any>("/offers", {
    method: "POST",
    body: JSON.stringify(data),
    role: options.role,
    commerceId: options.commerceId,
  })
}

export async function updateOffer(
  offerId: string,
  data: Record<string, unknown>,
  options: { role?: Role; commerceId?: string } = {}
) {
  return requestWithAuth<any>(`/offers/${encodeURIComponent(offerId)}`, {
    method: "PUT",
    body: JSON.stringify(data),
    role: options.role,
    commerceId: options.commerceId,
  })
}

export async function finishOffer(offerId: string, options: { role?: Role; commerceId?: string } = {}) {
  return requestWithAuth<any>(`/offers/${encodeURIComponent(offerId)}/finish`, {
    method: "POST",
    role: options.role,
    commerceId: options.commerceId,
  })
}

export async function listOffers(
  params: Record<string, string | undefined> = {},
  options: { role?: Role; commerceId?: string } = {}
) {
  const searchParams = new URLSearchParams()
  if (params.status) searchParams.set("status", params.status)
  if (params.startDate) searchParams.set("startDate", params.startDate)
  if (params.endDate) searchParams.set("endDate", params.endDate)
  if (params.lastKey) searchParams.set("lastKey", params.lastKey)

  const query = searchParams.toString()
  return requestWithAuth<{ items: any[]; lastKey?: string }>(`/offers${query ? `?${query}` : ""}`, {
    role: options.role,
    commerceId: options.commerceId,
  })
}

export async function createClosure(
  data: CreateCashCloseRequest & { closedAt?: string; auditAt?: string; closureId?: string; auditId?: string },
  options: { role?: Role; commerceId?: string } = {}
) {
  return requestWithAuth<CashClose>("/closures", {
    method: "POST",
    body: JSON.stringify(data),
    role: options.role,
    commerceId: options.commerceId,
  })
}

export async function listClosures(
  params: CashCloseListParams = {},
  options: { role?: Role; commerceId?: string } = {}
) {
  const searchParams = new URLSearchParams()
  if (params.day) searchParams.set("day", params.day)
  if (params.lastKey) searchParams.set("lastKey", params.lastKey)

  const query = searchParams.toString()
  return requestWithAuth<CashCloseListResponse>(`/closures${query ? `?${query}` : ""}`, {
    role: options.role,
    commerceId: options.commerceId,
  })
}

export async function getClosureDetail(closureId: string, options: { role?: Role; commerceId?: string } = {}) {
  return requestWithAuth<CashCloseDetailResponse>(`/closures/${encodeURIComponent(closureId)}`, {
    role: options.role,
    commerceId: options.commerceId,
  })
}

export async function listAuditLogs(
  params: Record<string, string | undefined> = {},
  options: { role?: Role; commerceId?: string } = {}
) {
  const searchParams = new URLSearchParams()
  if (params.start) searchParams.set("start", params.start)
  if (params.end) searchParams.set("end", params.end)
  if (params.lastKey) searchParams.set("lastKey", params.lastKey)

  const query = searchParams.toString()
  return requestWithAuth<{ items: any[]; lastKey?: string }>(`/audit-logs${query ? `?${query}` : ""}`, {
    role: options.role,
    commerceId: options.commerceId,
  })
}

export async function getDailyReport(day: string, options: { role?: Role; commerceId?: string } = {}) {
  return requestWithAuth<DailyReportResponse>(`/reports/daily?day=${encodeURIComponent(day)}`, {
    role: options.role,
    commerceId: options.commerceId,
  })
}

export async function getDailySummary(start: string, end: string, options: { role?: Role; commerceId?: string } = {}) {
  return requestWithAuth<{ items: any[] }>(
    `/reports/daily-summary?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    {
      role: options.role,
      commerceId: options.commerceId,
    }
  )
}

export async function getMonthlyRanking(
  startMonth: string,
  options: { role?: Role; commerceId?: string } = {}
) {
  return requestWithAuth<{ rankings: any[] }>(`/reports/monthly-ranking?startMonth=${encodeURIComponent(startMonth)}`, {
    role: options.role,
    commerceId: options.commerceId,
  })
}

export async function getRestockAlerts(options: { role?: Role; commerceId?: string } = {}) {
  return requestWithAuth<{ items: any[]; count: number }>("/products/restock-alert", {
    role: options.role,
    commerceId: options.commerceId,
  })
}
