import {
  buildBillingStatusResponse,
  deriveRelevantBillingDate,
  deriveSubscriptionViewState,
  isTrialEligible,
  sanitizeCancellationReason,
} from "../src/services/billingUseCase"
import type { BillingProfile, SubscriptionRecord } from "../src/models/billing"

function profile(status: BillingProfile["status"], overrides: Partial<BillingProfile> = {}): BillingProfile {
  return {
    PK: "COM#commerce-1",
    SK: "BILLING#PROFILE",
    type: "BILLING_PROFILE",
    commerceId: "commerce-1",
    status,
    ownerEmail: "owner@example.com",
    ownerCognitoSub: "owner-sub",
    merchantName: "Legacy name",
    mercadoPagoPlanId: "plan-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function history(status = "cancelled", includesTrial = false): SubscriptionRecord {
  return {
    PK: "COM#commerce-1",
    SK: "SUBSCRIPTION#subscription-1",
    type: "BILLING_SUBSCRIPTION",
    commerceId: "commerce-1",
    subscriptionId: "subscription-1",
    planId: "plan-1",
    payerEmail: "payer@example.com",
    status,
    includesTrial,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
}

describe("billing view state", () => {
  it.each([
    [profile("pending_subscription"), [], "never_subscribed"],
    [
      profile("pending_subscription", {
        pendingCheckoutUrl: "https://mp.test",
      }),
      [],
      "checkout_pending",
    ],
    [profile("trial"), [], "trial_active"],
    [profile("active"), [], "active"],
    [profile("cancelled", { currentPeriodEndsAt: "2999-01-01T00:00:00.000Z" }), [], "cancellation_scheduled"],
    [
      profile("cancelled", {
        currentPeriodEndsAt: "2020-01-01T00:00:00.000Z",
        lastPaymentStatus: "cancelled",
      }),
      [],
      "cancelled",
    ],
    [profile("cancelled", { currentPeriodEndsAt: "2020-01-01T00:00:00.000Z" }), [], "expired"],
    [profile("past_due", { lastPaymentStatus: "pending" }), [], "payment_pending"],
    [profile("past_due", { lastPaymentStatus: "rejected" }), [], "payment_rejected"],
    [
      profile("pending_subscription", {
        trialConsumedAt: "2026-01-01T00:00:00.000Z",
      }),
      [history()],
      "expired",
    ],
  ] as const)("derives %s", (billing, records, expected) => {
    expect(deriveSubscriptionViewState(billing, [...records])).toBe(expected)
  })

  it("returns the relevant Argentine-facing date kind", () => {
    const billing = profile("trial", {
      trialEndsAt: "2026-09-20T00:00:00.000Z",
    })
    expect(deriveRelevantBillingDate(billing, "trial_active")).toEqual({
      kind: "trial_ends",
      value: "2026-09-20T00:00:00.000Z",
    })
  })

  it("takes merchantName only from PROFILE and hides management data from other members", () => {
    const billing = profile("pending_subscription", {
      merchantName: "Legacy billing name",
      billingPayerEmail: "payer@example.com",
      pendingCheckoutUrl: "https://mp.test/checkout",
    })
    const memberResponse = buildBillingStatusResponse({
      profile: billing,
      commerce: { merchantName: "  Nombre desde PROFILE  ", ownerCognitoSub: "owner-sub" },
      history: [],
      current: null,
      actorSub: "member-sub",
    })
    expect(memberResponse).toMatchObject({
      merchantName: "Nombre desde PROFILE",
      canManageSubscription: false,
    })
    expect(memberResponse.billingPayerEmail).toBeUndefined()
    expect(memberResponse.checkoutUrl).toBeUndefined()

    expect(
      buildBillingStatusResponse({
        profile: billing,
        commerce: { merchantName: "", ownerCognitoSub: "owner-sub" },
        history: [],
        current: null,
        actorSub: "owner-sub",
      }),
    ).toMatchObject({ merchantName: "", canManageSubscription: true })
  })

  it("sanitizes and validates cancellation reasons", () => {
    expect(sanitizeCancellationReason("  Muy\ncaro\u0000  ")).toBe("Muy caro")
    expect(() => sanitizeCancellationReason(" \n ")).toThrow("Ingresá el motivo")
    expect(() => sanitizeCancellationReason("a".repeat(1001))).toThrow("1000")
  })

  it("only grants a trial to a commerce with no subscription history", () => {
    expect(isTrialEligible(profile("pending_subscription"), [])).toBe(true)
    expect(isTrialEligible(profile("pending_subscription"), [history("cancelled", false)])).toBe(false)
    expect(
      isTrialEligible(
        profile("pending_subscription", {
          trialStartedAt: "2026-01-01T00:00:00.000Z",
        }),
        [],
      ),
    ).toBe(false)
  })
})
