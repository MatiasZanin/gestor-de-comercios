import { getSaleItemProfit, getSaleItemTotal, resolveDiscounts } from "../src/services/domain"
import { parseScaleBarcodeConfig } from "../src/services/scaleBarcodeConfig"

describe("scale barcode config", () => {
  it("accepts valid weight and price configurations", () => {
    expect(parseScaleBarcodeConfig({ valueType: "weight", unit: "kg", decimals: 3 })).toEqual({
      valueType: "weight",
      unit: "kg",
      decimals: 3,
    })
    expect(parseScaleBarcodeConfig({ valueType: "price", decimals: 2 })).toEqual({
      valueType: "price",
      decimals: 2,
    })
  })

  it.each([-1, 1.5, 6])("rejects invalid decimals: %s", (decimals) => {
    expect(() => parseScaleBarcodeConfig({ valueType: "price", decimals })).toThrow(
      "decimals must be an integer between 0 and 5"
    )
  })

  it("rejects units on price configurations and incompatible weight units", () => {
    expect(() => parseScaleBarcodeConfig({ valueType: "price", decimals: 2, unit: "kg" })).toThrow(
      "Unknown scale barcode config field"
    )
    expect(() => parseScaleBarcodeConfig({ valueType: "weight", unit: "lb", decimals: 2 })).toThrow(
      "unit must be kg or g"
    )
  })
})

describe("scale price sale totals", () => {
  const scaleItem = {
    code: "00123",
    name: "Producto pesado",
    qty: 0.75,
    priceBuy: 1000,
    priceSale: 2000,
    uom: "kg",
    scalePriceTotal: 1500,
  }

  it("uses the encoded total and derives its sign from quantity", () => {
    expect(getSaleItemTotal(scaleItem)).toBe(1500)
    expect(getSaleItemProfit(scaleItem)).toBe(750)
    expect(getSaleItemTotal({ ...scaleItem, qty: -0.75 })).toBe(-1500)
    expect(getSaleItemProfit({ ...scaleItem, qty: -0.75 })).toBe(-750)
  })

  it("does not apply offers to encoded-price items", () => {
    const discounts = resolveDiscounts([
      {
        PK: "COM#1",
        SK: "OFFER#1",
        commerceId: "1",
        offerId: "1",
        name: "Mitad de precio",
        discountType: "PERCENTAGE",
        discountValue: 50,
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-12-31T23:59:59.999Z",
        scope: { type: "PRODUCT", values: ["00123"] },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        createdBy: "admin",
      },
    ], [scaleItem], "2026-08-19T12:00:00.000Z")

    expect(discounts.size).toBe(0)
  })
})
