import { expect, test } from "@playwright/test"
import { convertScaleWeight, getSaleItemTotal, parseVariableWeightEAN13 } from "@/lib/utils/sales-utils"

test.describe("scale barcode utilities", () => {
  test("parses fixed-position weight barcodes using configured decimals", () => {
    expect(parseVariableWeightEAN13("2000123007500", {
      valueType: "weight", unit: "kg", decimals: 3,
    })).toEqual({ plu: "00123", valueType: "weight", value: 0.75, unit: "kg" })

    expect(parseVariableWeightEAN13("2000123007500", {
      valueType: "weight", unit: "g", decimals: 0,
    })).toEqual({ plu: "00123", valueType: "weight", value: 750, unit: "g" })
  })

  test("parses price barcodes and rejects invalid formats", () => {
    expect(parseVariableWeightEAN13("2000123007500", {
      valueType: "price", decimals: 2,
    })).toEqual({ plu: "00123", valueType: "price", totalPrice: 7.5 })
    expect(parseVariableWeightEAN13("1000123007500", { valueType: "price", decimals: 2 })).toBeNull()
    expect(parseVariableWeightEAN13("200123", { valueType: "price", decimals: 2 })).toBeNull()
  })

  test("converts only compatible weight units", () => {
    expect(convertScaleWeight(0.75, "kg", "g")).toBe(750)
    expect(convertScaleWeight(750, "g", "kg")).toBe(0.75)
    expect(() => convertScaleWeight(1, "kg", "u")).toThrow("no es compatible")
  })

  test("uses the encoded line total and quantity sign", () => {
    expect(getSaleItemTotal({ qty: 0.75, priceSale: 2000, scalePriceTotal: 1500 })).toBe(1500)
    expect(getSaleItemTotal({ qty: -0.75, priceSale: 2000, scalePriceTotal: 1500 })).toBe(-1500)
  })
})
