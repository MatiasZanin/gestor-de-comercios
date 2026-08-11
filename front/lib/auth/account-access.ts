import type { AuthState } from "@/lib/types/auth"

export function hasApplicationAccess(state: Pick<AuthState, "accountStatus" | "commerceId" | "role">): boolean {
  if (["trial", "active", "past_due", "cancelled"].includes(state.accountStatus ?? "")) return true
  // Existing accounts predate billing profiles and do not carry accountStatus.
  return state.accountStatus === null && !!state.commerceId && !!state.role
}

export function authenticatedHome(state: Pick<AuthState, "accountStatus" | "commerceId" | "role">): string {
  return hasApplicationAccess(state) ? "/dashboard" : "/suscripcion"
}
