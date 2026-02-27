"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X, Plus, Trash2 } from "lucide-react"
import { apiClient } from "@/lib/api/client"
import type { Offer, DiscountType, ScopeType, Product } from "@/lib/types/api"

interface OfferFormModalProps {
    offer?: Offer
    onClose: () => void
    onSuccess: () => void
}

export function OfferFormModal({ offer, onClose, onSuccess }: OfferFormModalProps) {
    const isEditing = !!offer
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    // Form state
    const [name, setName] = useState(offer?.name || "")
    const [discountType, setDiscountType] = useState<DiscountType>(offer?.discountType || "PERCENTAGE")
    const [discountValue, setDiscountValue] = useState(offer?.discountValue?.toString() || "")
    const [startDate, setStartDate] = useState(offer?.startDate ? offer.startDate.slice(0, 16) : "")
    const [endDate, setEndDate] = useState(offer?.endDate ? offer.endDate.slice(0, 16) : "")
    const [scopeType, setScopeType] = useState<ScopeType>(offer?.scope?.type || "PRODUCT")
    const [scopeValues, setScopeValues] = useState<string[]>(offer?.scope?.values || [])
    const [scopeInput, setScopeInput] = useState("")

    // Products/metadata for suggestions
    const [products, setProducts] = useState<Product[]>([])
    const [metadata, setMetadata] = useState<{ categories: string[] }>({ categories: [] })

    useEffect(() => {
        const loadData = async () => {
            try {
                const [productsRes, metadataRes] = await Promise.all([
                    apiClient.listProducts({ isActive: true }),
                    apiClient.getMetadata().catch(() => ({ categories: [] })),
                ])
                setProducts(productsRes.items || [])
                setMetadata(metadataRes)
            } catch (e) {
                console.error("Error loading data:", e)
            }
        }
        loadData()
    }, [])

    const addScopeValue = (value: string) => {
        const trimmed = value.trim()
        if (trimmed && !scopeValues.includes(trimmed)) {
            setScopeValues([...scopeValues, trimmed])
        }
        setScopeInput("")
    }

    const removeScopeValue = (val: string) => {
        setScopeValues(scopeValues.filter(v => v !== val))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (!name.trim()) { setError("El nombre es obligatorio"); return }
        if (!discountValue || Number(discountValue) <= 0) { setError("El valor del descuento debe ser positivo"); return }
        if (discountType === "PERCENTAGE" && Number(discountValue) > 100) { setError("El porcentaje no puede superar 100"); return }
        if (!startDate || !endDate) { setError("Las fechas de inicio y fin son obligatorias"); return }
        if (new Date(startDate) >= new Date(endDate)) { setError("La fecha de inicio debe ser anterior a la de fin"); return }
        if (scopeValues.length === 0) { setError("Debes seleccionar al menos un valor de alcance"); return }

        setLoading(true)
        try {
            const data = {
                name: name.trim(),
                discountType,
                discountValue: Number(discountValue),
                startDate: new Date(startDate).toISOString(),
                endDate: new Date(endDate).toISOString(),
                scope: { type: scopeType, values: scopeValues },
            }

            if (isEditing) {
                await apiClient.updateOffer(offer!.offerId, data)
            } else {
                await apiClient.createOffer(data)
            }
            onSuccess()
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al guardar la oferta")
        } finally {
            setLoading(false)
        }
    }

    // Suggestions for the scope field
    const getSuggestions = (): { label: string; value: string }[] => {
        switch (scopeType) {
            case 'PRODUCT':
                return products
                    .filter(p => !scopeValues.includes(p.code))
                    .map(p => ({ label: `${p.code} - ${p.name}`, value: p.code }))
            case 'CATEGORY':
                return (metadata.categories || [])
                    .filter(c => !scopeValues.includes(c))
                    .map(c => ({ label: c, value: c }))
            case 'BRAND':
                const brands = [...new Set(products.map(p => p.brand).filter(Boolean) as string[])]
                return brands
                    .filter(b => !scopeValues.includes(b))
                    .map(b => ({ label: b, value: b }))
            default:
                return []
        }
    }

    const filteredSuggestions = getSuggestions().filter(s =>
        s.label.toLowerCase().includes(scopeInput.toLowerCase())
    )

    return (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center sm:p-4 z-[60]">
            <div className="bg-white rounded-none sm:rounded-lg shadow-xl w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b bg-gray-50 flex items-center justify-between">
                    <h3 className="text-xl font-bold">{isEditing ? "Editar Oferta" : "Nueva Oferta"}</h3>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
                    )}

                    <div>
                        <Label htmlFor="name">Nombre de la oferta</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder='Ej: "Verano 2026 - 20% OFF"'
                            className="mt-1"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Tipo de descuento</Label>
                            <Select value={discountType} onValueChange={(v) => setDiscountType(v as DiscountType)}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PERCENTAGE">Porcentaje (%)</SelectItem>
                                    <SelectItem value="FIXED">Monto Fijo ($)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="discountValue">Valor</Label>
                            <Input
                                id="discountValue"
                                type="number"
                                step="0.01"
                                min="0"
                                max={discountType === "PERCENTAGE" ? "100" : undefined}
                                value={discountValue}
                                onChange={(e) => setDiscountValue(e.target.value)}
                                placeholder={discountType === "PERCENTAGE" ? "Ej: 15" : "Ej: 500"}
                                className="mt-1"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="startDate">Fecha inicio</Label>
                            <Input
                                id="startDate"
                                type="datetime-local"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="endDate">Fecha fin</Label>
                            <Input
                                id="endDate"
                                type="datetime-local"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="mt-1"
                            />
                        </div>
                    </div>

                    {/* Scope */}
                    <div>
                        <Label>Alcance</Label>
                        <Select value={scopeType} onValueChange={(v) => { setScopeType(v as ScopeType); setScopeValues([]) }}>
                            <SelectTrigger className="mt-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PRODUCT">Por Producto</SelectItem>
                                <SelectItem value="CATEGORY">Por Categoría</SelectItem>
                                <SelectItem value="BRAND">Por Marca</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Selected scope values */}
                    {scopeValues.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {scopeValues.map((val) => (
                                <Badge key={val} variant="secondary" className="gap-1 pr-1">
                                    {val}
                                    <button
                                        type="button"
                                        onClick={() => removeScopeValue(val)}
                                        className="ml-1 hover:text-red-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}

                    {/* Scope input with suggestions */}
                    <div className="relative">
                        <Input
                            value={scopeInput}
                            onChange={(e) => setScopeInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault()
                                    if (scopeInput.trim()) addScopeValue(scopeInput)
                                }
                            }}
                            placeholder={
                                scopeType === 'PRODUCT' ? "Buscar producto por código o nombre..."
                                    : scopeType === 'CATEGORY' ? "Buscar categoría..."
                                        : "Buscar marca..."
                            }
                        />
                        {scopeInput && filteredSuggestions.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                                {filteredSuggestions.slice(0, 10).map((sug) => (
                                    <button
                                        key={sug.value}
                                        type="button"
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                                        onClick={() => addScopeValue(sug.value)}
                                    >
                                        {sug.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 pt-4" style={{ paddingBottom: 'max(0rem, env(safe-area-inset-bottom))' }}>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-orange-600 hover:bg-orange-700"
                        >
                            {loading ? "Guardando..." : isEditing ? "Guardar Cambios" : "Crear Oferta"}
                        </Button>
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                            Cancelar
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
