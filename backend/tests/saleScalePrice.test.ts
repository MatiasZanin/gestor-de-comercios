const mockUpdateStock = jest.fn()
const mockUpdateDailyStats = jest.fn()
const mockLogAudit = jest.fn()

jest.mock("../src/helpers/updateStock", () => ({
  updateStock: (...args: unknown[]) => mockUpdateStock(...args),
}))
jest.mock("../src/helpers/updateDailyStats", () => ({
  updateDailyStats: (...args: unknown[]) => mockUpdateDailyStats(...args),
}))
jest.mock("../src/helpers/auditLogger", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}))

import { createSaleUseCase } from "../src/services/saleUseCase"

describe("createSaleUseCase with an encoded price", () => {
  beforeEach(() => {
    mockUpdateStock.mockReset().mockResolvedValue(10)
    mockUpdateDailyStats.mockReset().mockResolvedValue(undefined)
    mockLogAudit.mockReset().mockResolvedValue(undefined)
  })

  it.each([
    { qty: 0.75, expectedTotal: 1500, expectedProfit: 750 },
    { qty: -0.75, expectedTotal: -1500, expectedProfit: -750 },
  ])("keeps the encoded total for qty $qty", async ({ qty, expectedTotal, expectedProfit }) => {
    const docClient = {
      send: jest.fn(async (command: any) => {
        if (command.constructor.name === "QueryCommand") {
          return {
            Items: [{
              offerId: "offer-1",
              name: "Oferta",
              discountType: "PERCENTAGE",
              discountValue: 50,
              startDate: "2026-01-01T00:00:00.000Z",
              endDate: "2026-12-31T23:59:59.999Z",
              scope: { type: "PRODUCT", values: ["00123"] },
            }],
          }
        }
        return {}
      }),
    } as any

    const sale = await createSaleUseCase(docClient, "table", {
      commerceId: "commerce-1",
      sellerId: "seller-1",
      createdAt: "2026-08-19T12:00:00.000Z",
      saleId: `sale-${qty}`,
      items: [{
        code: "00123",
        name: "Producto pesado",
        qty,
        priceBuy: 1000,
        priceSale: 2000,
        uom: "kg",
        scalePriceTotal: 1500,
      }],
    })

    expect(sale.total).toBe(expectedTotal)
    expect(sale.profit).toBe(expectedProfit)
    expect(sale.items[0]).toMatchObject({ priceSale: 2000, scalePriceTotal: 1500 })
    expect(sale.items[0].discountApplied).toBeUndefined()
    expect(mockUpdateDailyStats).toHaveBeenCalledWith(
      "commerce-1", "00123", qty, 1000, 2000, "kg",
      "2026-08-19T12:00:00.000Z", expectedTotal, expectedProfit
    )
  })

  it("rejects non-positive encoded totals", async () => {
    await expect(createSaleUseCase({ send: jest.fn() } as any, "table", {
      commerceId: "commerce-1",
      sellerId: "seller-1",
      items: [{ code: "00123", name: "Producto", qty: 1, priceBuy: 1, priceSale: 2, uom: "kg", scalePriceTotal: 0 }],
    })).rejects.toThrow("scalePriceTotal must be a positive finite number")
  })
})
