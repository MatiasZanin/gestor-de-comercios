import { test, expect } from "@playwright/test"
import { ADMIN_STATE_PATH, VENDOR_STATE_PATH } from "./helpers/paths"

test.describe("audit", () => {
  test.use({ storageState: ADMIN_STATE_PATH })

  test("opens the audit log detail modal", async ({ page }) => {
    await page.goto("/dashboard/auditoria")
    await expect(page.getByText("Registros de Auditoría")).toBeVisible()

    const detailButton = page.locator("tbody button").first()
    await detailButton.click()

    await expect(page.getByText("Detalle de Auditoría")).toBeVisible()
    await expect(page.getByRole("button", { name: "Cerrar" })).toBeVisible()
  })
})

test.describe("audit role access", () => {
  test.use({ storageState: VENDOR_STATE_PATH })

  test("shows restricted access for vendors", async ({ page }) => {
    await page.goto("/dashboard/auditoria")
    await expect(page.getByText("Acceso restringido")).toBeVisible()
    await expect(page.getByText("Solo los administradores pueden ver los registros de auditoría.")).toBeVisible()
  })
})
