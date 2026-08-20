import { expect, test } from "@playwright/test"
import { ADMIN_STATE_PATH } from "./helpers/paths"

test.describe("authentication", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("redirects anonymous users to login", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText("Ingresar al sistema", { exact: true })).toBeVisible()
  })

  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/login")
    await page.locator("#username").fill("NoExiste")
    await page.locator("#password").fill("wrong-password")
    await page.getByRole("button", { name: "Iniciar Sesión" }).click()

    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole("alert")).toBeVisible()
  })
})

test.describe("logout", () => {
  test.use({ storageState: ADMIN_STATE_PATH })

  test("returns to login after logout", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()

    await page.locator('button:has-text("Cerrar Sesión")').evaluate((button) => {
      (button as HTMLButtonElement).click()
    })
    await page.waitForURL(/\/login/)
    await expect(page.getByText("Ingresar al sistema", { exact: true })).toBeVisible()
  })
})
