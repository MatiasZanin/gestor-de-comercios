import crypto from "crypto"
import { handler } from "../src/handlers/mercadoPagoWebhook"
import { buildWebhookManifest } from "../src/helpers/mercadoPagoWebhook"
import { processMercadoPagoWebhook } from "../src/services/billingUseCase"

jest.mock("../src/services/billingUseCase", () => ({
  processMercadoPagoWebhook: jest.fn(),
}))

const processWebhook = processMercadoPagoWebhook as jest.MockedFunction<typeof processMercadoPagoWebhook>

describe("Mercado Pago webhook handler", () => {
  const secret = "webhook-secret"

  beforeEach(() => {
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = secret
    processWebhook.mockReset()
    processWebhook.mockResolvedValue({ duplicate: false, result: { ok: true } })
  })

  it("validates the query-string data.id and processes the body event", async () => {
    const timestamp = "1700000000"
    const requestId = "request-1"
    const signedDataId = "ABC123"
    const manifest = buildWebhookManifest({ dataId: signedDataId, requestId, timestamp })
    const hash = crypto.createHmac("sha256", secret).update(manifest).digest("hex")

    const response = await handler({
      version: "2.0",
      routeKey: "POST /webhooks/mercadopago",
      rawPath: "/webhooks/mercadopago",
      rawQueryString: "data.id=ABC123",
      headers: {
        "x-request-id": requestId,
        "x-signature": `ts=${timestamp},v1=${hash}`,
      },
      queryStringParameters: { "data.id": signedDataId },
      requestContext: {} as any,
      body: JSON.stringify({
        id: "event-1",
        type: "subscription_preapproval",
        data: { id: signedDataId },
      }),
      isBase64Encoded: false,
    })

    expect(response).toMatchObject({ statusCode: 200 })
    expect(processWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "event-1",
        requestId,
        topic: "subscription_preapproval",
        dataId: signedDataId,
      })
    )
  })

  it("returns 403 and does not process an invalid signature", async () => {
    const response = await handler({
      version: "2.0",
      routeKey: "POST /webhooks/mercadopago",
      rawPath: "/webhooks/mercadopago",
      rawQueryString: "data.id=123456",
      headers: {
        "x-request-id": "request-2",
        "x-signature": "ts=1700000000,v1=bad",
      },
      queryStringParameters: { "data.id": "123456" },
      requestContext: {} as any,
      body: JSON.stringify({ type: "subscription_preapproval", data: { id: "123456" } }),
      isBase64Encoded: false,
    })

    expect(response).toMatchObject({ statusCode: 403 })
    expect(processWebhook).not.toHaveBeenCalled()
  })
})
