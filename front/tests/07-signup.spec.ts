import { expect, test } from "@playwright/test"

const billingConfig = {
  monthlyAmount: 42000,
  currencyId: "ARS",
  trialDays: 30,
  graceDays: 3,
  planReason: "G&S Comercios",
}

test.describe("public signup", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("anonymous users can open signup and reach OTP", async ({ page }) => {
    await page.route("**/public/billing/config", (route) => route.fulfill({ json: billingConfig }))
    await page.route("**/public/registrations", (route) => route.fulfill({
      status: 201,
      json: { registrationId: "reg-1", status: "email_verification_pending", maskedEmail: "d***@example.com" },
    }))
    await page.goto("/registrarme")
    await expect(page.getByText("Crear cuenta", { exact: true }).first()).toBeVisible()
    await page.locator("#firstName").fill("Demo")
    await page.locator("#lastName").fill("Usuario")
    await page.locator("#email").fill("demo@example.com")
    await page.locator("#merchantName").fill("Mi comercio")
    await page.locator("#password").fill("Password1!")
    await page.locator("#confirmPassword").fill("Password1!")
    await page.locator("#acceptTerms").click()
    await page.getByRole("button", { name: "Crear cuenta" }).click()
    await expect(page.getByText("Verificá tu email", { exact: true })).toBeVisible()
    await expect(page.getByText("d***@example.com")).toBeVisible()
  })

  test("authenticated active users are redirected to dashboard", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("authState", JSON.stringify({
      isAuthenticated: true,
      user: { username: "demo", email_verified: true, sub: "sub", email: "demo@example.com", "cognito:groups": ["admin"], commerceId: "commerce", commerceList: ["commerce"], accountStatus: "active", role: "admin" },
      token: "token", commerceId: "commerce", accountStatus: "active", role: "admin",
    })))
    await page.route("**/public/billing/config", (route) => route.fulfill({ json: billingConfig }))
    await page.goto("/registrarme")
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
