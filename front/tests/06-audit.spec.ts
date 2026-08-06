import { test, expect } from "@playwright/test"
import { ADMIN_STATE_PATH, VENDOR_STATE_PATH } from "./helpers/paths"
import {
  createClosure,
  createOffer,
  createProduct,
  createSale,
  finishOffer,
  updateProduct,
} from "./helpers/api"
import { closurePayload, makeRunId, offerPayload, productPayload, saleItemFromProduct, salePayload } from "./helpers/data"

test.describe("audit", () => {
  test.use({ storageState: ADMIN_STATE_PATH })

  test("opens the audit log detail modal after real mutations", async ({ page }) => {
    const product = await createProduct(
      productPayload({
        code: `AUD-${makeRunId("P").toUpperCase()}`,
        name: "Audit Product 01",
        category: "Bebidas",
        brand: "Marca Auditoria",
        stock: 50,
        minStock: 5,
      })
    )

    await updateProduct(product.code, {
      name: "Audit Product 01 Updated",
      stock: 42,
    })

    await createSale(
      salePayload([
        saleItemFromProduct(product, 1),
      ], {
        notes: "Venta para auditoría",
        paymentMethod: "CASH",
      })
    )

    const offer = await createOffer(
      offerPayload("PRODUCT", [product.code], "active", {
        name: "Audit Offer 01",
        discountType: "PERCENTAGE",
        discountValue: 12,
      })
    )
    await finishOffer(offer.offerId)

    await createClosure(
      closurePayload({
        notes: "Cierre para auditoría",
        declaredCash: 12000,
        expenses: 100,
        initialFund: 5000,
      })
    )

    await page.goto("/dashboard/auditoria")
    await expect(page.getByText("Registros de Auditoría")).toBeVisible()

    const detailButton = page.locator("tbody button").first()
    await expect(detailButton).toBeVisible()
    await detailButton.click()

    await expect(page.getByText("Detalle de Auditoría")).toBeVisible()
    await expect(page.getByText("Información")).toBeVisible()
    await expect(page.getByText("Realizado por:")).toBeVisible()
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

