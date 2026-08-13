import { handler } from "../src/handlers/mercadoPagoReturn"
import { reconcileBillingFromMercadoPagoReturn } from "../src/services/billingUseCase"

jest.mock("../src/services/billingUseCase", () => ({
  reconcileBillingFromMercadoPagoReturn: jest.fn(),
}))

const reconcileReturn = reconcileBillingFromMercadoPagoReturn as jest.MockedFunction<
  typeof reconcileBillingFromMercadoPagoReturn
>

describe("Mercado Pago return handler", () => {
  beforeEach(() => {
    reconcileReturn.mockReset()
    reconcileReturn.mockResolvedValue({ ignored: false } as any)
  })

  it("reconciles the preapproval before redirecting to the subscription page", async () => {
    const response = await handler({
      queryStringParameters: { preapproval_id: "subscription-1" },
    } as any)

    expect(reconcileReturn).toHaveBeenCalledWith("subscription-1")
    expect(response).toMatchObject({
      statusCode: 302,
      headers: expect.objectContaining({
        Location:
          "http://localhost:3000/suscripcion?mercadopago_return=1&preapproval_id=subscription-1",
      }),
    })
  })

  it("still returns the customer to the application if reconciliation is temporarily unavailable", async () => {
    reconcileReturn.mockRejectedValue(new Error("temporary error"))
    jest.spyOn(console, "warn").mockImplementation(() => undefined)

    const response = await handler({
      queryStringParameters: { preapproval_id: "subscription-2" },
    } as any)
    const result = response as { statusCode: number; headers?: Record<string, string> }

    expect(result.statusCode).toBe(302)
    expect(result.headers?.Location).toContain("preapproval_id=subscription-2")
  })
})
