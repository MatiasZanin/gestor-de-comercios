import { expect, test } from "@playwright/test"

test("pending users can only manage their subscription", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("authState", JSON.stringify({
    isAuthenticated: true,
    user: { username: "pending@example.com", email_verified: true, sub: "sub", email: "pending@example.com", "cognito:groups": ["admin"], commerceId: "commerce-uuid", commerceList: ["commerce-uuid"], accountStatus: "pending_subscription", role: "admin" },
    token: "token", commerceId: "commerce-uuid", accountStatus: "pending_subscription", role: "admin",
  })))
  await page.route("**/commerce-uuid/billing/status", (route) => route.fulfill({ json: {
    commerceId: "commerce-uuid", merchantName: "Mi comercio", status: "pending_subscription", trialConsumed: false,
  } }))
  await page.route("**/public/billing/config", (route) => route.fulfill({ json: {
    monthlyAmount: 42000, currencyId: "ARS", trialDays: 30, graceDays: 3, planReason: "G&S Comercios",
  } }))
  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/suscripcion/)
  await expect(page.getByRole("heading", { name: "Mi comercio" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Iniciar prueba gratuita" })).toBeVisible()
})
