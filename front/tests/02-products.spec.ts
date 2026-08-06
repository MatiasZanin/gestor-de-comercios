import { test, expect } from "@playwright/test"
import { ADMIN_STATE_PATH, VENDOR_STATE_PATH } from "./helpers/paths"
import { selectCreatableOption, selectReactSelectOption } from "./helpers/ui"

function uniqueProduct() {
  const suffix = Date.now().toString().slice(-6)
  return {
    code: `E2E-${suffix}`,
    name: `Producto E2E ${suffix}`,
  }
}

test.describe("products", () => {
  test.use({ storageState: ADMIN_STATE_PATH })

  test("supports search, inactive items and pagination", async ({ page }) => {
    await page.goto("/dashboard/productos")
    await expect(page.getByText("Lista de Productos")).toBeVisible()

    const initialCards = await page.locator("div.rounded-xl").count()
    await expect(page.getByPlaceholder("Buscar por nombre...")).toBeVisible()

    await page.getByPlaceholder("Buscar por nombre...").fill("Coca-Cola")
    await expect(page.getByText("Coca-Cola 500ml")).toBeVisible()
    await page.getByRole("button", { name: "Limpiar filtros" }).click()

    const loadMore = page.getByRole("button", { name: "Cargar más productos" })
    if (await loadMore.count()) {
      await loadMore.click()
      const afterCards = await page.locator("div.rounded-xl").count()
      expect(afterCards).toBeGreaterThan(initialCards)
    }

    await page.locator('[data-slot="switch"]').click()
    await expect(page.getByText("KIO-CHOC-BAR-80")).toBeVisible()
  })

  test("can create and remove a product from the UI", async ({ page }) => {
    const product = uniqueProduct()

    await page.goto("/dashboard/productos")
    await page.getByRole("button", { name: "Nuevo Producto" }).click()
    await expect(page.getByText("Nuevo Producto")).toBeVisible()

    await page.locator("#code").fill(product.code)
    await page.locator("#name").fill(product.name)
    await selectCreatableOption(page, "category", "Bebidas")
    await selectCreatableOption(page, "brand", "Coca-Cola")
    await page.locator("#priceBuy").fill("1000")
    await page.locator("#priceSale").fill("1500")
    await page.locator("#stock").fill("25")
    await selectReactSelectOption(page, "uom", "Unidad (u)")
    await page.locator("#minStock").fill("5")
    await page.locator("#notes").fill("Producto temporal para E2E")
    await page.getByRole("button", { name: "Guardar" }).click()

    await expect(page.getByText(product.name)).toBeVisible()

    await page.getByPlaceholder("Buscar por nombre...").fill(product.name)
    const productCard = page.locator('div.rounded-xl').filter({ hasText: product.name }).first()
    await expect(productCard).toBeVisible()

    const deleteButton = productCard.getByRole("button").nth(1)
    await deleteButton.click()
    await expect(page.getByText("Confirmar Eliminación")).toBeVisible()
    await page.getByRole("button", { name: "Eliminar" }).click()

    await expect(page.getByText(product.name)).toHaveCount(0)
  })
})

test.describe("products role access", () => {
  test.use({ storageState: VENDOR_STATE_PATH })

  test("shows read-only view for vendors", async ({ page }) => {
    await page.goto("/dashboard/productos")
    await expect(page.getByText("Lista de Productos")).toBeVisible()
    await expect(page.getByRole("button", { name: "Nuevo Producto" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Exportar" })).toHaveCount(0)
  })
})
