import { test, expect } from "@playwright/test"
import { ADMIN_STATE_PATH, VENDOR_STATE_PATH } from "./helpers/paths"

function saleItemRow(page: import("@playwright/test").Page, code: string) {
  return page.locator("div.border-b").filter({ hasText: code }).first()
}

test.describe("sales", () => {
  test.use({ storageState: ADMIN_STATE_PATH })

  test("supports search and creates a new sale from the checkout flow", async ({ page }) => {
    await page.goto("/dashboard/ventas")
    await expect(page.getByText("Lista de Ventas")).toBeVisible()

    await page.getByRole("button", { name: "Nueva Venta" }).click()
    await expect(page.locator("div.fixed").getByText("Nueva Venta")).toBeVisible()

    await page.getByPlaceholder("Buscar productos...").fill("BEB-AGUA-600")
    await saleItemRow(page, "BEB-AGUA-600").getByRole("button").click()

    await page.getByPlaceholder("Buscar productos...").fill("ALM-ARROZ-1")
    await saleItemRow(page, "ALM-ARROZ-1").getByRole("button").click()

    await page.getByRole("button", { name: "Cobrar" }).click()
    await expect(page.getByText("Finalizar Venta")).toBeVisible()

    const paymentMethodControl = page.locator("#paymentMethod").locator("..")
    await paymentMethodControl.scrollIntoViewIfNeeded()
    await paymentMethodControl.click({ force: true })
    await page.getByRole("option", { name: "Efectivo", exact: true }).click()
    await page.locator("#notes").fill("Venta E2E automatizada")
    await page.getByRole("button", { name: "Confirmar Venta" }).click()

    await expect(page.getByText("¡Venta creada!")).toBeVisible({ timeout: 15000 })
    await page.getByRole("button", { name: "¡Listo!" }).click()
    await expect(page.getByText("¡Venta creada!")).toHaveCount(0)

    page.on("dialog", (dialog) => dialog.accept())
    await page.getByRole("button", { name: "Cancelar" }).click()
    await expect(page.locator("div.fixed").getByText("Nueva Venta")).not.toBeVisible()

    const createdSaleHeading = page.locator("h3").filter({ hasText: "Venta #" }).first()
    await expect(createdSaleHeading).toBeVisible()
    const createdSaleText = (await createdSaleHeading.textContent()) ?? ""
    const ticketSuffix = createdSaleText.split("#").pop()?.trim()
    expect(ticketSuffix).toBeTruthy()

    await page.getByPlaceholder("Buscar por N° de venta...").fill(ticketSuffix!)
    await page.getByRole("button", { name: "Buscar" }).click()
    await expect(page.getByText(`Venta #${ticketSuffix}`)).toBeVisible()
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
