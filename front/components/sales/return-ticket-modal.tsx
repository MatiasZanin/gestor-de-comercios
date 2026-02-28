"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Search, RotateCcw, X, Tag } from "lucide-react"
import { apiClient } from "@/lib/api/client"
import type { Sale, SaleItem } from "@/lib/types/api"
import { PAYMENT_METHOD_LABELS } from "@/lib/types/api"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface ReturnTicketModalProps {
    onClose: () => void
    onGenerateReturn: (sale: Sale) => void
}

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amount)

export function ReturnTicketModal({ onClose, onGenerateReturn }: ReturnTicketModalProps) {
    const [ticketNumber, setTicketNumber] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [foundSale, setFoundSale] = useState<Sale | null>(null)

    const handleSearch = async () => {
        const trimmed = ticketNumber.trim()
        if (!trimmed) {
            setError("Ingresá un número de ticket")
            return
        }

        setLoading(true)
        setError("")
        setFoundSale(null)

        try {
            const response = await apiClient.listSales({ saleId: trimmed })
            if (response.items && response.items.length > 0) {
                setFoundSale(response.items[0])
            } else {
                setError("No se encontró ningún ticket con ese número")
            }
        } catch (err) {
            setError("Error al buscar el ticket. Intentá de nuevo.")
            console.error("Error searching ticket:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSearch()
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b shrink-0">
                    <div className="flex items-center gap-2">
                        <RotateCcw className="w-5 h-5 text-orange-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Devolución por Ticket</h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                    {/* Search */}
                    <div className="space-y-2">
                        <Label htmlFor="ticketNumber">Nro. de Ticket</Label>
                        <div className="flex gap-2">
                            <Input
                                id="ticketNumber"
                                type="text"
                                placeholder="Ingresá el número de ticket..."
                                value={ticketNumber}
                                onChange={(e) => {
                                    setTicketNumber(e.target.value)
                                    setError("")
                                }}
                                onKeyDown={handleKeyDown}
                                autoFocus
                            />
                            <Button
                                onClick={handleSearch}
                                disabled={loading}
                                className="bg-orange-600 hover:bg-orange-700 shrink-0"
                            >
                                {loading ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                ) : (
                                    <Search className="w-4 h-4" />
                                )}
                            </Button>
                        </div>
                        {error && <p className="text-red-600 text-sm">{error}</p>}
                    </div>

                    {/* Sale preview */}
                    {foundSale && (
                        <div className="border rounded-lg p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                            {/* Sale header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-semibold text-gray-900">
                                        Venta #{foundSale.saleId.slice(-8)}
                                    </h3>
                                    <Badge variant="outline" className="text-xs">
                                        {format(new Date(foundSale.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                                    </Badge>
                                    {foundSale.paymentMethod && (
                                        <Badge variant="secondary" className="text-xs">
                                            {PAYMENT_METHOD_LABELS[foundSale.paymentMethod]}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* Items */}
                            <div className="space-y-2">
                                {foundSale.items.map((item, index) => {
                                    const isReturn = item.qty < 0
                                    return (
                                        <div
                                            key={index}
                                            className={`p-2 rounded text-sm ${isReturn ? "bg-red-50 border border-red-200" : "bg-gray-50"}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={isReturn ? "text-red-600 font-medium" : "font-medium"}>
                                                        {item.name}
                                                    </span>
                                                    {isReturn && (
                                                        <span className="text-[10px] font-semibold uppercase text-red-500 bg-red-100 px-1 py-0.5 rounded">
                                                            Dev.
                                                        </span>
                                                    )}
                                                    {item.discountApplied && item.discountApplied > 0 && (
                                                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded flex items-center gap-0.5">
                                                            <Tag className="w-2.5 h-2.5" />
                                                            {item.offerName || "Dto"}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`font-bold tabular-nums ${isReturn ? "text-red-600" : ""}`}>
                                                    {formatCurrency(item.qty * item.priceSale)}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-600 mt-0.5 flex justify-between">
                                                <span>
                                                    {Math.abs(item.qty)} {item.uom} × {formatCurrency(item.priceSale)}
                                                </span>
                                                <span className="text-gray-400">{item.code}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Total */}
                            <div className="flex justify-between items-center pt-2 border-t">
                                <span className="font-bold text-gray-900">Total</span>
                                <span className="font-bold text-lg text-gray-900 tabular-nums">
                                    {formatCurrency(foundSale.total)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 p-4 sm:p-6 border-t shrink-0">
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    {foundSale && (
                        <Button
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => onGenerateReturn(foundSale)}
                        >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Generar Devolución
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
