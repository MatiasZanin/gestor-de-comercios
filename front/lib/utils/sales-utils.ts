import type { SaleItem, ScaleBarcodeConfig } from "@/lib/types/api"

export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
    }).format(amount)
}

export type ParsedScaleBarcode =
    | { plu: string; valueType: "weight"; value: number; unit: "kg" | "g" }
    | { plu: string; valueType: "price"; totalPrice: number }

// Mantiene el formato fijo actual: prefijo de 2 posiciones, PLU de 5, valor de 5 y check final.
export const parseVariableWeightEAN13 = (
    raw: string,
    config: ScaleBarcodeConfig
): ParsedScaleBarcode | null => {
    const digits = (raw || "").replace(/\D/g, "")
    if (digits.length !== 13) return null
    if (digits[0] !== "2") return null

    // Formato: prefijo de 2 dígitos + 5 (PLU) + 5 (peso/precio) + 1 (check)
    const plu = digits.slice(2, 7)
    const valuePart = digits.slice(7, 12)
    const rawValue = Number.parseInt(valuePart, 10)

    if (Number.isNaN(rawValue)) return null

    const value = rawValue / 10 ** config.decimals
    if (config.valueType === "price") {
        return { plu, valueType: "price", totalPrice: value }
    }
    return { plu, valueType: "weight", value, unit: config.unit }
}

export function convertScaleWeight(value: number, from: "kg" | "g", productUom: string): number {
    if (productUom !== "kg" && productUom !== "g") {
        throw new Error(`La unidad ${productUom} no es compatible con un código de peso`)
    }
    if (from === productUom) return value
    return from === "kg" ? value * 1000 : value / 1000
}

export function getSaleItemTotal(
    item: Pick<SaleItem, "qty" | "priceSale" | "scalePriceTotal">
): number {
    if (item.scalePriceTotal !== undefined) {
        return Math.sign(item.qty) * item.scalePriceTotal
    }
    return item.qty * item.priceSale
}

export function formatQuantity(value: number): string {
    return Number.parseFloat(value.toFixed(10)).toString()
}
