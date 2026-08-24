import { MercadoPagoApiError, MercadoPagoClient } from "../src/services/mercadoPagoClient"

describe("MercadoPagoClient", () => {
  afterEach(() => jest.restoreAllMocks())

  it("uses the authorized payments endpoint for recurring charges", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 42,
          preapproval_id: "subscription-1",
          status: "approved",
        }),
        {
          status: 200,
        }
      )
    )

    await new MercadoPagoClient("token").getAuthorizedPayment("42")

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mercadopago.com/authorized_payments/42",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      })
    )
  })

  it("creates an identified pending preapproval and keeps card data in Mercado Pago", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "subscription-1",
          status: "pending",
          init_point: "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=subscription-1",
        }),
        { status: 201 }
      )
    )

    await new MercadoPagoClient("token").createSubscription({
      payerEmail: "payer@example.com",
      externalReference: "commerce-1",
      backUrl: "https://api.example.com/prod/billing/mercadopago/return",
      idempotencyKey: "request-1",
      reason: "G&S Comercios",
      transactionAmount: 42000,
      currencyId: "ARS",
      trialDays: 30,
    })

    const [, request] = fetchMock.mock.calls[0]
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.mercadopago.com/preapproval")
    expect(request).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Bearer token",
        "X-Idempotency-Key": "request-1",
      }),
    })
    expect(JSON.parse(String(request?.body))).toEqual({
      reason: "G&S Comercios",
      payer_email: "payer@example.com",
      external_reference: "commerce-1",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: 42000,
        currency_id: "ARS",
        free_trial: { frequency: 30, frequency_type: "days" },
      },
      back_url: "https://api.example.com/prod/billing/mercadopago/return",
      status: "pending",
    })
    expect(String(request?.body)).not.toContain("card")
  })

  it("omits the free trial for reactivations", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "subscription-2", status: "pending", init_point: "https://mp.test" }), {
        status: 201,
      })
    )

    await new MercadoPagoClient("token").createSubscription({
      payerEmail: "payer@example.com",
      externalReference: "commerce-1",
      backUrl: "https://api.example.com/return",
      idempotencyKey: "request-2",
      reason: "G&S Comercios",
      transactionAmount: 42000,
      currencyId: "ARS",
    })

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(body.auto_recurring.free_trial).toBeUndefined()
  })

  it("searches subscriptions by payer and plan", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }))

    await new MercadoPagoClient("token").searchSubscriptions({
      payerEmail: "buyer+test@example.com",
      planId: "plan-1",
    })

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain("/preapproval/search?")
    expect(url).toContain("payer_email=buyer%2Btest%40example.com")
    expect(url).toContain("preapproval_plan_id=plan-1")
  })

  it("searches recurring invoices by subscription", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }))

    await new MercadoPagoClient("token").searchAuthorizedPayments("subscription-1")

    expect(String(fetchMock.mock.calls[0][0])).toContain("/authorized_payments/search?preapproval_id=subscription-1")
    expect(String(fetchMock.mock.calls[0][0])).toContain("limit=10")
  })

  it("finds the recurring invoice associated with a payment webhook", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }))

    await new MercadoPagoClient("token").searchAuthorizedPaymentsByPaymentId("payment-1")

    expect(String(fetchMock.mock.calls[0][0])).toContain("/authorized_payments/search?payment_id=payment-1")
    expect(String(fetchMock.mock.calls[0][0])).toContain("limit=10")
  })

  it("cancels future charges through the Mercado Pago preapproval API", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ id: "subscription-1", status: "cancelled" }), { status: 200 }))

    await new MercadoPagoClient("token").cancelSubscription("subscription-1")

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mercadopago.com/preapproval/subscription-1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ status: "cancelled" }),
      })
    )
  })

  it("preserves the Mercado Pago response status in API errors", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ message: "not found" }), { status: 404 }))

    await expect(new MercadoPagoClient("token").getSubscription("missing")).rejects.toMatchObject<
      Partial<MercadoPagoApiError>
    >({
      name: "MercadoPagoApiError",
      statusCode: 404,
    })
  })
})
