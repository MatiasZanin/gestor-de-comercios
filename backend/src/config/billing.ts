export const BILLING_STATUS = {
  PENDING_SUBSCRIPTION: "pending_subscription",
  TRIAL: "trial",
  ACTIVE: "active",
  PAST_DUE: "past_due",
  CANCELLED: "cancelled",
} as const

export type BillingStatus = (typeof BILLING_STATUS)[keyof typeof BILLING_STATUS]

export const BILLING_ALLOWED_STATUSES = [
  BILLING_STATUS.TRIAL,
  BILLING_STATUS.ACTIVE,
  BILLING_STATUS.PAST_DUE,
  BILLING_STATUS.CANCELLED,
] as const

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

function readStringEnv(name: string, fallback = ""): string {
  return process.env[name] ?? fallback
}

export const billingConfig = {
  monthlyAmount: readNumberEnv("BILLING_MONTHLY_AMOUNT", 0),
  currencyId: readStringEnv("BILLING_CURRENCY_ID", "ARS"),
  trialDays: readNumberEnv("BILLING_TRIAL_DAYS", 30),
  graceDays: readNumberEnv("BILLING_GRACE_DAYS", 3),
  planId: readStringEnv("MERCADO_PAGO_PREAPPROVAL_PLAN_ID"),
  planReason: readStringEnv("BILLING_PLAN_REASON", "G&S Comercios"),
  frontendBaseUrl: readStringEnv("FRONTEND_BASE_URL", "http://localhost:3000"),
  publicRegistrationPath: readStringEnv("BILLING_PUBLIC_REGISTRATION_PATH", "/estado-cuenta"),
}

export function getBillingConfig() {
  return {
    monthlyAmount: billingConfig.monthlyAmount,
    currencyId: billingConfig.currencyId,
    trialDays: billingConfig.trialDays,
    graceDays: billingConfig.graceDays,
    planId: billingConfig.planId,
    planReason: billingConfig.planReason,
    frontendBaseUrl: billingConfig.frontendBaseUrl,
    publicRegistrationPath: billingConfig.publicRegistrationPath,
  }
}

export function addDays(iso: string, days: number): string {
  const date = new Date(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function isIsoAfterOrEqual(leftIso: string, rightIso: string): boolean {
  return new Date(leftIso).getTime() >= new Date(rightIso).getTime()
}
