import { billingAllowsAccess } from "../src/helpers/assertCommerceAccess"
import type { BillingProfile } from "../src/models/billing"

const now = "2026-08-11T12:00:00.000Z"

function profile(status: BillingProfile["status"], dates: Partial<BillingProfile> = {}): BillingProfile {
  return {
    PK: "COM#test",
    SK: "BILLING#PROFILE",
    type: "BILLING_PROFILE",
    commerceId: "test",
    status,
    ownerEmail: "owner@example.com",
    ownerCognitoSub: "sub",
    merchantName: "Test",
    mercadoPagoPlanId: "plan",
    createdAt: now,
    updatedAt: now,
    ...dates,
  }
}

describe("billing access policy", () => {
  it.each(["trial", "active"] as const)("allows %s", (status) => {
    expect(billingAllowsAccess(profile(status), now)).toBe(true)
  })

  it("blocks pending subscriptions", () => {
    expect(billingAllowsAccess(profile("pending_subscription"), now)).toBe(false)
  })

  it("allows past_due only during grace", () => {
    expect(billingAllowsAccess(profile("past_due", { graceUntil: "2026-08-12T00:00:00.000Z" }), now)).toBe(true)
    expect(billingAllowsAccess(profile("past_due", { graceUntil: "2026-08-10T00:00:00.000Z" }), now)).toBe(false)
  })

  it("allows cancelled only through the covered period", () => {
    expect(billingAllowsAccess(profile("cancelled", { currentPeriodEndsAt: "2026-08-12T00:00:00.000Z" }), now)).toBe(true)
    expect(billingAllowsAccess(profile("cancelled", { currentPeriodEndsAt: "2026-08-10T00:00:00.000Z" }), now)).toBe(false)
  })
})
