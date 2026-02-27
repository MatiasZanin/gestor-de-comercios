import { authService } from "@/lib/auth/cognito"
import type { ApiError, Product } from "@/lib/types/api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!

export class ApiClient {
  private static instance: ApiClient
  private onUnauthorized?: () => void

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient()
    }
    return ApiClient.instance
  }

  // Método para establecer el callback de redirección
  setOnUnauthorized(callback: () => void) {
    this.onUnauthorized = callback
  }

  private handleUnauthorized() {
    if (this.onUnauthorized) {
      this.onUnauthorized()
    } else {
      if (typeof window !== "undefined") {
        authService.logout()
        window.location.href = "/login"
      }
    }
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = authService.getToken()
    const commerceId = authService.getCommerceId()

    if (!token || !commerceId) {
      throw new Error("No authentication token or commerce ID available")
    }

    const url = `${API_BASE_URL}/${commerceId}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        this.handleUnauthorized()
        throw new Error("Sesión expirada. Redirigiendo al login...")
      }

      const errorData: ApiError = await response.json().catch(() => ({
        error: { message: "Unknown error occurred" },
      }))
      throw new Error(errorData.error.message)
    }

    return response.json()
  }

  // Product endpoints
  async createProduct(data: any): Promise<any> {
    return this.makeRequest("/products", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateProduct(code: string, data: any): Promise<any> {
    return this.makeRequest(`/products/${encodeURIComponent(code)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  async deleteProduct(code: string): Promise<Product> {
    return this.makeRequest(`/products/${encodeURIComponent(code)}`, {
      method: "PUT",
      body: JSON.stringify({ isActive: false }),
    })
  }

  async listProducts(params?: any): Promise<any> {
    const searchParams = new URLSearchParams()
    if (params?.isActive !== undefined) {
      searchParams.append("isActive", params.isActive.toString())
    }
    if (params?.name) {
      searchParams.append("name", params.name)
    }
    if (params?.lastKey) {
      searchParams.append("lastKey", params.lastKey)
    }

    const query = searchParams.toString()
    return this.makeRequest(`/products${query ? `?${query}` : ""}`)
  }

  async getProductByCode(code: string): Promise<any> {
    return this.makeRequest(`/products/${encodeURIComponent(code)}`, {
      method: "GET",
    })
  }

  // Sale endpoints
  async createSale(data: any): Promise<any> {
    return this.makeRequest("/sales", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async listSales(params?: any): Promise<any> {
    const searchParams = new URLSearchParams()
    if (params?.saleId) {
      searchParams.append("saleId", params.saleId)
    }
    if (params?.day) {
      searchParams.append("day", params.day)
    }
    if (params?.start) {
      searchParams.append("start", params.start)
    }
    if (params?.end) {
      searchParams.append("end", params.end)
    }
    if (params?.lastKey) {
      searchParams.append("lastKey", params.lastKey)
    }

    const query = searchParams.toString()
    return this.makeRequest(`/sales${query ? `?${query}` : ""}`)
  }

  // Report endpoints
  async getDailyReport(params: any): Promise<any> {
    const searchParams = new URLSearchParams()
    searchParams.append("day", params.day)
    if (params.orderBy) {
      searchParams.append("orderBy", params.orderBy)
    }

    return this.makeRequest(`/reports/daily?${searchParams.toString()}`)
  }

  async getRangeReport(params: any): Promise<any> {
    const searchParams = new URLSearchParams()
    searchParams.append("start", params.start)
    searchParams.append("end", params.end)
    if (params.orderBy) {
      searchParams.append("orderBy", params.orderBy)
    }

    return this.makeRequest(`/reports/range?${searchParams.toString()}`)
  }

  async getDailySummary(params: any): Promise<any> {
    const searchParams = new URLSearchParams()
    searchParams.append("start", params.start)
    searchParams.append("end", params.end)

    return this.makeRequest(`/reports/daily-summary?${searchParams.toString()}`)
  }

  // ACTUALIZADO: Ahora soporta startMonth y endMonth
  async getMonthlyRanking(params: any): Promise<any> {
    const searchParams = new URLSearchParams()
    searchParams.append("startMonth", params.startMonth)
    if (params.endMonth) {
      searchParams.append("endMonth", params.endMonth)
    }
    if (params.orderBy) {
      searchParams.append("orderBy", params.orderBy)
    }

    return this.makeRequest(`/reports/monthly-ranking?${searchParams.toString()}`)
  }

  async getRestockAlerts(params: any): Promise<any> {
    const searchParams = new URLSearchParams()
    if (params.orderBy) {
      searchParams.append("orderBy", params.orderBy)
    }
    // CORRECCIÓN: La ruta en template.yaml es /products/restock-alert, no /reports/...
    return this.makeRequest(`/products/restock-alert?${searchParams.toString()}`)
  }

  async getInventoryValuation(): Promise<{
    totalCost: number
    totalRetail: number
    count: number
  }> {
    return this.makeRequest('/reports/inventory-valuation')
  }

  async getStaleProducts(): Promise<{
    deadStock: any[]
    overstock: any[]
  }> {
    return this.makeRequest('/reports/stale-products')
  }

  // Metadata endpoints
  async getMetadata(): Promise<any> {
    return this.makeRequest("/metadata")
  }

  // Closure endpoints
  async createClosure(data: any): Promise<any> {
    return this.makeRequest("/closures", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async listClosures(params?: { day?: string; start?: string; end?: string; lastKey?: string }): Promise<any> {
    const searchParams = new URLSearchParams()
    if (params?.day) searchParams.append("day", params.day)
    if (params?.start) searchParams.append("start", params.start)
    if (params?.end) searchParams.append("end", params.end)
    if (params?.lastKey) searchParams.append("lastKey", params.lastKey)
    const query = searchParams.toString()
    return this.makeRequest(`/closures${query ? `?${query}` : ""}`)
  }

  async getClosureDetail(closureId: string): Promise<any> {
    return this.makeRequest(`/closures/${encodeURIComponent(closureId)}`)
  }

  async listAuditLogs(params?: { lastKey?: string; start?: string; end?: string }): Promise<any> {
    const searchParams = new URLSearchParams()
    if (params?.lastKey) searchParams.append("lastKey", params.lastKey)
    if (params?.start) searchParams.append("start", params.start)
    if (params?.end) searchParams.append("end", params.end)
    const query = searchParams.toString()
    return this.makeRequest(`/audit-logs${query ? `?${query}` : ""}`)
  }

  // Offer endpoints
  async createOffer(data: any): Promise<any> {
    return this.makeRequest("/offers", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async listOffers(params?: { status?: string; startDate?: string; endDate?: string; lastKey?: string }): Promise<any> {
    const searchParams = new URLSearchParams()
    if (params?.status) searchParams.append("status", params.status)
    if (params?.startDate) searchParams.append("startDate", params.startDate)
    if (params?.endDate) searchParams.append("endDate", params.endDate)
    if (params?.lastKey) searchParams.append("lastKey", params.lastKey)
    const query = searchParams.toString()
    return this.makeRequest(`/offers${query ? `?${query}` : ""}`)
  }

  async updateOffer(offerId: string, data: any): Promise<any> {
    return this.makeRequest(`/offers/${encodeURIComponent(offerId)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  async finishOffer(offerId: string): Promise<any> {
    return this.makeRequest(`/offers/${encodeURIComponent(offerId)}/finish`, {
      method: "POST",
    })
  }
}

export const apiClient = ApiClient.getInstance()