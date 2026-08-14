import { expect, test, type Page } from "@playwright/test"

const billingConfig = {
  monthlyAmount: 42000,
  currencyId: "ARS",
  trialDays: 30,
  graceDays: 3,
  planReason: "G&S Comercios",
}

function authState(accountStatus: "pending_subscription" | "trial" | "active" | "past_due" | "cancelled") {
  return {
    isAuthenticated: true,
    user: {
      username: "demo@example.com",
      email_verified: true,
      sub: "sub",
      email: "demo@example.com",
      "cognito:groups": ["admin"],
      commerceId: "commerce-uuid",
      commerceList: ["commerce-uuid"],
      accountStatus,
      role: "admin",
    },
    token: "token",
    commerceId: "commerce-uuid",
    accountStatus,
    role: "admin",
  }
}

async function setupBilling(page: Page, billingStatus: Record<string, any>) {
  let firstForceRefresh: boolean | null = null
  let seenCall = false

  await page.route("**/commerce-uuid/billing/status*", async (route) => {
    const url = new URL(route.request().url())
    if (!seenCall) {
      firstForceRefresh = url.searchParams.get("forceRefresh") === "true"
      seenCall = true
    }
    await route.fulfill({ json: billingStatus })
  })

  await page.route("**/public/billing/config", (route) => route.fulfill({ json: billingConfig }))

  return {
    getFirstForceRefresh: () => firstForceRefresh,
  }
}

test.describe("subscription dashboard", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("pending subscriptions can only manage their subscription", async ({ page }) => {
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("pending_subscription"))
    const routes = await setupBilling(page, {
      commerceId: "commerce-uuid",
      merchantName: "Mi comercio",
      status: "pending_subscription",
      trialConsumed: false,
    })

    await page.goto("/dashboard/suscripcion")

    await expect(page).toHaveURL(/\/dashboard\/suscripcion/)
    await expect.poll(() => routes.getFirstForceRefresh()).toBe(true)
    await expect(page.getByRole("heading", { name: "Mi comercio" })).toBeVisible()
    await expect(page.getByText("Pendiente de suscripción")).toBeVisible()
    await expect(page.getByRole("button", { name: "Iniciar prueba gratuita" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Suscripción" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Productos" })).toHaveCount(0)
    await expect(page.getByText("pending_subscription")).toHaveCount(0)
  })

  test("pending subscriptions with checkout show the Mercado Pago continuation", async ({ page }) => {
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("pending_subscription"))
    const routes = await setupBilling(page, {
      commerceId: "commerce-uuid",
      merchantName: "Mi comercio",
      status: "pending_subscription",
      trialConsumed: true,
      checkoutUrl: "https://mp.test/checkout",
    })

    await page.goto("/dashboard/suscripcion")

    await expect.poll(() => routes.getFirstForceRefresh()).toBe(true)
    await expect(page.getByRole("button", { name: "Continuar en Mercado Pago" })).toBeVisible()
  })

  test("trial accounts can enter the system and keep the full dashboard navigation", async ({ page }) => {
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("trial"))
    const routes = await setupBilling(page, {
      commerceId: "commerce-uuid",
      merchantName: "Mi comercio",
      status: "trial",
      trialConsumed: false,
      trialEndsAt: "2026-08-20T12:00:00.000Z",
      currentPeriodEndsAt: "2026-08-20T12:00:00.000Z",
    })

    await page.goto("/dashboard/suscripcion")

    await expect.poll(() => routes.getFirstForceRefresh()).toBe(true)
    await expect(page.getByText("Prueba activa")).toBeVisible()
    await expect(page.getByRole("button", { name: "Ir al sistema" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Cancelar suscripción" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Productos" })).toBeVisible()
  })

  test("past due accounts keep access during grace and still show re-subscribe", async ({ page }) => {
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("past_due"))
    const routes = await setupBilling(page, {
      commerceId: "commerce-uuid",
      merchantName: "Mi comercio",
      status: "past_due",
      trialConsumed: true,
      graceUntil: "2026-08-20T12:00:00.000Z",
      currentPeriodEndsAt: "2026-08-20T12:00:00.000Z",
      lastPaymentStatus: "rejected",
    })

    await page.goto("/dashboard/suscripcion")

    await expect.poll(() => routes.getFirstForceRefresh()).toBe(true)
    await expect(page.getByText("Pago pendiente")).toBeVisible()
    await expect(page.getByRole("button", { name: "Volver a suscribirme" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Entrar al sistema" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Productos" })).toBeVisible()
  })

  test("past due accounts outside grace fall back to the limited sidebar", async ({ page }) => {
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("past_due"))
    const routes = await setupBilling(page, {
      commerceId: "commerce-uuid",
      merchantName: "Mi comercio",
      status: "past_due",
      trialConsumed: true,
      graceUntil: "2026-08-10T12:00:00.000Z",
      currentPeriodEndsAt: "2026-08-10T12:00:00.000Z",
      lastPaymentStatus: "rejected",
    })

    await page.goto("/dashboard/suscripcion")

    await expect.poll(() => routes.getFirstForceRefresh()).toBe(true)
    await expect(page.getByRole("button", { name: "Volver a suscribirme" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Ir al sistema" })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Suscripción" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Productos" })).toHaveCount(0)
  })

  test("cancelled accounts keep access while the covered period is valid", async ({ page }) => {
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("cancelled"))
    const routes = await setupBilling(page, {
      commerceId: "commerce-uuid",
      merchantName: "Mi comercio",
      status: "cancelled",
      trialConsumed: true,
      currentPeriodEndsAt: "2026-08-20T12:00:00.000Z",
      lastPaymentStatus: "cancelled",
    })

    await page.goto("/dashboard/suscripcion")

    await expect.poll(() => routes.getFirstForceRefresh()).toBe(true)
    await expect(page.getByText("Suscripción cancelada")).toBeVisible()
    await expect(page.getByRole("button", { name: "Volver a suscribirme" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Entrar al sistema" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Productos" })).toBeVisible()
  })

  test("cancelled accounts outside the covered period show only the subscription item", async ({ page }) => {
    await page.addInitScript((state) => localStorage.setItem("authState", JSON.stringify(state)), authState("cancelled"))
    const routes = await setupBilling(page, {
      commerceId: "commerce-uuid",
      merchantName: "Mi comercio",
      status: "cancelled",
      trialConsumed: true,
      currentPeriodEndsAt: "2026-08-10T12:00:00.000Z",
      lastPaymentStatus: "cancelled",
    })

    await page.goto("/dashboard/suscripcion")

    await expect.poll(() => routes.getFirstForceRefresh()).toBe(true)
    await expect(page.getByRole("button", { name: "Volver a suscribirme" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Ir al sistema" })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Suscripción" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Productos" })).toHaveCount(0)
  })
})
