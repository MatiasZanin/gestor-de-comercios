import type {
  BillingProfile,
  BillingStatus,
  PublicBillingConfig,
  PublicRegistrationRequest,
  PublicRegistrationResponse,
  RegistrationStatusResponse,
} from "@/lib/types/api"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message = payload?.error?.message || payload?.error || "Unexpected error"
    throw new Error(message)
  }

  return response.json()
}

export async function getPublicBillingConfig(): Promise<PublicBillingConfig> {
  return request<PublicBillingConfig>("/public/billing/config")
}

export async function createPublicRegistration(
  data: PublicRegistrationRequest
): Promise<PublicRegistrationResponse> {
  return request<PublicRegistrationResponse>("/public/registrations", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function getPublicRegistrationStatus(
  registrationId: string
): Promise<RegistrationStatusResponse> {
  return request<RegistrationStatusResponse>(`/public/registrations/${encodeURIComponent(registrationId)}`)
}

export async function confirmRegistrationEmail(registrationId: string, code: string) {
  return request<{ registrationId: string; status: string; loginUrl: string }>(
    `/public/registrations/${encodeURIComponent(registrationId)}/confirm-email`,
    { method: "POST", body: JSON.stringify({ code }) },
  )
}

export async function resendRegistrationCode(registrationId: string) {
  return request<{ sent: boolean }>(
    `/public/registrations/${encodeURIComponent(registrationId)}/resend-code`,
    { method: "POST", body: "{}" },
  )
}

export function getBillingCopy(config: PublicBillingConfig): string {
  const price = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: config.currencyId || "ARS",
    minimumFractionDigits: 0,
  }).format(config.monthlyAmount || 0)

  return `${config.trialDays} días gratis. Luego ${price} por mes. Podés cancelar cuando quieras.`
}

export function getStatusLabel(status: BillingStatus | string): string {
  switch (status) {
    case "checkout_created":
    case "email_verification_pending":
    case "pending_subscription":
      return "Pendiente de suscripción"
    case "trial":
      return "Período de prueba"
    case "active":
      return "Activa"
    case "past_due":
      return "Pago pendiente"
    case "cancelled":
      return "Cancelada"
    default:
      return "Estado desconocido"
  }
}

export type { BillingProfile, BillingStatus, PublicBillingConfig, PublicRegistrationRequest, PublicRegistrationResponse, RegistrationStatusResponse }
