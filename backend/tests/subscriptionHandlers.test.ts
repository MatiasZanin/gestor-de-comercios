import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda"
import { handler as createHandler, mercadoPagoReturnUrl } from "../src/handlers/createSubscription"
import { handler as cancelHandler } from "../src/handlers/cancelSubscription"
import { assertCommerceOwner } from "../src/helpers/assertCommerceOwner"
import { cancelBilling, createBillingSubscription } from "../src/services/billingUseCase"

jest.mock("../src/helpers/assertCommerceOwner", () => ({
  assertCommerceOwner: jest.fn(),
  authenticatedSubject: jest.fn(() => "owner-sub"),
  authenticatedEmail: jest.fn(() => "owner@example.com"),
}))
jest.mock("../src/services/billingUseCase", () => ({
  createBillingSubscription: jest.fn(),
  cancelBilling: jest.fn(),
}))

const ownerGuard = jest.mocked(assertCommerceOwner)
const createSubscription = jest.mocked(createBillingSubscription)
const cancelSubscription = jest.mocked(cancelBilling)

function event(body: object, idempotencyKey?: string): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    pathParameters: { commerceId: "commerce-1" },
    body: JSON.stringify(body),
    headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : {},
    requestContext: { domainName: "api.example.com", stage: "prod" },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer
}

describe("subscription management handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ownerGuard.mockResolvedValue(undefined)
  })

  it("requires owner access and forwards subscribe idempotency", async () => {
    createSubscription.mockResolvedValue({
      checkoutUrl: "https://mp.test",
      status: "pending_subscription",
      includesTrial: true,
    })
    const result = await createHandler(event({ payerEmail: "payer@example.com" }, "subscribe-request-1"))
    expect(ownerGuard).toHaveBeenCalledWith(expect.anything(), "commerce-1")
    expect(createSubscription).toHaveBeenCalledWith(
      "commerce-1",
      "payer@example.com",
      "subscribe-request-1",
      "https://api.example.com/prod/billing/mercadopago/return"
    )
    expect(result).toMatchObject({ statusCode: 201 })
  })

  it("rejects a subscribe request without idempotency", async () => {
    const result = await createHandler(event({ payerEmail: "payer@example.com" }))
    expect(result).toMatchObject({ statusCode: 400 })
    expect(createSubscription).not.toHaveBeenCalled()
  })

  it("builds the hosted checkout return URL for default API Gateway stages", () => {
    expect(
      mercadoPagoReturnUrl({
        requestContext: { domainName: "api.example.com", stage: "$default" },
      } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer)
    ).toBe("https://api.example.com/billing/mercadopago/return")
  })

  it("forwards cancellation reason, actor and idempotency", async () => {
    cancelSubscription.mockResolvedValue({
      billing: {
        commerceId: "commerce-1",
        merchantName: "Demo",
        status: "cancelled",
        viewState: "cancelled",
        canManageSubscription: true,
        trialConsumed: true,
        trialEligible: false,
      },
      notificationStatus: "queued",
    })
    const result = await cancelHandler(event({ reason: "No lo uso" }, "cancel-request-1"))
    expect(cancelSubscription).toHaveBeenCalledWith({
      commerceId: "commerce-1",
      reason: "No lo uso",
      idempotencyKey: "cancel-request-1",
      actorSub: "owner-sub",
      actorEmail: "owner@example.com",
    })
    expect(result).toMatchObject({ statusCode: 200 })
  })
})
