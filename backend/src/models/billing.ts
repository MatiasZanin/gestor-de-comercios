import type { BillingStatus } from "../config/billing"

export interface BillingProfile {
  PK: string
  SK: "BILLING#PROFILE"
  type: "BILLING_PROFILE"
  commerceId: string
  status: BillingStatus
  ownerEmail: string
  ownerCognitoSub: string
  merchantName: string
  mercadoPagoPlanId: string
  mercadoPagoSubscriptionId?: string
  trialStartedAt?: string
  trialEndsAt?: string
  currentPeriodEndsAt?: string
  graceUntil?: string
  lastPaymentStatus?: string
  lastWebhookAt?: string
  updatedAt: string
  createdAt: string
}

export interface RegistrationRecord {
  PK: string
  SK: "REGISTRATION"
  type: "REGISTRATION"
  registrationId: string
  commerceId: string
  email: string
  firstName: string
  lastName: string
  merchantName: string
  status: BillingStatus | "checkout_created" | "processing" | "expired"
  checkoutUrl?: string
  mercadoPagoSubscriptionId?: string
  userPoolUsername?: string
  createdAt: string
  updatedAt: string
  expiresAt: number
  retryCount: number
}

export interface WebhookEventRecord {
  PK: string
  SK: string
  type: "MP_WEBHOOK_EVENT"
  eventId: string
  commerceId?: string
  subscriptionId?: string
  paymentId?: string
  eventType?: string
  processedAt: string
  rawRequestId?: string
}

export interface PublicBillingConfigResponse {
  monthlyAmount: number
  currencyId: string
  trialDays: number
  graceDays: number
  planId: string
  planReason: string
  frontendBaseUrl: string
  publicRegistrationPath: string
}

export interface PublicRegistrationRequest {
  firstName: string
  lastName: string
  email: string
  password: string
  merchantName: string
  acceptTerms: boolean
}

export interface PublicRegistrationResponse {
  registrationId: string
  commerceId: string
  checkoutUrl: string
  status: string
  email: string
}

export interface RegistrationStatusResponse {
  registrationId: string
  commerceId: string
  status: string
  checkoutUrl?: string
  billingProfile?: BillingProfile
  registration?: RegistrationRecord
}
