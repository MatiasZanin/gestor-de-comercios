import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda"
import { assertCommerceOwner } from "../src/helpers/assertCommerceOwner"
import { assertCommerceAccess } from "../src/helpers/assertCommerceAccess"
import { getCommerceProfile } from "../src/repositories/userRepository"

jest.mock("../src/helpers/assertCommerceAccess", () => ({
  assertCommerceAccess: jest.fn(),
}))
jest.mock("../src/repositories/userRepository", () => ({
  getCommerceProfile: jest.fn(),
}))

const access = jest.mocked(assertCommerceAccess)
const getProfile = jest.mocked(getCommerceProfile)

function event(sub: string): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    requestContext: { authorizer: { jwt: { claims: { sub }, scopes: [] } } },
  } as unknown as APIGatewayProxyEventV2WithJWTAuthorizer
}

describe("assertCommerceOwner", () => {
  beforeEach(() => {
    access.mockResolvedValue(undefined)
    getProfile.mockResolvedValue({
      PK: "COM#commerce-1",
      SK: "PROFILE",
      type: "COMMERCE",
      commerceId: "commerce-1",
      merchantName: "Demo",
      ownerCognitoSub: "owner-sub",
      ownerEmail: "owner@example.com",
      scaleBarcodeConfig: { valueType: "weight", unit: "kg", decimals: 3 },
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    })
  })

  it("allows only PROFILE.ownerCognitoSub", async () => {
    await expect(assertCommerceOwner(event("owner-sub"), "commerce-1")).resolves.toBeUndefined()
    await expect(assertCommerceOwner(event("another-admin"), "commerce-1")).rejects.toMatchObject({ statusCode: 403 })
  })
})
