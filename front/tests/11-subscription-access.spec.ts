import { expect, test, type Page } from "@playwright/test"

const billingConfig = {
  monthlyAmount: 42000,
  currencyId: "ARS",
  trialDays: 30,
  graceDays: 3,
  planReason: "G&S Comercios",
}

function authState(owner: boolean) {
  return {
    isAuthenticated: true,
    user: {
      username: "inactive@example.com",
      email_verified: true,
      sub: owner ? "owner-sub" : "admin-sub",
      email: "inactive@example.com",
      "cognito:groups": ["admin"],
      commerceId: "commerce-uuid",
      commerceList: ["commerce-uuid"],
      accountStatus: "pending_subscription",
      role: "admin",
    },
    token: "token",
    commerceId: "commerce-uuid",
    accountStatus: "pending_subscription",
    role: "admin",
    isCommerceOwner: owner,
  }
}

async function setupInactiveAccount(page: Page, options: { owner: boolean; trialEligible: boolean }) {
  const billingStatus = {
    commerceId: "commerce-uuid",
    merchantName: "Comercio sin suscripción",
    status: "pending_subscription",
    viewState: options.trialEligible ? "never_subscribed" : "expired",
    canManageSubscription: options.owner,
    trialConsumed: !options.trialEligible,
    trialEligible: options.trialEligible,
  }

  await page.addInitScript(
    (state) => localStorage.setItem("authState", JSON.stringify(state)),
    authState(options.owner),
  )
  await page.route("**/commerce-uuid/billing/status*", (route) => route.fulfill({ json: billingStatus }))
  await page.route("**/public/billing/config", (route) => route.fulfill({ json: billingConfig }))
  await page.route("**/commerce-uuid/metadata", (route) => route.fulfill({ json: { categories: [] } }))
  await page.route("**/commerce-uuid/products*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { items: [] } })
      return
    }
    await route.fulfill({
      status: 402,
      json: {
        error: {
          code: "SUBSCRIPTION_REQUIRED",
          message: "La suscripción no habilita esta operación",
        },
      },
    })
  })
}

async function submitNewProduct(page: Page) {
  await page.getByRole("button", { name: "Nuevo Producto" }).click()
  await page.locator("#code").fill("BLOCKED-001")
  await page.locator("#name").fill("Producto bloqueado")
  await page.locator("#priceBuy").fill("100")
  await page.locator("#priceBuy").press("Tab")
  await page.locator("#priceSale").fill("200")
  await page.locator("#priceSale").press("Tab")
  await page.locator("#stock").fill("10")
  await page.locator("#stock").press("Tab")
  await page.locator("#uom").click()
  await page.getByText("Unidad (u)", { exact: true }).click()
  await page.getByRole("button", { name: "Guardar" }).click()
}

test.describe("inactive subscription access", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("keeps reads and navigation available and opens the eligible trial modal globally", async ({ page }) => {
    await setupInactiveAccount(page, { owner: true, trialEligible: true })
    await page.goto("/dashboard/productos")

    await expect(page).toHaveURL(/\/dashboard\/productos$/)
    await expect(page.getByText("Lista de Productos")).toBeVisible()
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Ventas" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Reportes" })).toBeVisible()

    await submitNewProduct(page)

    const dialog = page.getByRole("dialog")
    await expect(dialog).toHaveCount(1)
    await expect(dialog.getByRole("heading", { name: "Activá tu período de prueba" })).toBeVisible()
    await expect(dialog.getByText(/30 días gratis; después, .*42\.000.* por mes/)).toBeVisible()
    await expect(page).toHaveURL(/\/dashboard\/productos$/)

    await dialog.getByRole("button", { name: "Ahora no" }).click()
    await page.getByRole("button", { name: "Guardar" }).click()
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Activá tu período de prueba" })).toBeVisible()
    await page.getByRole("dialog").getByRole("button", { name: "Activar promoción" }).click()
    await expect(page).toHaveURL(/\/suscripcion$/)
  })

  test("offers reactivation without promising another trial", async ({ page }) => {
    await setupInactiveAccount(page, { owner: true, trialEligible: false })
    await page.goto("/dashboard/productos")
    await submitNewProduct(page)

    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading", { name: "Reactivá tu suscripción" })).toBeVisible()
    await expect(dialog.getByText(/necesitás reactivar la suscripción/)).toBeVisible()
    await expect(dialog.getByText(/42\.000.* por mes/)).toBeVisible()
    await expect(dialog.getByText(/días gratis/)).toHaveCount(0)
    await expect(dialog.getByRole("button", { name: "Reactivar suscripción" })).toBeVisible()
  })

  test("asks a non-owner to contact the owner without exposing billing management", async ({ page }) => {
    await setupInactiveAccount(page, { owner: false, trialEligible: false })
    await page.goto("/dashboard/productos")
    await expect(page.getByRole("link", { name: "Suscripción" })).toHaveCount(0)
    await submitNewProduct(page)

    const dialog = page.getByRole("dialog")
    await expect(dialog.getByText(/el propietario del comercio debe reactivar la suscripción/)).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Entendido" })).toBeVisible()
    await expect(dialog.getByRole("button", { name: /Activar|Reactivar|Ir a Suscripción/ })).toHaveCount(0)
  })
})
