import { test, expect } from "@playwright/test"
import { ADMIN_STATE_PATH, VENDOR_STATE_PATH } from "./helpers/paths"
import { createProduct, createSale } from "./helpers/api"
import { productPayload, saleItemFromProduct, salePayload } from "./helpers/data"

test.describe("dashboard layout", () => {
  test.use({ storageState: ADMIN_STATE_PATH })

  test("shows navigation and admin metrics", async ({ page }) => {
    const revenueProduct = await createProduct(
      productPayload({
        code: "DASH-REV-001",
        name: "Dashboard Revenue 001",
        category: "Bebidas",
        brand: "Marca Dash",
        stock: 40,
        minStock: 5,
      })
    )
    await createProduct(
      productPayload({
        code: "DASH-LOW-001",
        name: "Dashboard Low Stock 001",
        category: "Snacks",
        brand: "Marca Dash",
        stock: 2,
        minStock: 5,
      })
    )
    await createSale(
      salePayload([
        saleItemFromProduct(revenueProduct, 2),
      ], {
        notes: "Venta dashboard E2E",
        paymentMethod: "CASH",
      })
    )

    await page.goto("/dashboard")

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible()
    await expect(page.getByText("admin", { exact: false })).toBeVisible()
    await expect(page.getByText("Comercio: gs")).toBeVisible()
    await expect(page.getByText("Total Productos")).toBeVisible()
    await expect(page.getByText("Ventas Hoy")).toBeVisible()
    await expect(page.getByText("Ingresos Hoy")).toBeVisible()
    await expect(page.getByText("Top Productos del Mes")).toBeVisible()
    await expect(page.getByText("Alerta de Stock Bajo")).toBeVisible()

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
    await expect(page.getByText("Top Productos del Mes")).toHaveCount(0)
  })
})
