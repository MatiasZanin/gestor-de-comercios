import crypto from "crypto"
import { buildWebhookManifest, validateMercadoPagoWebhookSignature } from "../src/helpers/mercadoPagoWebhook"

describe("Mercado Pago webhook signature", () => {
  it("validates a correct signature", () => {
    const secret = "super-secret"
    const input = {
      dataId: "123456",
      requestId: "req-abc",
      timestamp: "1700000000",
    }
    const manifest = buildWebhookManifest(input)
    expect(manifest).toBe("id:123456;request-id:req-abc;ts:1700000000;")
    const signature = crypto.createHmac("sha256", secret).update(manifest).digest("hex")

    const result = validateMercadoPagoWebhookSignature({
      signature: `ts=${input.timestamp},v1=${signature}`,
      requestId: input.requestId,
      dataId: input.dataId,
      secret,
    })

    expect(result.signature).toBe(signature)
    expect(result.requestId).toBe(input.requestId)
    expect(result.dataId).toBe(input.dataId)
  })

  it("omits missing values while retaining the required terminators", () => {
    expect(buildWebhookManifest({ requestId: "req-abc", timestamp: "1700000000" })).toBe(
      "request-id:req-abc;ts:1700000000;"
    )
  })

  it("rejects an invalid signature", () => {
    expect(() =>
      validateMercadoPagoWebhookSignature({
        signature: "ts=1700000000,v1=bad-signature",
        requestId: "req-abc",
        dataId: "123456",
        secret: "super-secret",
      })
    ).toThrow("Invalid Mercado Pago webhook signature")
  })
})
