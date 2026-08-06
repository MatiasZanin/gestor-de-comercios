import { test, expect } from "@playwright/test"
import { ADMIN_STATE_PATH, VENDOR_STATE_PATH } from "./helpers/paths"
import { createProduct } from "./helpers/api"
import { productPayload, makeRunId } from "./helpers/data"

async function createCatalogProducts() {
  const runId = makeRunId("CAT").toUpperCase()
  const products = []

  for (let index = 0; index < 12; index += 1) {
    const code = `CAT-${String(index + 1).padStart(2, "0")}-${runId}-${makeRunId("P").toUpperCase()}`
    const product = await createProduct(
      productPayload(
        {
          code,
          name: `Catalog A ${String(index + 1).padStart(2, "0")} ${runId}`,
          category: index < 6 ? "Bebidas" : "Snacks",
          brand: index < 6 ? "Marca A" : "Marca B",
          stock: index === 0 ? 3 : 20 + index,
          minStock: 5,
        },
        index
      )
    )
    products.push(product)
  }

  const inactive = await createProduct(
    productPayload({
      code: `CAT-IN-${runId}-${makeRunId("P").toUpperCase()}`,
      name: `Catalog Inactive 01 ${runId}`,
      category: "Otros",
      brand: "Marca Inactiva",
      stock: 8,
      minStock: 5,
      isActive: false,
    })
  )
  products.push(inactive)

  return products
}

test.describe("products", () => {
  test.use({ storageState: ADMIN_STATE_PATH })

  test("supports search, inactive items and pagination", async ({ page }) => {
    await createCatalogProducts()

    await page.goto("/dashboard/productos")
    await expect(page.getByText("Lista de Productos")).toBeVisible()
    await expect(page.getByPlaceholder("Buscar por nombre...")).toBeVisible()

    await page.getByPlaceholder("Buscar por nombre...").fill("Catalog A 03")
    await expect(page.getByText(/Catalog A 03/)).toBeVisible()

    await page.getByRole("button", { name: "Limpiar filtros" }).click()
    await page.getByRole("button", { name: "2", exact: true }).click()
    await expect(page.getByText(/Catalog A 11/)).toBeVisible()

    await page.locator('[data-slot="switch"]').click()
    await expect(page.getByText(/Catalog Inactive 01/)).toBeVisible()
    await expect(page.getByText(/Catalog A 01/)).toHaveCount(0)
  })

  test("can edit and delete a product from the UI", async ({ page }) => {
    const runId = makeRunId("EDIT").toUpperCase()
    const product = await createProduct(
      productPayload({
        code: `EDIT-${runId}-${makeRunId("P").toUpperCase()}`,
        name: `Editable Product 01 ${runId}`,
        category: "Bebidas",
        brand: "Marca Edición",
        stock: 12,
        minStock: 4,
      })
    )

    await page.goto("/dashboard/productos")
    await page.getByPlaceholder("Buscar por nombre...").fill(product.name)

    const productCard = page.locator('div.rounded-xl').filter({ hasText: product.name }).first()
    await expect(productCard).toBeVisible()

    await page.getByRole("button", { name: `Editar ${product.name}` }).click()
    await expect(page.getByText("Editar Producto")).toBeVisible()

    const updatedName = `Editable Product 01 Updated ${runId}`
    await page.locator("#name").fill(updatedName)
    await page.locator("#stock").fill("18")
    await page.getByRole("button", { name: "Guardar" }).click()

    await page.getByPlaceholder("Buscar por nombre...").fill(updatedName)
    const updatedCard = page.locator('div.rounded-xl').filter({ hasText: updatedName }).first()
    await expect(updatedCard).toBeVisible()

    await page.getByRole("button", { name: `Eliminar ${updatedName}` }).click()
    await expect(page.getByText("Confirmar Eliminación")).toBeVisible()
    await page.getByRole("button", { name: "Eliminar", exact: true }).click()

    await expect(page.locator('div.rounded-xl').filter({ hasText: updatedName })).toHaveCount(0)
  })
})

test.describe("products role access", () => {
  test.use({ storageState: VENDOR_STATE_PATH })

  test("shows read-only view for vendors", async ({ page }) => {
    await page.goto("/dashboard/productos")
    await expect(page.getByText("Lista de Productos")).toBeVisible()
    await expect(page.getByRole("button", { name: "Nuevo Producto" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Exportar" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: /Editar|Eliminar/ })).toHaveCount(0)
  })
})
