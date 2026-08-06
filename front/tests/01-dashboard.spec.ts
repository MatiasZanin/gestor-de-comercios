import { test, expect } from "@playwright/test"
import { ADMIN_STATE_PATH, VENDOR_STATE_PATH } from "./helpers/paths"

test.describe("dashboard layout", () => {
  test.use({ storageState: ADMIN_STATE_PATH })

  test("shows navigation and admin metrics", async ({ page }) => {
    await page.goto("/dashboard")

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
    await expect(page.getByText("admin", { exact: false })).toBeVisible()
    await expect(page.getByText("Comercio: gs")).toBeVisible()
    await expect(page.getByText("Ingresos Hoy")).toBeVisible()

    await page.getByRole("link", { name: "Productos" }).click()
    await expect(page).toHaveURL(/\/dashboard\/productos/)
    await page.getByRole("link", { name: "Dashboard" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
  })
})

test.describe("dashboard role differences", () => {
  test.use({ storageState: VENDOR_STATE_PATH })

  test("hides admin-only revenue metric for vendor", async ({ page }) => {
    await page.goto("/dashboard")

    await expect(page.getByText("vendedor", { exact: false })).toBeVisible()
    await expect(page.getByText("Comercio: gs")).toBeVisible()
    await expect(page.getByText("Ingresos Hoy")).toHaveCount(0)
  })
})
