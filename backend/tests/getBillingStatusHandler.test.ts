import { handler } from "../src/handlers/getBillingStatus"
import { getProtectedBillingStatus } from "../src/services/billingUseCase"
import { assertCommerceAccess } from "../src/helpers/assertCommerceAccess"

jest.mock("../src/services/billingUseCase", () => ({
  getProtectedBillingStatus: jest.fn(),
}))

jest.mock("../src/helpers/assertCommerceAccess", () => ({
  assertCommerceAccess: jest.fn(),
}))

const mockedGetBillingStatus = getProtectedBillingStatus as jest.MockedFunction<typeof getProtectedBillingStatus>
const mockedAssertCommerceAccess = assertCommerceAccess as jest.MockedFunction<typeof assertCommerceAccess>

describe("getBillingStatus handler", () => {
  beforeEach(() => {
    mockedGetBillingStatus.mockReset()
    mockedAssertCommerceAccess.mockReset()
    mockedAssertCommerceAccess.mockResolvedValue(undefined)
    mockedGetBillingStatus.mockResolvedValue({
      commerceId: "commerce-1",
      merchantName: "Demo",
      status: "trial",
      trialConsumed: false,
    } as any)
  })

  it("passes forceRefresh=true to the billing status lookup", async () => {
    await handler({
      pathParameters: { commerceId: "commerce-1" },
      queryStringParameters: { forceRefresh: "true" },
    } as any)

    expect(mockedAssertCommerceAccess).toHaveBeenCalledWith(
      expect.objectContaining({ pathParameters: { commerceId: "commerce-1" } }),
      "commerce-1",
      { requireSubscription: false },
    )
    expect(mockedGetBillingStatus).toHaveBeenCalledWith("commerce-1", { forceRefresh: true })
  })
})
