"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { X, Plus, Trash2, CalendarIcon, Clock, HelpCircle } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
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
    const [showGuide, setShowGuide] = useState(false)

    // Form state
    const [name, setName] = useState(offer?.name || "")
    const [discountType, setDiscountType] = useState<DiscountType>(offer?.discountType || "PERCENTAGE")
    const [discountValue, setDiscountValue] = useState(offer?.discountValue?.toString() || "")

    // Date + time state (separated for better UX)
    const parseExisting = (iso?: string) => {
        if (!iso) return { date: undefined as Date | undefined, hour: "00", minute: "00" }
        const d = new Date(iso)
        return {
            date: d,
            hour: String(d.getHours()).padStart(2, "0"),
            minute: String(d.getMinutes()).padStart(2, "0"),
        }
    }
    const startParsed = parseExisting(offer?.startDate)
    const endParsed = parseExisting(offer?.endDate)

    const [startDateObj, setStartDateObj] = useState<Date | undefined>(startParsed.date)
    const [startHour, setStartHour] = useState(startParsed.hour)
    const [startMinute, setStartMinute] = useState(startParsed.minute)
    const [startPopoverOpen, setStartPopoverOpen] = useState(false)

    const [endDateObj, setEndDateObj] = useState<Date | undefined>(endParsed.date)
    const [endHour, setEndHour] = useState(endParsed.hour || "23")
    const [endMinute, setEndMinute] = useState(endParsed.minute || "59")
    const [endPopoverOpen, setEndPopoverOpen] = useState(false)

    const [scopeType, setScopeType] = useState<ScopeType>(offer?.scope?.type || "PRODUCT")
    const [scopeValues, setScopeValues] = useState<string[]>(offer?.scope?.values || [])
    const [scopeInput, setScopeInput] = useState("")

    // Helper: combine date + time into ISO string
    const combineDatetime = (date: Date | undefined, hour: string, minute: string): string | null => {
        if (!date) return null
        const d = new Date(date)
        d.setHours(Number(hour), Number(minute), 0, 0)
        return d.toISOString()
    }

    // Generate hour/minute options
    const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"))
    const minuteOptions = ["00", "15", "30", "45"]

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
        if (!startDateObj || !endDateObj) { setError("Las fechas de inicio y fin son obligatorias"); return }

        const startIso = combineDatetime(startDateObj, startHour, startMinute)
        const endIso = combineDatetime(endDateObj, endHour, endMinute)
        if (!startIso || !endIso) { setError("Las fechas de inicio y fin son obligatorias"); return }
        if (new Date(startIso) >= new Date(endIso)) { setError("La fecha de inicio debe ser anterior a la de fin"); return }
        if (scopeValues.length === 0) { setError("Debes seleccionar al menos un valor de alcance"); return }

        setLoading(true)
        try {
            const data = {
                name: name.trim(),
                discountType,
                discountValue: Number(discountValue),
                startDate: startIso,
                endDate: endIso,
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
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold">{isEditing ? "Editar Oferta" : "Nueva Oferta"}</h3>
                        <button type="button" onClick={() => setShowGuide(true)} className="text-gray-400 hover:text-orange-500 transition-colors">
                            <HelpCircle className="h-5 w-5" />
                        </button>
                    </div>
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
                                <SelectContent className="z-[70]">
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
                        {/* Fecha inicio */}
                        <div className="space-y-2">
                            <Label>Fecha inicio</Label>
                            <Popover open={startPopoverOpen} onOpenChange={setStartPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-left font-normal gap-2 mt-1"
                                    >
                                        <CalendarIcon className="h-4 w-4 text-orange-500" />
                                        <span className="text-sm truncate">
                                            {startDateObj
                                                ? format(startDateObj, "dd MMM yyyy", { locale: es })
                                                : "Seleccionar"}
                                        </span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 z-[70]" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={startDateObj}
                                        onSelect={(date) => {
                                            setStartDateObj(date)
                                            setStartPopoverOpen(false)
                                        }}
                                        locale={es}
                                    />
                                </PopoverContent>
                            </Popover>
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                <Select value={startHour} onValueChange={setStartHour}>
                                    <SelectTrigger className="h-8 text-xs flex-1">
                                        <SelectValue placeholder="HH" />
                                    </SelectTrigger>
                                    <SelectContent className="z-[70] max-h-48">
                                        {hourOptions.map(h => (
                                            <SelectItem key={h} value={h}>{h}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <span className="text-gray-400 font-bold">:</span>
                                <Select value={startMinute} onValueChange={setStartMinute}>
                                    <SelectTrigger className="h-8 text-xs flex-1">
                                        <SelectValue placeholder="MM" />
                                    </SelectTrigger>
                                    <SelectContent className="z-[70]">
                                        {minuteOptions.map(m => (
                                            <SelectItem key={m} value={m}>{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Fecha fin */}
                        <div className="space-y-2">
                            <Label>Fecha fin</Label>
                            <Popover open={endPopoverOpen} onOpenChange={setEndPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-left font-normal gap-2 mt-1"
                                    >
                                        <CalendarIcon className="h-4 w-4 text-orange-500" />
                                        <span className="text-sm truncate">
                                            {endDateObj
                                                ? format(endDateObj, "dd MMM yyyy", { locale: es })
                                                : "Seleccionar"}
                                        </span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 z-[70]" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={endDateObj}
                                        onSelect={(date) => {
                                            setEndDateObj(date)
                                            setEndPopoverOpen(false)
                                        }}
                                        locale={es}
                                    />
                                </PopoverContent>
                            </Popover>
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                <Select value={endHour} onValueChange={setEndHour}>
                                    <SelectTrigger className="h-8 text-xs flex-1">
                                        <SelectValue placeholder="HH" />
                                    </SelectTrigger>
                                    <SelectContent className="z-[70] max-h-48">
                                        {hourOptions.map(h => (
                                            <SelectItem key={h} value={h}>{h}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <span className="text-gray-400 font-bold">:</span>
                                <Select value={endMinute} onValueChange={setEndMinute}>
                                    <SelectTrigger className="h-8 text-xs flex-1">
                                        <SelectValue placeholder="MM" />
                                    </SelectTrigger>
                                    <SelectContent className="z-[70]">
                                        {minuteOptions.map(m => (
                                            <SelectItem key={m} value={m}>{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Scope */}
                    <div>
                        <Label>Alcance</Label>
                        <Select value={scopeType} onValueChange={(v) => { setScopeType(v as ScopeType); setScopeValues([]) }}>
                            <SelectTrigger className="mt-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[70]">
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

            <Dialog open={showGuide} onOpenChange={setShowGuide}>
                <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto z-[80]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold">🏷️ Cómo crear una oferta (Guía Rápida)</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 text-sm">
                        {/* 1. El Descuento */}
                        <div className="flex gap-3 p-3 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                            <span className="text-xl">1️⃣</span>
                            <div>
                                <p className="font-semibold text-orange-800">El Descuento</p>
                                <ul className="text-orange-900/80 text-xs mt-1 space-y-1 list-none">
                                    <li><strong>Nombre:</strong> Poné algo fácil de identificar (Ej: &quot;Promo Verano&quot;).</li>
                                    <li><strong>Tipo y Valor:</strong> Elegí si es <code className="bg-orange-100 text-orange-800 px-1 rounded text-xs">Porcentaje (%)</code> o <code className="bg-orange-100 text-orange-800 px-1 rounded text-xs">Monto Fijo ($)</code> y escribí el número.</li>
                                    <li className="text-orange-600 italic text-[10px]">Si es porcentaje, el máximo es 100.</li>
                                </ul>
                            </div>
                        </div>

                        {/* 2. La Vigencia */}
                        <div className="flex gap-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                            <span className="text-xl">2️⃣</span>
                            <div>
                                <p className="font-semibold text-blue-800">La Vigencia (Días y Horarios)</p>
                                <ul className="text-blue-900/80 text-xs mt-1 space-y-1 list-none">
                                    <li>Elegí las fechas de inicio y fin en el calendario.</li>
                                    <li>Ajustá la hora: El reloj usa formato de 24 horas (ej: <code className="bg-blue-100 text-blue-800 px-1 rounded text-xs">14:00</code> son las 2 de la tarde; <code className="bg-blue-100 text-blue-800 px-1 rounded text-xs">00:00</code> es la medianoche).</li>
                                </ul>
                                <div className="mt-2 p-2 bg-blue-100 rounded text-[10px] text-blue-800 font-medium">
                                    ⚠️ Importante: La fecha y hora de inicio debe ser estrictamente anterior a la de cierre.
                                </div>
                            </div>
                        </div>

                        {/* 3. El Alcance */}
                        <div className="flex gap-3 p-3 bg-emerald-50 rounded-lg border-l-4 border-emerald-500">
                            <span className="text-xl">3️⃣</span>
                            <div>
                                <p className="font-semibold text-emerald-800">El Alcance (A qué le bajamos el precio)</p>
                                <ul className="text-emerald-900/80 text-xs mt-1 space-y-1 list-none">
                                    <li>Elegí si la oferta va por <code className="bg-emerald-100 text-emerald-800 px-1 rounded text-xs">Producto</code>, <code className="bg-emerald-100 text-emerald-800 px-1 rounded text-xs">Categoría</code> o <code className="bg-emerald-100 text-emerald-800 px-1 rounded text-xs">Marca</code>.</li>
                                    <li>Buscá lo que querés agregar y hacé clic en la sugerencia.</li>
                                    <li>Podés agregar más de uno.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
