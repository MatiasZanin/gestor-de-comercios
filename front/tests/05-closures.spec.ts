import { test, expect } from "@playwright/test"
import { ADMIN_STATE_PATH, VENDOR_STATE_PATH } from "./helpers/paths"
import { createProduct, createSale } from "./helpers/api"
import { makeRunId, productPayload, saleItemFromProduct, salePayload } from "./helpers/data"

test.describe("closures", () => {
  test.use({ storageState: ADMIN_STATE_PATH })

  test("registers a closure and opens the detail page from history", async ({ page }) => {
    const product = await createProduct(
      productPayload({
        code: `CLS-${makeRunId("P").toUpperCase()}`,
        name: "Closure Product 01",
        category: "Bebidas",
        brand: "Marca Cierre",
        stock: 60,
        minStock: 5,
      })
    )
    await createSale(
      salePayload([
        saleItemFromProduct(product, 2),
      ], {
        notes: "Venta previa para cierre",
        paymentMethod: "CASH",
      })
    )

    await page.goto("/dashboard/cierres")
    await expect(page.getByRole("heading", { name: "Cierre de Caja" })).toBeVisible()

    await page.locator("#declaredCash").fill("10000")
    await page.locator("#expenses").fill("250")
    await page.locator("#initialFund").fill("5000")
    await page.locator("#notes").fill("Cierre E2E automatizado")
    await page.getByRole("button", { name: "Cerrar Caja" }).click()

    await expect(page.getByText("¡Caja cerrada correctamente!")).toBeVisible({ timeout: 15000 })
    await expect(page.getByText("Cierre E2E automatizado")).toBeVisible()

    const detailButton = page.getByRole("button", { name: "Ver detalle" }).first()
    await detailButton.click()
    await expect(page).toHaveURL(/\/dashboard\/cierres\/.+/)
    await expect(page.getByText("Detalle del Cierre")).toBeVisible()
    await expect(page.getByText("Ventas del Período")).toBeVisible()
  })
})

test.describe("closures role access", () => {
  test.use({ storageState: VENDOR_STATE_PATH })

  test("keeps the admin-only history hidden for vendors", async ({ page }) => {
    await page.goto("/dashboard/cierres")
    await expect(page.getByRole("heading", { name: "Cierre de Caja" })).toBeVisible()
    await expect(page.getByText("Historial de Cierres")).toHaveCount(0)
  })
})
