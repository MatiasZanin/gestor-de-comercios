import { expect, test } from "@playwright/test"

const billingConfig = {
  monthlyAmount: 12000,
  currencyId: "ARS",
  trialDays: 30,
  graceDays: 3,
  planId: "plan_123",
  planReason: "G&S Comercios",
  frontendBaseUrl: "http://localhost:3000",
  publicRegistrationPath: "/estado-cuenta",
}

test.describe("public signup", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("anonymous users can open the public signup page", async ({ page }) => {
    await page.route("**/public/billing/config", async (route) => {
      await route.fulfill({ json: billingConfig })
    })

    await page.goto("/registrarme")

    await expect(page.getByRole("heading", { name: "Crear cuenta y probar gratis" })).toBeVisible()
    await expect(page.getByText("30 días gratis. Luego")).toBeVisible()
  })

  test("authenticated users are redirected away from /registrarme", async ({ page }) => {
    await page.addInitScript((state) => {
      window.localStorage.setItem("authState", JSON.stringify(state))
    }, {
      isAuthenticated: true,
      user: {
        username: "demo",
        email_verified: true,
        sub: "sub-1",
        email: "demo@example.com",
        "cognito:groups": ["admin"],
        commerceId: "com_demo",
        commerceList: ["com_demo"],
        registrationId: "reg-1",
        accountStatus: "active",
        role: "admin",
      },
      token: "token",
      commerceId: "com_demo",
      accountStatus: "active",
      role: "admin",
    })

    await page.goto("/registrarme")
    await expect(page).toHaveURL(/\/dashboard/)
  })
})

test.describe("account status page", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("shows pending subscription status and offers retry", async ({ page }) => {
    await page.addInitScript((state) => {
      window.localStorage.setItem("authState", JSON.stringify(state))
    }, {
      isAuthenticated: true,
      user: {
        username: "demo",
        email_verified: true,
        sub: "sub-2",
        email: "pending@example.com",
        "cognito:groups": [],
        commerceId: null,
        commerceList: [],
        registrationId: "reg-pending",
        accountStatus: "pending_subscription",
      },
      token: "token",
      commerceId: null,
      accountStatus: "pending_subscription",
      role: null,
    })

    await page.route("**/public/billing/config", async (route) => {
      await route.fulfill({ json: billingConfig })
    })

    await page.route("**/public/registrations/reg-pending", async (route) => {
      await route.fulfill({
        json: {
          registrationId: "reg-pending",
          commerceId: "com_pending",
          status: "pending_subscription",
          checkoutUrl: "https://checkout.mercadopago.com/test",
          registration: {
            email: "pending@example.com",
            merchantName: "Mi Comercio",
            status: "pending_subscription",
            checkoutUrl: "https://checkout.mercadopago.com/test",
            registrationId: "reg-pending",
          },
          billingProfile: {
            PK: "COM#com_pending",
            SK: "BILLING#PROFILE",
            type: "BILLING_PROFILE",
            commerceId: "com_pending",
            status: "pending_subscription",
            ownerEmail: "pending@example.com",
            ownerCognitoSub: "",
            merchantName: "Mi Comercio",
            mercadoPagoPlanId: "plan_123",
            createdAt: "2026-08-10T00:00:00.000Z",
            updatedAt: "2026-08-10T00:00:00.000Z",
          },
        },
      })
    })

    await page.goto("/estado-cuenta?registrationId=reg-pending")
    await expect(page.getByText("Esperando autorización de Mercado Pago")).toBeVisible()
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible()
  })
})
