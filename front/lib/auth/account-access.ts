import type { AuthState } from "@/lib/types/auth"
import type { BillingStatusResponse } from "@/lib/types/api"

function billingAllowsAccess(status: BillingStatusResponse | null | undefined): boolean {
  if (!status) return false

  if (status.status === "trial" || status.status === "active") return true

  if (status.status === "past_due") {
    return !!status.graceUntil && new Date(status.graceUntil).getTime() >= Date.now()
  }

  if (status.status === "cancelled") {
    return !!status.currentPeriodEndsAt && new Date(status.currentPeriodEndsAt).getTime() >= Date.now()
  }

  return false
}

export function hasApplicationAccess(
  state: Pick<AuthState, "accountStatus" | "commerceId" | "role">,
  billingStatus?: BillingStatusResponse | null,
  billingStatusLoaded = false,
): boolean {
  if (billingStatusLoaded) {
    return billingAllowsAccess(billingStatus)
  }
  if (["trial", "active", "past_due", "cancelled"].includes(state.accountStatus ?? "")) return true
  // Existing accounts predate billing profiles and do not carry accountStatus.
  return state.accountStatus === null && !!state.commerceId && !!state.role
}

export function authenticatedHome(
  state: Pick<AuthState, "accountStatus" | "commerceId" | "role"> & { isCommerceOwner?: boolean | null }
): string {
  if (state.commerceId && state.role) return "/dashboard"
  return state.isCommerceOwner === true
    ? "/dashboard/suscripcion"
    : "/acceso-restringido"
}
