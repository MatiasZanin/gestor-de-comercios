export interface MercadoPagoSubscription {
  id: string
  status?: string
  preapproval_plan_id?: string
  external_reference?: string
  payer_email?: string
  back_url?: string
  reason?: string
  init_point?: string
  next_payment_date?: string
  auto_recurring?: {
    frequency?: number
    frequency_type?: string
    repetitions?: number
    start_date?: string
    end_date?: string
    transaction_amount?: number | string
    currency_id?: string
    free_trial?: {
      frequency?: number
      frequency_type?: string
      first_invoice_offset?: number
    }
  }
  date_created?: string
  last_modified?: string
}

export interface MercadoPagoPayment {
  id: string
  status?: string
  status_detail?: string
  preapproval_id?: string
  external_reference?: string
  payer?: { email?: string; id?: string | number }
  metadata?: Record<string, unknown>
  date_created?: string
}

export interface MercadoPagoAuthorizedPayment {
  id: string | number
  status?: string
  status_detail?: string
  preapproval_id?: string
  payment?: { id?: string | number; status?: string; status_detail?: string }
  date_created?: string
  last_modified?: string
  debit_date?: string
}

export interface MercadoPagoSubscriptionSearchResult {
  paging?: { offset?: number; limit?: number; total?: number }
  results?: MercadoPagoSubscription[]
}

export interface MercadoPagoAuthorizedPaymentSearchResult {
  paging?: { offset?: number; limit?: number; total?: number }
  results?: MercadoPagoAuthorizedPayment[]
}

export interface MercadoPagoPlan {
  id: string
  reason?: string
  back_url?: string
  auto_recurring?: {
    frequency?: number
    frequency_type?: string
    repetitions?: number
    transaction_amount?: number | string
    currency_id?: string
    free_trial?: {
      frequency?: number
      frequency_type?: string
      first_invoice_offset?: number
    }
  }
  init_point?: string
}

export class MercadoPagoApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly path: string
  ) {
    super(message)
    this.name = "MercadoPagoApiError"
  }
}

export class MercadoPagoClient {
  constructor(private readonly accessToken: string) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    })

    const raw = await response.text()
    const body = raw ? JSON.parse(raw) : null

    if (!response.ok) {
      const message = body?.message || body?.error || `Mercado Pago error ${response.status}`
      throw new MercadoPagoApiError(
        typeof message === "string" ? message : JSON.stringify(message),
        response.status,
        path
      )
    }

    return body as T
  }

  getSubscription(id: string) {
    return this.request<MercadoPagoSubscription>(`/preapproval/${encodeURIComponent(id)}`)
  }

  getPayment(id: string) {
    return this.request<MercadoPagoPayment>(`/v1/payments/${encodeURIComponent(id)}`)
  }

  getAuthorizedPayment(id: string) {
    return this.request<MercadoPagoAuthorizedPayment>(`/authorized_payments/${encodeURIComponent(id)}`)
  }

  searchAuthorizedPayments(preapprovalId: string) {
    // Mercado Pago rejects values greater than 10 for this endpoint.
    const query = new URLSearchParams({ preapproval_id: preapprovalId, limit: "10" })
    return this.request<MercadoPagoAuthorizedPaymentSearchResult>(
      `/authorized_payments/search?${query.toString()}`
    )
  }

  searchAuthorizedPaymentsByPaymentId(paymentId: string) {
    const query = new URLSearchParams({ payment_id: paymentId, limit: "10" })
    return this.request<MercadoPagoAuthorizedPaymentSearchResult>(
      `/authorized_payments/search?${query.toString()}`
    )
  }

  searchSubscriptions(input: { payerEmail: string; planId?: string }) {
    const query = new URLSearchParams({
      payer_email: input.payerEmail,
      limit: "20",
    })
    if (input.planId) query.set("preapproval_plan_id", input.planId)
    return this.request<MercadoPagoSubscriptionSearchResult>(`/preapproval/search?${query.toString()}`)
  }

  cancelSubscription(id: string) {
    return this.request<MercadoPagoSubscription>(`/preapproval/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ status: "cancelled" }),
    })
  }

  getPlan(id: string) {
    return this.request<MercadoPagoPlan>(`/preapproval_plan/${encodeURIComponent(id)}`)
  }
}
