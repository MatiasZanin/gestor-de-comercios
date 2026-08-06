import { test, expect } from "@playwright/test"
import { ADMIN_STATE_PATH, VENDOR_STATE_PATH } from "./helpers/paths"
import { createProduct, createSale } from "./helpers/api"
import { makeRunId, productPayload, saleItemFromProduct, salePayload } from "./helpers/data"

async function createSaleProduct() {
  return createProduct(
    productPayload({
      code: `SALE-${makeRunId("P").toUpperCase()}`,
      name: "Sale Product 01",
      category: "Bebidas",
      brand: "Marca Venta",
      stock: 100,
      minStock: 5,
    })
  )
}

function saleItemRow(page: import("@playwright/test").Page, code: string) {
  return page.locator("div.border-b").filter({ hasText: code }).first()
}

test.describe("sales", () => {
  test.use({ storageState: ADMIN_STATE_PATH })

  test("creates a new sale from the checkout flow and searches it by ticket", async ({ page }) => {
    const product = await createSaleProduct()

    await page.goto("/dashboard/ventas")
    await expect(page.getByText("Lista de Ventas")).toBeVisible()

    await page.getByRole("button", { name: "Nueva Venta" }).click()
    await expect(page.locator("div.fixed").getByText("Nueva Venta")).toBeVisible()

    await page.getByPlaceholder("Buscar productos...").fill(product.code)
    await saleItemRow(page, product.code).getByRole("button").click()

    await page.getByRole("button", { name: "Cobrar" }).click()
    await expect(page.getByText("Finalizar Venta")).toBeVisible()
    await page.locator("#notes").fill("Venta UI E2E")
    await page.getByRole("button", { name: "Confirmar Venta" }).click()

    await expect(page.getByText("¡Venta creada!")).toBeVisible({ timeout: 15000 })
    await page.getByRole("button", { name: "¡Listo!" }).click()

    await page.once("dialog", (dialog) => dialog.accept())
    await page.getByRole("button", { name: "Cancelar" }).click()
    await expect(page.locator("div.fixed").getByText("Nueva Venta")).toHaveCount(0)

    const createdSaleHeading = page.locator("h3").filter({ hasText: "Venta #" }).first()
    await expect(createdSaleHeading).toBeVisible()
    const createdSaleText = (await createdSaleHeading.textContent()) ?? ""
    const ticketSuffix = createdSaleText.split("#").pop()?.trim()
    expect(ticketSuffix).toBeTruthy()

    await page.getByPlaceholder("Buscar por N° de venta...").fill(ticketSuffix!)
    await page.getByRole("button", { name: "Buscar" }).click()
    await expect(page.getByText(`Venta #${ticketSuffix}`)).toBeVisible()
  })

  test("creates a return from a preexisting sale ticket", async ({ page }) => {
    const product = await createSaleProduct()
    const sale = await createSale(
      salePayload([
        saleItemFromProduct(product, 1),
      ], {
        notes: "Venta base para devolución",
        paymentMethod: "CASH",
      })
    )

    await page.goto("/dashboard/ventas")
    await expect(page.getByText("Lista de Ventas")).toBeVisible()

    await page.getByRole("button", { name: "Devolución" }).click()
    await expect(page.getByText("Devolución por Ticket")).toBeVisible()

    await page.getByPlaceholder("Ingresá el número de ticket...").fill(sale.saleId)
    await page.keyboard.press("Enter")
    await expect(
      page.locator("div.fixed").getByRole("heading", { name: `Venta #${sale.saleId.slice(-8)}` })
    ).toBeVisible()

    await page.getByRole("button", { name: "Generar Devolución" }).click()
    await expect(page.getByText("Devolución por Ticket")).toHaveCount(0)
    await expect(page.getByText("Emitir Reembolso")).toBeVisible()

    await page.getByRole("button", { name: "Emitir Reembolso" }).click()
    await expect(page.getByText("Confirmar Reembolso")).toBeVisible()
    await page.getByRole("button", { name: "Confirmar Reembolso" }).click()

    await expect(page.getByText("¡Venta creada!")).toBeVisible({ timeout: 15000 })
    await page.getByRole("button", { name: "¡Listo!" }).click()
  })
})

test.describe("sales role access", () => {
  test.use({ storageState: VENDOR_STATE_PATH })

  test("hides export action for vendors", async ({ page }) => {
    await page.goto("/dashboard/ventas")
    await expect(page.getByText("Lista de Ventas")).toBeVisible()
    await expect(page.getByRole("button", { name: "Exportar" })).toHaveCount(0)
  })
})
