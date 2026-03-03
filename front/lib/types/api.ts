// Product Models
export interface Product {
  code: string
  name: string
  priceBuy?: number // Only visible for admin
  priceSale: number
  notes?: string
  stock: number
  unitsSold: number
  revenue: number
  profit?: number // Only visible for admin
  createdAt: string
  updatedAt: string
  uom: string // Unit of measure
  isActive: boolean
  qtyStep: number // Minimum multiple for sales
  category?: string
  brand?: string
  minStock?: number // Stock mínimo para alertas
  alertStatus?: 'LOW' // Solo presente cuando stock <= minStock
}

export interface CreateProductRequest {
  code: string
  name: string
  priceBuy: number
  priceSale: number
  notes?: string
  uom: string
  stock: number
  isActive?: boolean
  category?: string
  brand?: string
  minStock?: number
}

export interface UpdateProductRequest {
  name?: string
  priceBuy?: number
  priceSale?: number
  notes?: string
  uom?: string
  stock?: number
  isActive?: boolean
  category?: string
  brand?: string
  minStock?: number
}

export interface ProductListResponse {
  items: Product[]
  lastKey?: string
}

// Sale Models
export interface SaleItem {
  code: string
  name: string
  qty: number // Can be negative for returns
  priceBuy: number
  priceSale: number
  profit?: number // Only visible for admin
  uom: string
  brand?: string
  category?: string
  originalPrice?: number    // Precio original antes de descuento
  discountApplied?: number  // Monto de descuento por unidad
  offerId?: string          // ID de la oferta aplicada
  offerName?: string        // Nombre de la oferta aplicada
}

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otros',
}

export interface Sale {
  saleId: string
  commerceId: string
  sellerId: string
  createdAt: string
  day: string // YYYY-MM-DD format
  ttl: number
  items: SaleItem[]
  total: number
  profit?: number // Only visible for admin
  notes?: string
  paymentMethod?: PaymentMethod
}

export interface CreateSaleRequest {
  items: {
    code: string
    name: string
    qty: number
    priceBuy: number
    priceSale: number
    uom: string
  }[]
  notes?: string
  paymentMethod?: PaymentMethod
}

export interface SaleListResponse {
  items: Sale[]
  lastKey?: string
}

// Report Models
export interface ReportItem {
  code: string
  name: string
  units: number
  revenue: number
  profit?: number // Only visible for admin
}

export interface DailyReportResponse {
  day: string
  results: ReportItem[]
}

export interface RangeReportResponse {
  start: string
  end: string
  results: ReportItem[]
}

// API Error Response
export interface ApiError {
  error: {
    message: string
    code?: string
  }
}

// Common API Parameters
export interface PaginationParams {
  lastKey?: string
}

export interface ProductListParams extends PaginationParams {
  isActive?: boolean
}

export interface SaleListParams extends PaginationParams {
  day?: string // YYYY-MM-DD
  start?: string // YYYY-MM-DD
  end?: string // YYYY-MM-DD
}

export interface ReportParams {
  orderBy?: "units" | "revenue" | "profit"
}

export interface DailyReportParams extends ReportParams {
  day: string // YYYY-MM-DD
}

export interface RangeReportParams extends ReportParams {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
}

// Metadata Config
export interface MetadataConfig {
  categories: string[]
  iva_rates: number[]
}

// Cash Close Models
export interface CashClose {
  closureId: string
  commerceId: string
  userId: string
  openedAt: string
  closedAt: string
  systemTotalCash?: number
  systemTotalCard?: number
  systemTotalTransfer?: number
  systemTotalOther?: number
  declaredCash: number
  expenses: number
  initialFund: number
  difference?: number
  notes?: string
}

export interface CreateCashCloseRequest {
  declaredCash: number
  expenses: number
  initialFund: number
  notes?: string
}

export interface CashCloseListResponse {
  items: CashClose[]
  lastKey?: string
}

export interface CashCloseListParams {
  day?: string // YYYY-MM-DD
  lastKey?: string
}

export interface CashCloseDetailResponse {
  closure: CashClose
  sales: Sale[]
}

// Audit Log Models
export type AuditAction = 'PRODUCT_CREATE' | 'PRODUCT_UPDATE' | 'SALE_CREATE' | 'REGISTER_CLOSE' | 'OFFER_CREATE' | 'OFFER_UPDATE' | 'OFFER_FINISH'

export const ACTION_LABELS: Record<AuditAction, string> = {
  PRODUCT_CREATE: 'Producto creado',
  PRODUCT_UPDATE: 'Producto actualizado',
  SALE_CREATE: 'Venta registrada',
  REGISTER_CLOSE: 'Cierre de caja',
  OFFER_CREATE: 'Oferta creada',
  OFFER_UPDATE: 'Oferta actualizada',
  OFFER_FINISH: 'Oferta finalizada',
}

export const DETAIL_FIELD_LABELS: Record<string, string> = {
  code: 'Código',
  name: 'Nombre',
  total: 'Total',
  paymentMethod: 'Método de pago',
  saleId: 'ID de venta',
  difference: 'Diferencia de caja',
  declaredCash: 'Efectivo declarado',
  priceBuy: 'Precio de compra',
  priceSale: 'Precio de venta',
  stock: 'Stock',
  minStock: 'Stock mínimo',
  uom: 'Unidad de medida',
  isActive: 'Activo',
  notes: 'Notas',
  category: 'Categoría',
  brand: 'Marca',
  qtyStep: 'Paso de cantidad',
  offerId: 'ID de oferta',
  discountType: 'Tipo de descuento',
  discountValue: 'Valor de descuento',
  startDate: 'Fecha inicio',
  endDate: 'Fecha fin',
  scope: 'Alcance',
}

export interface AuditLog {
  action: AuditAction
  userId: string
  userEmail: string
  details: Record<string, any>
  createdAt: string
}

export interface AuditLogListResponse {
  items: AuditLog[]
  lastKey?: string
}

// Offer Models
export type DiscountType = 'PERCENTAGE' | 'FIXED'
export type ScopeType = 'PRODUCT' | 'CATEGORY' | 'BRAND'

export interface OfferScope {
  type: ScopeType
  values: string[]
}

export interface Offer {
  offerId: string
  commerceId: string
  name: string
  discountType: DiscountType
  discountValue: number
  startDate: string
  endDate: string
  scope: OfferScope
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface CreateOfferRequest {
  name: string
  discountType: DiscountType
  discountValue: number
  startDate: string
  endDate: string
  scope: OfferScope
}

export interface UpdateOfferRequest {
  name?: string
  discountType?: DiscountType
  discountValue?: number
  startDate?: string
  endDate?: string
  scope?: OfferScope
}

export interface OfferListResponse {
  items: Offer[]
  lastKey?: string
}

export type OfferStatus = 'active' | 'scheduled' | 'expired'
