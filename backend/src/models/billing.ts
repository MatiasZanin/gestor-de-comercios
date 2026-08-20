import type { BillingStatus } from "../config/billing"

export type RegistrationStatus =
  | "email_verification_pending"
  | "pending_subscription"
  | "trial"
  | "active"
  | "past_due"
  | "cancelled"

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
  currentSubscriptionId?: string
  mercadoPagoSubscriptionId?: string
  billingPayerEmail?: string
  pendingCheckoutUrl?: string
  pendingIncludesTrial?: boolean
  trialConsumedAt?: string
  trialStartedAt?: string
  trialEndsAt?: string
  currentPeriodEndsAt?: string
  graceUntil?: string
  lastPaymentStatus?: string
  lastWebhookAt?: string
  lastReconciledAt?: string
  updatedAt: string
  createdAt: string
}

export interface SubscriptionRecord {
  PK: string
  SK: string
  type: "BILLING_SUBSCRIPTION"
  commerceId: string
  subscriptionId: string
  planId: string
  payerEmail: string
  status: string
  includesTrial: boolean
  checkoutUrl?: string
  replacedAt?: string
  createdAt: string
  updatedAt: string
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
  status: RegistrationStatus
  userPoolUsername: string
  ownerCognitoSub?: string
  createdAt: string
  updatedAt: string
  retryCount: number
  // Legacy records may contain expiresAt. Registration reuse intentionally ignores it.
  expiresAt?: number
}

export interface WebhookEventRecord {
  PK: string
  SK: string
  type: "MP_WEBHOOK_EVENT"
  eventId: string
  eventType?: string
  subscriptionId?: string
  paymentId?: string
  processedAt: string
  rawRequestId?: string
}

export interface PublicBillingConfigResponse {
  monthlyAmount: number
  currencyId: string
  trialDays: number
  graceDays: number
  planReason: string
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
  status: RegistrationStatus
  maskedEmail: string
}

export interface RegistrationStatusResponse {
  registrationId: string
  status: RegistrationStatus
  maskedEmail: string
  merchantName: string
}

export interface BillingStatusResponse {
  commerceId: string
  merchantName: string
  status: BillingStatus
  viewState: SubscriptionViewState
  canManageSubscription: boolean
  trialConsumed: boolean
  trialEligible: boolean
  relevantDate?: {
    kind: "trial_ends" | "renews" | "access_until" | "grace_until" | "ended"
    value: string
  }
  trialEndsAt?: string
  currentPeriodEndsAt?: string
  graceUntil?: string
  lastPaymentStatus?: string
  checkoutUrl?: string
  billingPayerEmail?: string
}

export interface CreateSubscriptionResponse {
  checkoutUrl: string
  status: BillingStatus
  includesTrial: boolean
}

export type SubscriptionViewState =
  | "never_subscribed"
  | "checkout_pending"
  | "trial_active"
  | "active"
  | "cancellation_scheduled"
  | "cancelled"
  | "expired"
  | "payment_pending"
  | "payment_rejected"

export type CancellationNotificationStatus = "pending" | "queued" | "sent" | "failed"

export interface BillingCancellationRecord {
  PK: string
  SK: string
  type: "BILLING_CANCELLATION"
  commerceId: string
  cancellationId: string
  idempotencyKeyHash: string
  status: "processing" | "completed" | "failed"
  notificationStatus: CancellationNotificationStatus
  subscriptionId: string
  merchantName: string
  ownerEmail: string
  actorEmail?: string
  billingPayerEmail?: string
  reason: string
  cancelledAt?: string
  createdAt: string
  updatedAt: string
  ttl: number
}

export interface CancellationFeedbackMessage {
  cancellationId: string
  commerceId: string
  recordKey: { PK: string; SK: string }
}

export interface CancelSubscriptionResponse {
  billing: BillingStatusResponse
  notificationStatus: CancellationNotificationStatus
}

export interface BillingActionRecord {
  PK: string
  SK: string
  type: "BILLING_ACTION"
  commerceId: string
  action: "subscribe"
  idempotencyKeyHash: string
  status: "processing" | "completed" | "failed"
  response?: CreateSubscriptionResponse
  createdAt: string
  updatedAt: string
  ttl: number
}

export interface BillingPayerLink {
  PK: string
  SK: "BILLING"
  type: "BILLING_PAYER_LINK"
  payerEmail: string
  commerceId: string
  createdAt: string
  updatedAt: string
}
