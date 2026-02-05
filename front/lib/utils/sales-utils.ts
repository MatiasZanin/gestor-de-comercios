export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
    }).format(amount)
}

// Detecta EAN-13 de balanza (peso variable) y devuelve { plu, qty }
export const parseVariableWeightEAN13 = (raw: string) => {
    const digits = (raw || "").replace(/\D/g, "")
    if (digits.length !== 13) return null
    if (digits[0] !== "2") return null

    // Formato: 2 + 5 (PLU) + 5 (peso/precio) + 1 (check)
    const plu = digits.slice(1, 6)
    const weightPart = digits.slice(6, 11)
    const wNum = Number.parseInt(weightPart, 10)

    if (Number.isNaN(wNum)) return null

    // Interpretamos como KG con 3 decimales
    const qty = wNum / 1000
    return { plu, qty }
}