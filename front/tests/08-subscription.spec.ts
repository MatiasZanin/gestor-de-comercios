import { expect, test, type Page } from "@playwright/test"

const billingConfig = { monthlyAmount: 42000, currencyId: "ARS", trialDays: 30, graceDays: 3, planReason: "G&S Comercios" }

function authState(accountStatus: "pending_subscription" | "trial" | "active" | "past_due" | "cancelled", owner = true) {
  return {
    isAuthenticated: true,
    user: { username: "demo@example.com", email_verified: true, sub: owner ? "owner-sub" : "member-sub", email: "demo@example.com", "cognito:groups": ["admin"], commerceId: "commerce-uuid", commerceList: ["commerce-uuid"], accountStatus, role: "admin" },
    token: "token", commerceId: "commerce-uuid", accountStatus, role: "admin", isCommerceOwner: owner,
  }
}

type BillingFixture = {
  status: "pending_subscription" | "trial" | "active" | "past_due" | "cancelled"
  viewState: "never_subscribed" | "checkout_pending" | "trial_active" | "active" | "cancellation_scheduled" | "cancelled" | "expired" | "payment_pending" | "payment_rejected"
  merchantName?: string
  canManageSubscription?: boolean
  trialConsumed?: boolean
  trialEligible?: boolean
  checkoutUrl?: string
  billingPayerEmail?: string
  relevantDate?: { kind: "trial_ends" | "renews" | "access_until" | "grace_until" | "ended"; value: string }
}

async function setupBilling(page: Page, fixture: BillingFixture) {
  let current = {
    commerceId: "commerce-uuid",
    merchantName: "Mi comercio",
    canManageSubscription: true,
    trialConsumed: false,
    trialEligible: true,
    ...fixture,
  }
  let subscribeRequest: { email: string; idempotencyKey: string | undefined } | null = null
  let cancellationReason: string | null = null
  let cancellationIdempotencyKey: string | null = null

  await page.route("**/commerce-uuid/billing/status*", (route) => route.fulfill({ json: current }))
  await page.route("**/public/billing/config", (route) => route.fulfill({ json: billingConfig }))
  await page.route("**/commerce-uuid/billing/subscribe", async (route) => {
    const body = route.request().postDataJSON() as { payerEmail: string }
    subscribeRequest = { email: body.payerEmail, idempotencyKey: route.request().headers()["idempotency-key"] }
    await route.fulfill({ status: 201, json: { checkoutUrl: "https://mp.test/checkout", status: "pending_subscription", includesTrial: current.trialEligible } })
  })
  await page.route("**/commerce-uuid/billing/cancel", async (route) => {
    const body = route.request().postDataJSON() as { reason: string }
    cancellationReason = body.reason
    cancellationIdempotencyKey = route.request().headers()["idempotency-key"] ?? null
    current = { ...current, status: "cancelled", viewState: "cancellation_scheduled", relevantDate: { kind: "access_until", value: "2026-09-20T12:00:00.000Z" } }
    await route.fulfill({ json: { billing: current, notificationStatus: "queued" } })
  })
  await page.route("https://mp.test/checkout", (route) => route.fulfill({ contentType: "text/html", body: "Mercado Pago" }))

  return {
    subscribeRequest: () => subscribeRequest,
    cancellationReason: () => cancellationReason,
    cancellationIdempotencyKey: () => cancellationIdempotencyKey,
  }
}

test.describe("subscription dashboard", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  for (const scenario of [
    { accountStatus: "trial", viewState: "trial_active", label: "Prueba gratuita activa" },
    { accountStatus: "cancelled", viewState: "cancelled", label: "Suscripción cancelada" },
    { accountStatus: "past_due", viewState: "payment_rejected", label: "Pago rechazado" },
  ] as const) {
    test(`renders the ${scenario.viewState} state`, async ({ page }) => {
      await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState(scenario.accountStatus))
      await setupBilling(page, {
        status: scenario.accountStatus,
        viewState: scenario.viewState,
        trialConsumed: true,
        trialEligible: false,
      })
      await page.goto("/dashboard/suscripcion")
      await expect(page.getByText(scenario.label).first()).toBeVisible()
    })
  }

  test("shows the Dashboard visual language and the eligible trial copy", async ({ page }) => {
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("pending_subscription"))
    await setupBilling(page, { status: "pending_subscription", viewState: "never_subscribed" })
    await page.goto("/dashboard/suscripcion")

    await expect(page.getByRole("heading", { name: "Suscripción", exact: true })).toBeVisible()
    await expect(page.getByText("Gestioná tu suscripción al sistema")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Mi comercio" })).toBeVisible()
    await expect(page.getByText("Gracias por ser parte de Gestión & Stock.")).toBeVisible()
    await expect(page.getByText(/gratis durante 30 días si sos elegible/)).toBeVisible()
    await expect(page.getByText(/42\.000 por mes/)).toBeVisible()
  })

  test("validates email and starts the real checkout once with idempotency", async ({ page }) => {
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("pending_subscription"))
    const routes = await setupBilling(page, { status: "pending_subscription", viewState: "never_subscribed" })
    await page.goto("/dashboard/suscripcion")
    await page.getByRole("button", { name: "Iniciar prueba gratuita" }).click()
    await expect(page.getByText("Ingresá un email válido")).toBeVisible()
    await page.getByLabel("Email de Mercado Pago").fill("payer@example.com")
    await page.getByRole("button", { name: "Iniciar prueba gratuita" }).click()
    await expect.poll(() => routes.subscribeRequest()).toMatchObject({ email: "payer@example.com" })
    expect(routes.subscribeRequest()?.idempotencyKey).toBeTruthy()
  })

  test("continues an existing Mercado Pago checkout", async ({ page }) => {
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("pending_subscription"))
    await setupBilling(page, { status: "pending_subscription", viewState: "checkout_pending", checkoutUrl: "https://mp.test/checkout", trialConsumed: true, trialEligible: false })
    await page.goto("/dashboard/suscripcion")
    await expect(page.getByRole("button", { name: "Continuar en Mercado Pago" })).toBeVisible()
  })

  test("shows active subscription details and the hosted payment-method link", async ({ page }) => {
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("active"))
    await setupBilling(page, { status: "active", viewState: "active", trialConsumed: true, trialEligible: false, billingPayerEmail: "payer@example.com", relevantDate: { kind: "renews", value: "2026-09-20T02:00:00.000Z" } })
    await page.goto("/dashboard/suscripcion")
    await expect(page.getByText("Suscripción activa").first()).toBeVisible()
    await expect(page.getByText("19 de septiembre de 2026")).toBeVisible()
    await expect(page.getByText("payer@example.com")).toBeVisible()
    await expect(page.getByRole("link", { name: "Cambiar medio de pago" })).toHaveAttribute("href", "https://www.mercadopago.com.ar/subscriptions")
  })

  test("validates, sanitizes and submits the cancellation reason", async ({ page }) => {
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("active"))
    const routes = await setupBilling(page, { status: "active", viewState: "active", trialConsumed: true, trialEligible: false, billingPayerEmail: "payer@example.com" })
    await page.goto("/dashboard/suscripcion")
    await page.getByRole("button", { name: "Cancelar suscripción" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar suscripción" }).click()
    await expect(page.getByText("Contanos brevemente por qué cancelás")).toBeVisible()
    await page.getByLabel("Motivo").fill("  Me resulta caro  ")
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar suscripción" }).click()
    await expect.poll(() => routes.cancellationReason()).toBe("Me resulta caro")
    expect(routes.cancellationIdempotencyKey()).toBeTruthy()
    await expect(page.getByText("Recibimos tus comentarios.")).toBeVisible()
    await expect(page.getByText("Cancelación programada").first()).toBeVisible()
  })

  test("falls back when PROFILE merchantName is empty", async ({ page }) => {
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("pending_subscription"))
    await setupBilling(page, { status: "pending_subscription", viewState: "never_subscribed", merchantName: "" })
    await page.goto("/dashboard/suscripcion")
    await expect(page.getByRole("heading", { name: "Tu comercio" })).toBeVisible()
  })

  test("shows loading feedback and retries a failed profile request", async ({ page }) => {
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("pending_subscription"))
    let shouldFail = true
    await page.route("**/commerce-uuid/billing/status*", (route) => {
      if (shouldFail) {
        return route.fulfill({ status: 503, json: { error: "Servicio temporalmente no disponible" } })
      }
      return route.fulfill({ json: {
        commerceId: "commerce-uuid", merchantName: "Mi comercio", status: "pending_subscription",
        viewState: "never_subscribed", canManageSubscription: true, trialConsumed: false, trialEligible: true,
      } })
    })
    await page.route("**/public/billing/config", (route) => route.fulfill({ json: billingConfig }))
    await page.goto("/dashboard/suscripcion")
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible()
    shouldFail = false
    await page.getByRole("button", { name: "Reintentar" }).click()
    await expect(page.getByRole("heading", { name: "Mi comercio" })).toBeVisible()
  })

  test("offers re-subscription without another trial", async ({ page }) => {
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("cancelled"))
    await setupBilling(page, { status: "cancelled", viewState: "expired", trialConsumed: true, trialEligible: false, billingPayerEmail: "payer@example.com" })
    await page.goto("/dashboard/suscripcion")
    await expect(page.getByRole("heading", { name: "Volvé a suscribirte" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Volver a suscribirme" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Iniciar prueba gratuita" })).toHaveCount(0)
  })

  test("does not create a second checkout while a payment is pending", async ({ page }) => {
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("past_due"))
    await setupBilling(page, { status: "past_due", viewState: "payment_pending", trialConsumed: true, trialEligible: false })
    await page.goto("/dashboard/suscripcion")
    await expect(page.getByText("Pago pendiente").first()).toBeVisible()
    await expect(page.getByRole("link", { name: "Revisar en Mercado Pago" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Volver a suscribirme" })).toHaveCount(0)
  })

  test("redirects a non-owner away from billing", async ({ page }) => {
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("active", false))
    await setupBilling(page, { status: "active", viewState: "active", canManageSubscription: false, trialConsumed: true, trialEligible: false })
    await page.goto("/dashboard/suscripcion")
    await expect(page).toHaveURL(/\/dashboard$/)
  })

  test("shows restricted access to a blocked non-owner", async ({ page }) => {
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("past_due", false))
    await setupBilling(page, { status: "past_due", viewState: "payment_rejected", canManageSubscription: false, trialConsumed: true, trialEligible: false })
    await page.goto("/dashboard/suscripcion")
    await expect(page).toHaveURL(/\/acceso-restringido$/)
    await expect(page.getByText("Acceso restringido", { exact: true })).toBeVisible()
    await expect(page.getByText(/Contactá a la persona que creó el comercio/)).toBeVisible()
  })

  test("keeps the subscription cards usable on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("active"))
    await setupBilling(page, { status: "active", viewState: "active", trialConsumed: true, trialEligible: false, billingPayerEmail: "payer@example.com" })
    await page.goto("/dashboard/suscripcion")
    await expect(page.getByRole("heading", { name: "Suscripción", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Abrir menú" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Cambiar medio de pago" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Cancelar suscripción" })).toBeVisible()
  })
})
