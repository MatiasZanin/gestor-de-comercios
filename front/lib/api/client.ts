import { authService } from "@/lib/auth/cognito"
import type { ApiError, BillingStatusResponse, CancelSubscriptionResponse, CreateManagedUserRequest, CreateSubscriptionResponse, CreateSupportRequest, ManagedUser, ManagedUserListResponse, Product, ScaleBarcodeConfig, ScaleBarcodeConfigResponse, SupportRequestResponse, UpdateManagedUserRequest } from "@/lib/types/api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!
export const SUBSCRIPTION_REQUIRED_CODE = "SUBSCRIPTION_REQUIRED"

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = "ApiClientError"
  }
}

export class ApiClient {
  private static instance: ApiClient
  private onUnauthorized?: () => boolean | Promise<boolean>
  private onSubscriptionRequired?: () => void

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient()
    }
    return ApiClient.instance
  }

  // Método para establecer el callback de redirección
  setOnUnauthorized(callback: () => boolean | Promise<boolean>) {
    this.onUnauthorized = callback
  }

  setOnSubscriptionRequired(callback?: () => void) {
    this.onSubscriptionRequired = callback
  }

  private async throwApiError(response: Response): Promise<never> {
    const errorData: ApiError = await response.json().catch(() => ({
      error: "Unknown error occurred",
    }))
    const structuredError = typeof errorData.error === "object" ? errorData.error : undefined
    const message = typeof errorData.error === "string"
      ? errorData.error
      : structuredError?.message || "Unexpected error"
    const code = structuredError?.code

    if (code === SUBSCRIPTION_REQUIRED_CODE) {
      this.onSubscriptionRequired?.()
    }

    throw new ApiClientError(message, response.status, code)
  }

  private async handleUnauthorized(): Promise<boolean> {
    if (this.onUnauthorized) {
      const result = await this.onUnauthorized()
      return result === true
    } else {
      if (typeof window !== "undefined") {
        authService.logout()
        window.location.href = "/login"
      }
      return false
    }
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Obtener token válido (se refresca automáticamente si está expirado)
    const token = await authService.getValidToken()
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
        // Intentar refresh explícito y reintentar una vez
        const refreshedToken = await authService.refreshToken()
        if (refreshedToken) {
          return this.retryRequest<T>(endpoint, options, refreshedToken)
        }
        // Si el refresh falló, intentar re-autenticación en caliente
        const reauthed = await this.handleUnauthorized()
        if (reauthed) {
          // Re-autenticación exitosa, reintentar el request con el nuevo token
          const newToken = authService.getToken()
          if (newToken) {
            return this.retryRequest<T>(endpoint, options, newToken)
          }
        }
        throw new Error("Sesión expirada. Redirigiendo al login...")
      }

      return this.throwApiError(response)
    }

    return response.json()
  }

  private async retryRequest<T>(endpoint: string, options: RequestInit, token: string): Promise<T> {
    const commerceId = authService.getCommerceId()
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
        const reauthed = await this.handleUnauthorized()
        if (reauthed) {
          const newToken = authService.getToken()
          if (newToken) {
            return this.retryRequest<T>(endpoint, options, newToken)
          }
        }
        throw new Error("Sesión expirada. Redirigiendo al login...")
      }

      return this.throwApiError(response)
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

  async getScaleBarcodeConfig(): Promise<ScaleBarcodeConfigResponse> {
    return this.makeRequest("/scale-barcode-config")
  }

  async updateScaleBarcodeConfig(scaleBarcodeConfig: ScaleBarcodeConfig): Promise<ScaleBarcodeConfigResponse> {
    return this.makeRequest("/scale-barcode-config", {
      method: "PUT",
      body: JSON.stringify({ scaleBarcodeConfig }),
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

  async exportSales(params: { day?: string; start?: string; end?: string }): Promise<{ items: any[]; totalCount: number }> {
    const searchParams = new URLSearchParams()
    if (params.day) searchParams.append("day", params.day)
    if (params.start) searchParams.append("start", params.start)
    if (params.end) searchParams.append("end", params.end)
    const query = searchParams.toString()
    return this.makeRequest(`/sales/export${query ? `?${query}` : ""}`)
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

  async getBillingStatus(options: { forceRefresh?: boolean } = {}): Promise<BillingStatusResponse> {
    const searchParams = new URLSearchParams()
    if (options.forceRefresh) {
      searchParams.append("forceRefresh", "true")
    }
    const query = searchParams.toString()
    return this.makeRequest(`/billing/status${query ? `?${query}` : ""}`)
  }

  async createSubscription(payerEmail: string, idempotencyKey: string): Promise<CreateSubscriptionResponse> {
    return this.makeRequest("/billing/subscribe", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ payerEmail }),
    })
  }

  async cancelSubscription(reason: string, idempotencyKey: string): Promise<CancelSubscriptionResponse> {
    return this.makeRequest("/billing/cancel", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ reason }),
    })
  }

  async listUsers(): Promise<ManagedUserListResponse> {
    return this.makeRequest("/users")
  }

  async createUser(data: CreateManagedUserRequest): Promise<ManagedUser> {
    return this.makeRequest("/users", { method: "POST", body: JSON.stringify(data) })
  }

  async updateUser(userId: string, data: UpdateManagedUserRequest): Promise<ManagedUser> {
    return this.makeRequest(`/users/${encodeURIComponent(userId)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  async resetUserPassword(userId: string): Promise<{ message: string }> {
    return this.makeRequest(`/users/${encodeURIComponent(userId)}/reset-password`, { method: "POST" })
  }

  async disableUser(userId: string): Promise<{ message: string }> {
    return this.makeRequest(`/users/${encodeURIComponent(userId)}`, { method: "DELETE" })
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

  async exportClosures(params: { day?: string; start?: string; end?: string }): Promise<{ items: any[]; totalCount: number }> {
    const searchParams = new URLSearchParams()
    if (params.day) searchParams.append("day", params.day)
    if (params.start) searchParams.append("start", params.start)
    if (params.end) searchParams.append("end", params.end)
    const query = searchParams.toString()
    return this.makeRequest(`/closures/export${query ? `?${query}` : ""}`)
  }

  async listAuditLogs(params?: { lastKey?: string; start?: string; end?: string }): Promise<any> {
    const searchParams = new URLSearchParams()
    if (params?.lastKey) searchParams.append("lastKey", params.lastKey)
    if (params?.start) searchParams.append("start", params.start)
    if (params?.end) searchParams.append("end", params.end)
    const query = searchParams.toString()
    return this.makeRequest(`/audit-logs${query ? `?${query}` : ""}`)
  }

  async createSupportRequest(data: CreateSupportRequest): Promise<SupportRequestResponse> {
    return this.makeRequest("/support-requests", {
      method: "POST",
      body: JSON.stringify(data),
    })
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
