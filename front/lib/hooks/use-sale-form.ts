import { useState, useEffect, useCallback } from "react"
import { apiClient } from "@/lib/api/client"
import type { Product, CreateSaleRequest, SaleItem, PaymentMethod } from "@/lib/types/api"
import { parseVariableWeightEAN13 } from "@/lib/utils/sales-utils"

interface UseSaleFormProps {
    onSuccess: () => void
}

export function useSaleForm({ onSuccess }: UseSaleFormProps) {
    // Datos y estado de carga
    const [products, setProducts] = useState<Product[]>([])
    const [loadingProducts, setLoadingProducts] = useState(true)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [stockWarning, setStockWarning] = useState<string | null>(null)
    const [showCheckoutModal, setShowCheckoutModal] = useState(false)

    // Estado del formulario
    const [selectedItems, setSelectedItems] = useState<SaleItem[]>([])
    const [notes, setNotes] = useState("")
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH")
    const [searchTerm, setSearchTerm] = useState("")
    const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({})

    // Modales
    const [showOtherModal, setShowOtherModal] = useState(false)
    const [showSuccess, setShowSuccess] = useState(false)

    const loadProducts = useCallback(async () => {
        setLoadingProducts(true)
        try {
            const response = await apiClient.listProducts({ isActive: true })
            setProducts(response.items)
        } catch (error) {
            console.error("Error loading products:", error)
        } finally {
            setLoadingProducts(false)
        }
    }, [])

    useEffect(() => {
        loadProducts()
    }, [loadProducts])

    useEffect(() => {
        if (!showSuccess) return
        const id = setTimeout(() => {
            setShowSuccess(false)
            onSuccess()
        }, 2000)
        return () => clearTimeout(id)
    }, [showSuccess, onSuccess])

    // --- Lógica de Items ---

    const updateItemQty = (code: string, qty: number) => {
        if (isNaN(qty)) return
        const safeQty = qty < 0 ? 0 : qty
        setSelectedItems((items) =>
            items.map((item) => (item.code === code ? { ...item, qty: safeQty } : item))
        )
    }

    const updateQtyInput = (code: string, val: string) => {
        setQtyInputs((prev) => ({ ...prev, [code]: val }))
    }

    const addItem = (product: Product, specificQty: number = 1) => {
        // Aviso de stock menor o igual a 0
        if (product.stock !== undefined && product.stock <= 0) {
            setStockWarning(`¡Atención! El producto "${product.name}" no tiene stock disponible.`)
            setTimeout(() => setStockWarning(null), 4000) // Desaparece en 4s
        }

        const existingItem = selectedItems.find((item) => item.code === product.code)

        if (existingItem) {
            const newQty = existingItem.qty + specificQty
            setSelectedItems((items) =>
                items.map((item) => (item.code === product.code ? { ...item, qty: newQty } : item))
            )
            updateQtyInput(product.code, newQty.toFixed(2))
        } else {
            const newItem: SaleItem = {
                code: product.code,
                name: product.name,
                qty: specificQty,
                priceBuy: product.priceBuy || 0,
                priceSale: product.priceSale,
                uom: product.uom,
                brand: product.brand,
                category: product.category,
            }
            setSelectedItems((items) => [...items, newItem])
            updateQtyInput(product.code, specificQty.toFixed(2))
        }
    }

    const addOtherItem = (price: number) => {
        const newItem: SaleItem = {
            code: "-1",
            name: "Otros",
            qty: 1,
            priceBuy: 0,
            priceSale: price,
            uom: "un",
        }
        setSelectedItems((items) => [...items, newItem])
        updateQtyInput("-1", "1.00")
    }

    const removeItem = (code: string) => {
        setSelectedItems((items) => items.filter((item) => item.code !== code))
        setQtyInputs((prev) => {
            const newInputs = { ...prev }
            delete newInputs[code]
            return newInputs
        })
    }

    // --- Lógica de Búsqueda y Escaneo ---

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Enter") return
        e.preventDefault()

        const parsedScale = parseVariableWeightEAN13(searchTerm)

        // 1. Lógica EAN de Balanza
        if (parsedScale) {
            const { plu, qty } = parsedScale
            const candidate = products.find(p => {
                const code = (p.code || "")
                return code === plu || code.padStart(5, "0") === plu
            })

            if (candidate && candidate.code !== "-1" && !(typeof candidate.stock === "number" && candidate.stock <= 0)) {
                addItem(candidate, qty) // Usamos la cantidad parseada
                setSearchTerm("")
                return
            }
        }

        const filtered = filteredProducts()
        if (!filtered || filtered.length === 0) return

        // 2. Un solo producto
        if (filtered.length === 1) {
            const onlyOne = filtered[0]
            if (onlyOne.code === "-1") {
                setShowOtherModal(true)
                return
            }
            if (typeof onlyOne.stock === "number" && onlyOne.stock <= 0) return
            addItem(onlyOne)
            setSearchTerm("") // Limpiar al agregar
            return
        }

        // 3. Coincidencia exacta o primer elemento
        const term = (searchTerm || "").trim().toLowerCase()
        let candidate = filtered.find(p => (p.code || "").toLowerCase() === term)
        if (!candidate) candidate = filtered[0]

        if (candidate.code === "-1") {
            setShowOtherModal(true)
            return
        }

        addItem(candidate)
        setSearchTerm("")
    }

    const filteredProducts = () => {
        return products.filter(
            (product) =>
                product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.code.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }


    const calculateTotal = () => selectedItems.reduce((total, item) => total + item.qty * item.priceSale, 0)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        try {
            const saleData: CreateSaleRequest = {
                items: selectedItems,
                notes: notes.trim() || undefined,
                paymentMethod,
            }

            await apiClient.createSale(saleData)
            await loadProducts()

            setSelectedItems([])
            setQtyInputs({})
            setNotes("")
            setShowCheckoutModal(false) // Cerramos el modal de cobro
            setShowSuccess(true)
        } catch (error) {
            setError(error instanceof Error ? error.message : "Error al registrar venta")
        } finally {
            setLoading(false)
        }
    }

    return {
        state: {
            products,
            selectedItems,
            loadingProducts,
            loading,
            error,
            searchTerm,
            qtyInputs,
            notes,
            paymentMethod,
            showOtherModal,
            showSuccess, showCheckoutModal,
            stockWarning,
        },
        actions: {
            setSearchTerm,
            setNotes,
            setPaymentMethod,
            setShowOtherModal,
            setShowSuccess,
            addItem,
            addOtherItem,
            removeItem,
            updateItemQty,
            updateQtyInput,
            handleSearchKeyDown,
            handleSubmit,
            filteredProducts,
            calculateTotal,
            setShowCheckoutModal,
            setStockWarning,
        }
    }
}