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
}

export interface UpdateProductRequest {
  name?: string
  priceBuy?: number
  priceSale?: number
  notes?: string
  uom?: string
  stock?: number
  isActive?: boolean
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
