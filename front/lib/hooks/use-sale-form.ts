import { useState, useEffect, useCallback, useMemo } from "react"
import { apiClient } from "@/lib/api/client"
import type { Product, CreateSaleRequest, Sale, SaleItem, PaymentMethod, Offer } from "@/lib/types/api"
import { parseVariableWeightEAN13 } from "@/lib/utils/sales-utils"

interface UseSaleFormProps {
    onSuccess: (sale: Sale) => void
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

    // Ofertas activas
    const [activeOffers, setActiveOffers] = useState<Offer[]>([])

    const loadOffers = useCallback(async () => {
        try {
            const response = await apiClient.listOffers({ status: 'active' })
            setActiveOffers(response.items || [])
        } catch (error) {
            console.error("Error loading offers:", error)
        }
    }, [])

    useEffect(() => {
        loadProducts()
        loadOffers()
    }, [loadProducts, loadOffers])

    useEffect(() => {
        if (!showSuccess) return
        const id = setTimeout(() => {
            setShowSuccess(false)
            // No llamamos a onSuccess() para que el modal de venta quede abierto
        }, 5000)
        return () => clearTimeout(id)
    }, [showSuccess])

    // --- Lógica de Items ---

    const updateItemQty = (code: string, qty: number) => {
        if (isNaN(qty)) return
        // Preserve the sign: if item is in return mode (negative), keep it negative
        setSelectedItems((items) =>
            items.map((item) => {
                if (item.code !== code) return item
                const absQty = Math.abs(qty)
                const sign = item.qty < 0 ? -1 : 1
                return { ...item, qty: sign * absQty }
            })
        )
    }

    const toggleReturnMode = (code: string) => {
        setSelectedItems((items) =>
            items.map((item) =>
                item.code === code ? { ...item, qty: -item.qty } : item
            )
        )
        // Update the qty input display to match the absolute value
        setQtyInputs((prev) => {
            const current = prev[code]
            if (!current) return prev
            return { ...prev, [code]: current }
        })
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

    // --- Aplicar ofertas a los items ---
    const applyOfferToItem = useCallback((item: SaleItem): SaleItem => {
        if (activeOffers.length === 0) return item

        const now = new Date().toISOString()
        let bestDiscount = 0
        let bestOffer: Offer | null = null

        for (const offer of activeOffers) {
            if (now < offer.startDate || now > offer.endDate) continue

            let applies = false
            switch (offer.scope.type) {
                case 'PRODUCT':
                    applies = offer.scope.values.includes(item.code)
                    break
                case 'CATEGORY':
                    applies = !!item.category && offer.scope.values.includes(item.category)
                    break
                case 'BRAND':
                    applies = !!item.brand && offer.scope.values.includes(item.brand)
                    break
            }

            if (!applies) continue

            let discount = 0
            if (offer.discountType === 'PERCENTAGE') {
                discount = (item.priceSale * offer.discountValue) / 100
            } else {
                discount = Math.min(offer.discountValue, item.priceSale)
            }

            if (discount > bestDiscount) {
                bestDiscount = discount
                bestOffer = offer
            }
        }

        if (bestOffer && bestDiscount > 0) {
            return {
                ...item,
                originalPrice: item.priceSale,
                discountApplied: Math.round(bestDiscount * 100) / 100,
                offerName: bestOffer.name,
                offerId: bestOffer.offerId,
            }
        }

        return { ...item, originalPrice: undefined, discountApplied: undefined, offerName: undefined, offerId: undefined }
    }, [activeOffers])

    // Items con ofertas aplicadas (derivado)
    const itemsWithOffers = useMemo(() =>
        selectedItems.map(applyOfferToItem),
        [selectedItems, applyOfferToItem]
    )

    const filteredProducts = () => {
        return products.filter(
            (product) =>
                product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.code.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }


    const calculateTotal = () => itemsWithOffers.reduce((total, item) => {
        const unitPrice = item.discountApplied ? item.priceSale - item.discountApplied : item.priceSale
        return total + item.qty * unitPrice
    }, 0)

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

            const response: Sale = await apiClient.createSale(saleData)
            await loadProducts()

            setSelectedItems([])
            setQtyInputs({})
            setNotes("")
            setShowCheckoutModal(false) // Cerramos el modal de cobro
            setShowSuccess(true)
            onSuccess(response)
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
            itemsWithOffers,
            activeOffers,
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
            toggleReturnMode,
            handleSearchKeyDown,
            handleSubmit,
            filteredProducts,
            calculateTotal,
            setShowCheckoutModal,
            setStockWarning,
        }
    }
}