import { authService } from "@/lib/auth/cognito"
import type { ApiError, Product } from "@/lib/types/api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!

export class ApiClient {
  private static instance: ApiClient

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient()
    }
    return ApiClient.instance
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
    if (params?.lastKey) {
      searchParams.append("lastKey", params.lastKey)
    }

    const query = searchParams.toString()
    return this.makeRequest(`/products${query ? `?${query}` : ""}`)
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
}

export const apiClient = ApiClient.getInstance()
