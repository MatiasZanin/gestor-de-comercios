"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, Pencil, StopCircle, CheckCircle2, CalendarClock, Clock } from "lucide-react"
import type { Offer, OfferStatus } from "@/lib/types/api"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useState } from "react"

interface OfferDetailModalProps {
    offer: Offer
    onClose: () => void
    onEdit?: () => void
    onFinish?: () => void
}

function getOfferStatus(offer: Offer): OfferStatus {
    const now = new Date().toISOString()
    if (now < offer.startDate) return 'scheduled'
    if (now > offer.endDate) return 'expired'
    return 'active'
}

const STATUS_CONFIG = {
    active: { label: "Activa", className: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
    scheduled: { label: "Programada", className: "bg-blue-50 text-blue-700 border-blue-200", icon: CalendarClock },
    expired: { label: "Expirada", className: "bg-gray-100 text-gray-500 border-gray-200", icon: Clock },
}

const SCOPE_LABELS = { PRODUCT: "Productos", CATEGORY: "Categorías", BRAND: "Marcas" }

export function OfferDetailModal({ offer, onClose, onEdit, onFinish }: OfferDetailModalProps) {
    const [confirmingFinish, setConfirmingFinish] = useState(false)
    const status = getOfferStatus(offer)
    const config = STATUS_CONFIG[status]

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amount)

    return (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center sm:p-4 z-[60]">
            <div className="bg-white rounded-none sm:rounded-lg shadow-xl w-full sm:max-w-md h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b bg-gray-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">{offer.name}</h3>
                        <Badge variant="outline" className={`mt-2 gap-1 ${config.className}`}>
                            <config.icon className="w-3 h-3" />
                            {config.label}
                        </Badge>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Discount */}
                    <div className="text-center py-4 bg-orange-50 rounded-lg border border-orange-100">
                        <div className="text-sm text-gray-500 uppercase tracking-wide">Descuento</div>
                        <div className="text-3xl font-black text-orange-600 mt-1">
                            {offer.discountType === 'PERCENTAGE'
                                ? `${offer.discountValue}%`
                                : formatCurrency(offer.discountValue)
                            }
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                            {offer.discountType === 'PERCENTAGE' ? 'Porcentaje' : 'Monto Fijo'}
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Inicio</div>
                            <div className="text-sm font-medium">{format(new Date(offer.startDate), "dd/MM/yyyy HH:mm", { locale: es })}</div>
                        </div>
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Fin</div>
                            <div className="text-sm font-medium">{format(new Date(offer.endDate), "dd/MM/yyyy HH:mm", { locale: es })}</div>
                        </div>
                    </div>

                    {/* Scope */}
                    <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                            Alcance: {SCOPE_LABELS[offer.scope.type]}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {offer.scope.values.map((val) => (
                                <Badge key={val} variant="secondary">{val}</Badge>
                            ))}
                        </div>
                    </div>

                    {/* Metadata */}
                    <div className="text-xs text-gray-400 pt-2 border-t">
                        Creada: {format(new Date(offer.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                        {offer.updatedAt !== offer.createdAt && (
                            <> · Actualizada: {format(new Date(offer.updatedAt), "dd/MM/yyyy HH:mm", { locale: es })}</>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 pt-2" style={{ paddingBottom: 'max(0rem, env(safe-area-inset-bottom))' }}>
                        {onEdit && status !== 'expired' && (
                            <Button variant="outline" onClick={onEdit} className="w-full gap-2">
                                <Pencil className="w-4 h-4" />
                                Editar Oferta
                            </Button>
                        )}
                        {onFinish && status === 'active' && (
                            confirmingFinish ? (
                                <div className="flex gap-2">
                                    <Button
                                        variant="destructive"
                                        className="flex-1"
                                        onClick={() => { onFinish(); setConfirmingFinish(false) }}
                                    >
                                        Confirmar
                                    </Button>
                                    <Button variant="outline" className="flex-1" onClick={() => setConfirmingFinish(false)}>
                                        Cancelar
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    variant="outline"
                                    className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                    onClick={() => setConfirmingFinish(true)}
                                >
                                    <StopCircle className="w-4 h-4" />
                                    Finalizar Oferta
                                </Button>
                            )
                        )}
                        <Button variant="ghost" onClick={onClose}>
                            Cerrar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
