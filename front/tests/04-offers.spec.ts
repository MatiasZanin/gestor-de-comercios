import { test, expect } from "@playwright/test"
import { ADMIN_STATE_PATH, VENDOR_STATE_PATH } from "./helpers/paths"

test.describe("offers", () => {
  test.use({ storageState: ADMIN_STATE_PATH })

  test("shows the offer list and opens the detail modal", async ({ page }) => {
    await page.goto("/dashboard/ofertas")
    await expect(page.getByText("Lista de Ofertas")).toBeVisible()

    const firstRow = page.locator("tbody tr").first()
    await expect(firstRow).toBeVisible()
    await firstRow.click()

    await expect(page.getByText("Descuento")).toBeVisible()
    await expect(page.getByRole("button", { name: "Cerrar" })).toBeVisible()
    await page.getByRole("button", { name: "Cerrar" }).click()
    await expect(page.getByText("Descuento")).toHaveCount(0)
  })
})

test.describe("offers role access", () => {
  test.use({ storageState: VENDOR_STATE_PATH })

  test("hides admin actions for vendors", async ({ page }) => {
    await page.goto("/dashboard/ofertas")
    await expect(page.getByText("Lista de Ofertas")).toBeVisible()
    await expect(page.getByRole("button", { name: "Nueva Oferta" })).toHaveCount(0)

    const firstRow = page.locator("tbody tr").first()
    await firstRow.click()

    await expect(page.getByRole("button", { name: "Editar Oferta" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Finalizar Oferta" })).toHaveCount(0)
  })
})

