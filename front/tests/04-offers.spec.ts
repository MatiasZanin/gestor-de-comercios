import { test, expect } from "@playwright/test"
import { ADMIN_STATE_PATH, VENDOR_STATE_PATH } from "./helpers/paths"
import { createOffer, createProduct } from "./helpers/api"
import { makeRunId, offerPayload, productPayload } from "./helpers/data"

test.describe("offers", () => {
  test.use({ storageState: ADMIN_STATE_PATH })

  test("shows offers, filters by status and opens the detail modal", async ({ page }) => {
    const product = await createProduct(
      productPayload({
        code: `OFF-${makeRunId("P").toUpperCase()}`,
        name: "Offer Product 01",
        category: "Bebidas",
        brand: "Marca Oferta",
        stock: 30,
        minStock: 5,
      })
    )

    await createOffer(
      offerPayload("PRODUCT", [product.code], "active", {
        name: "Offer Active 01",
        discountType: "PERCENTAGE",
        discountValue: 20,
      })
    )
    await createOffer(
      offerPayload("PRODUCT", [product.code], "scheduled", {
        name: "Offer Scheduled 01",
        discountType: "FIXED",
        discountValue: 300,
      })
    )
    await createOffer(
      offerPayload("PRODUCT", [product.code], "expired", {
        name: "Offer Expired 01",
        discountType: "PERCENTAGE",
        discountValue: 10,
      })
    )

    await page.goto("/dashboard/ofertas")
    await expect(page.getByText("Lista de Ofertas")).toBeVisible()
    const activeRow = page.locator("tbody tr").filter({ hasText: "Offer Active 01" }).first()
    const scheduledRow = page.locator("tbody tr").filter({ hasText: "Offer Scheduled 01" }).first()
    const expiredRow = page.locator("tbody tr").filter({ hasText: "Offer Expired 01" }).first()
    await expect(activeRow).toBeVisible()
    await expect(scheduledRow).toBeVisible()
    await expect(expiredRow).toBeVisible()

    await page.getByRole("combobox").click()
    await page.getByRole("option", { name: "Activas" }).click()
    await expect(page.locator("tbody tr").filter({ hasText: "Offer Active 01" }).first()).toBeVisible()
    await expect(page.locator("tbody tr").filter({ hasText: "Offer Scheduled 01" })).toHaveCount(0)
    await expect(page.locator("tbody tr").filter({ hasText: "Offer Expired 01" })).toHaveCount(0)

    await page.getByRole("combobox").click()
    await page.getByRole("option", { name: "Todas" }).click()

    const firstRow = page.locator("tbody tr").filter({ hasText: "Offer Active 01" }).first()
    await expect(firstRow).toBeVisible()
    await firstRow.click()

    await expect(page.getByText("Descuento")).toBeVisible()
    await expect(page.getByRole("button", { name: "Editar Oferta" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Finalizar Oferta" })).toBeVisible()

    await page.getByRole("button", { name: "Finalizar Oferta" }).click()
    await page.getByRole("button", { name: "Confirmar" }).click()
    await expect(page.getByText("Descuento")).toHaveCount(0)
    await expect(page.locator("tbody tr").filter({ hasText: "Offer Active 01" }).first()).toBeVisible()
    await expect(page.getByText("Expirada")).toBeVisible()
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
