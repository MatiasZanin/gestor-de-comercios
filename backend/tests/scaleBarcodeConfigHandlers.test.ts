const mockSend = jest.fn()
const mockAssertCommerceAccess = jest.fn()
const mockLogAudit = jest.fn()

jest.mock("@aws-sdk/lib-dynamodb", () => {
  const actual = jest.requireActual("@aws-sdk/lib-dynamodb")
  return {
    ...actual,
    DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockSend })) },
  }
})

jest.mock("../src/helpers/assertCommerceAccess", () => ({
  assertCommerceAccess: (...args: unknown[]) => mockAssertCommerceAccess(...args),
}))

jest.mock("../src/helpers/auditLogger", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}))

import { handler as getHandler } from "../src/handlers/getScaleBarcodeConfig"
import { handler as updateHandler } from "../src/handlers/updateScaleBarcodeConfig"

function event(role: "admin" | "vendedor", body?: unknown) {
  return {
    pathParameters: { commerceId: "commerce-1" },
    body: body === undefined ? undefined : JSON.stringify(body),
    requestContext: {
      authorizer: { jwt: { claims: { sub: "user-1", email: "user@example.com", "cognito:groups": [role] } } },
    },
  } as any
}

function responseBody(response: any) {
  return JSON.parse(response.body)
}

describe("scale barcode config handlers", () => {
  beforeEach(() => {
    process.env.TABLE_NAME = "table"
    mockSend.mockReset()
    mockAssertCommerceAccess.mockReset().mockResolvedValue(undefined)
    mockLogAudit.mockReset().mockResolvedValue(undefined)
  })

  it("allows admins and vendors to read the configuration", async () => {
    mockSend.mockResolvedValue({ Item: { scaleBarcodeConfig: { valueType: "weight", unit: "kg", decimals: 3 } } })

    for (const role of ["admin", "vendedor"] as const) {
      const response = await getHandler(event(role))
      expect(response).toMatchObject({ statusCode: 200 })
      expect(responseBody(response)).toEqual({
        scaleBarcodeConfig: { valueType: "weight", unit: "kg", decimals: 3 },
      })
    }
  })

  it("returns 404 when the profile has no configuration", async () => {
    mockSend.mockResolvedValue({ Item: {} })
    const response = await getHandler(event("admin"))
    expect(response).toMatchObject({ statusCode: 404 })
  })

  it("updates a valid configuration as admin", async () => {
    mockSend.mockResolvedValue({ Attributes: { scaleBarcodeConfig: { valueType: "price", decimals: 2 } } })
    const response = await updateHandler(event("admin", {
      scaleBarcodeConfig: { valueType: "price", decimals: 2 },
    }))

    expect(response).toMatchObject({ statusCode: 200 })
    expect(responseBody(response)).toEqual({ scaleBarcodeConfig: { valueType: "price", decimals: 2 } })
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.any(String),
      "commerce-1",
      "user-1",
      "user@example.com",
      "SCALE_BARCODE_CONFIG_UPDATE",
      { scaleBarcodeConfig: { valueType: "price", decimals: 2 } },
      expect.any(String)
    )
  })

  it("rejects vendor updates and invalid decimals", async () => {
    const forbidden = await updateHandler(event("vendedor", {
      scaleBarcodeConfig: { valueType: "price", decimals: 2 },
    }))
    expect(forbidden).toMatchObject({ statusCode: 403 })

    const invalid = await updateHandler(event("admin", {
      scaleBarcodeConfig: { valueType: "price", decimals: 6 },
    }))
    expect(invalid).toMatchObject({ statusCode: 400 })
    expect(mockSend).not.toHaveBeenCalled()
  })
})
