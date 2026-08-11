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
  metadata?: Record<string, unknown>
  date_created?: string
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
      throw new Error(typeof message === "string" ? message : JSON.stringify(message))
    }

    return body as T
  }

  createSubscription(input: {
    planId: string
    payerEmail: string
    externalReference: string
    reason: string
    backUrl: string
  }) {
    return this.request<MercadoPagoSubscription>("/preapproval", {
      method: "POST",
      body: JSON.stringify({
        preapproval_plan_id: input.planId,
        payer_email: input.payerEmail,
        external_reference: input.externalReference,
        reason: input.reason,
        back_url: input.backUrl,
      }),
    })
  }

  getSubscription(id: string) {
    return this.request<MercadoPagoSubscription>(`/preapproval/${encodeURIComponent(id)}`)
  }

  getPayment(id: string) {
    return this.request<MercadoPagoPayment>(`/v1/payments/${encodeURIComponent(id)}`)
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
