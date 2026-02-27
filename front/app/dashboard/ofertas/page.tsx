"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Tag, Search, ChevronLeft, ChevronRight, X, Clock, CheckCircle2, CalendarClock, StopCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient } from "@/lib/api/client"
import type { Offer, OfferListResponse, OfferStatus } from "@/lib/types/api"
import { OfferFormModal } from "@/components/offers/offer-form-modal"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useAuth } from "@/lib/hooks/use-auth"
import { OfferDetailModal } from "@/components/offers/offer-detail-modal"

function TruncatedCell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    const content = String(children ?? "");
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className={`block truncate ${className}`}>{content}</span>
            </TooltipTrigger>
            <TooltipContent>
                <p>{content}</p>
            </TooltipContent>
        </Tooltip>
    );
}

function getOfferStatus(offer: Offer): OfferStatus {
    const now = new Date().toISOString()
    if (now < offer.startDate) return 'scheduled'
    if (now > offer.endDate) return 'expired'
    return 'active'
}

function OfferStatusBadge({ status }: { status: OfferStatus }) {
    const config = {
        active: { label: "Activa", variant: "default" as const, className: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
        scheduled: { label: "Programada", variant: "outline" as const, className: "bg-blue-50 text-blue-700 border-blue-200", icon: CalendarClock },
        expired: { label: "Expirada", variant: "secondary" as const, className: "bg-gray-100 text-gray-500 border-gray-200", icon: Clock },
    }
    const c = config[status]
    return (
        <Badge variant={c.variant} className={`text-xs gap-1 ${c.className}`}>
            <c.icon className="w-3 h-3" />
            {c.label}
        </Badge>
    )
}

function formatDiscountValue(offer: Offer): string {
    if (offer.discountType === 'PERCENTAGE') return `${offer.discountValue}%`
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(offer.discountValue)
}

const SCOPE_LABELS = { PRODUCT: "Productos", CATEGORY: "Categorías", BRAND: "Marcas" }

export default function OffersPage() {
    const { user } = useAuth()
    const [offers, setOffers] = useState<Offer[]>([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [showFormModal, setShowFormModal] = useState(false)
    const [editingOffer, setEditingOffer] = useState<Offer | undefined>(undefined)
    const [selectedOffer, setSelectedOffer] = useState<Offer | undefined>(undefined)

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const [pageKeys, setPageKeys] = useState<Record<number, string | undefined>>({ 1: undefined })
    const [hasNextPage, setHasNextPage] = useState(false)

    const isAdmin = user?.role === "admin"

    const loadOffers = useCallback(async (page: number = 1, lastKey?: string) => {
        try {
            setLoading(true)
            const params: Record<string, string> = {}
            if (statusFilter && statusFilter !== "all") params.status = statusFilter
            if (lastKey) params.lastKey = lastKey

            const response: OfferListResponse = await apiClient.listOffers(params)
            setOffers(response.items || [])
            setCurrentPage(page)

            if (response.lastKey) {
                setHasNextPage(true)
                setPageKeys((prev) => ({ ...prev, [page + 1]: response.lastKey }))
            } else {
                setHasNextPage(false)
            }
        } catch (error) {
            console.error("Error loading offers:", error)
        } finally {
            setLoading(false)
        }
    }, [statusFilter])

    useEffect(() => {
        setCurrentPage(1)
        setPageKeys({ 1: undefined })
        setHasNextPage(false)
        loadOffers(1)
    }, [loadOffers])

    const handleNextPage = () => {
        const nextPage = currentPage + 1
        loadOffers(nextPage, pageKeys[nextPage])
    }

    const handlePrevPage = () => {
        if (currentPage <= 1) return
        const prevPage = currentPage - 1
        loadOffers(prevPage, pageKeys[prevPage])
    }

    const handleCreateSuccess = () => {
        setShowFormModal(false)
        setEditingOffer(undefined)
        loadOffers(1)
    }

    const handleEditClick = (offer: Offer) => {
        setSelectedOffer(undefined)
        setEditingOffer(offer)
        setShowFormModal(true)
    }

    const handleFinish = async (offerId: string) => {
        try {
            await apiClient.finishOffer(offerId)
            setSelectedOffer(undefined)
            loadOffers(currentPage, pageKeys[currentPage])
        } catch (error) {
            console.error("Error finishing offer:", error)
        }
    }

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(amount)

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Ofertas</h1>
                        <p className="text-sm sm:text-base text-gray-600">Gestiona las promociones y descuentos</p>
                    </div>
                    {isAdmin && (
                        <Button
                            onClick={() => { setEditingOffer(undefined); setShowFormModal(true) }}
                            className="bg-orange-600 hover:bg-orange-700 text-base sm:text-lg px-4 py-4 sm:px-6 sm:py-6 rounded-lg cursor-pointer transition-transform transform hover:scale-105 w-full sm:w-auto"
                        >
                            <Plus className="w-5 h-5 mr-2" />
                            Nueva Oferta
                        </Button>
                    )}
                </div>

                <Card>
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 mb-4">
                            <Tag className="w-5 h-5" />
                            Lista de Ofertas
                        </CardTitle>

                        {/* Toolbar */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="Filtrar por estado" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    <SelectItem value="active">Activas</SelectItem>
                                    <SelectItem value="scheduled">Programadas</SelectItem>
                                    <SelectItem value="expired">Históricas</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>

                    <CardContent>
                        {loading ? (
                            <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                                <p className="text-gray-500 mt-2">Cargando ofertas...</p>
                            </div>
                        ) : offers.length === 0 ? (
                            <div className="text-center py-8">
                                <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">No se encontraron ofertas.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Mobile view */}
                                <div className="sm:hidden space-y-3">
                                    {offers.map((offer) => {
                                        const status = getOfferStatus(offer)
                                        return (
                                            <div
                                                key={offer.offerId}
                                                className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer space-y-2"
                                                onClick={() => setSelectedOffer(offer)}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <h3 className="font-semibold text-gray-900">{offer.name}</h3>
                                                    <OfferStatusBadge status={status} />
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                                    <span className="font-medium text-orange-600">{formatDiscountValue(offer)}</span>
                                                    <span>•</span>
                                                    <span>{SCOPE_LABELS[offer.scope.type]}: {offer.scope.values.length}</span>
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {format(new Date(offer.startDate), "dd/MM/yy HH:mm", { locale: es })} — {format(new Date(offer.endDate), "dd/MM/yy HH:mm", { locale: es })}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Desktop table */}
                                <div className="hidden sm:block overflow-x-auto">
                                    <table className="w-full text-sm text-gray-700 table-fixed min-w-0">
                                        <thead>
                                            <tr className="text-left border-b">
                                                <th className="pr-3 py-2 w-[22%]">Nombre</th>
                                                <th className="px-3 py-2 w-[10%]">Tipo</th>
                                                <th className="px-3 py-2 w-[10%]">Valor</th>
                                                <th className="px-3 py-2 w-[15%]">Alcance</th>
                                                <th className="px-3 py-2 w-[17%]">Inicio</th>
                                                <th className="px-3 py-2 w-[17%]">Fin</th>
                                                <th className="px-3 py-2 w-[9%]">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {offers.map((offer) => {
                                                const status = getOfferStatus(offer)
                                                return (
                                                    <tr
                                                        key={offer.offerId}
                                                        className="border-b hover:bg-gray-50 cursor-pointer"
                                                        onClick={() => setSelectedOffer(offer)}
                                                    >
                                                        <td className="pr-3 py-2.5">
                                                            <TruncatedCell className="font-medium">{offer.name}</TruncatedCell>
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            {offer.discountType === 'PERCENTAGE' ? 'Porcentaje' : 'Monto Fijo'}
                                                        </td>
                                                        <td className="px-3 py-2.5 font-medium text-orange-600 tabular-nums">
                                                            {formatDiscountValue(offer)}
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            <TruncatedCell>{SCOPE_LABELS[offer.scope.type]}: {offer.scope.values.join(', ')}</TruncatedCell>
                                                        </td>
                                                        <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                                                            {format(new Date(offer.startDate), "dd/MM/yy HH:mm", { locale: es })}
                                                        </td>
                                                        <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                                                            {format(new Date(offer.endDate), "dd/MM/yy HH:mm", { locale: es })}
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            <OfferStatusBadge status={status} />
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {offers.length > 0 && (
                                    <div className="flex items-center justify-end gap-4 pt-4 border-t">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handlePrevPage}
                                            disabled={currentPage <= 1 || loading}
                                            className="flex items-center gap-1"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            Anterior
                                        </Button>
                                        <span className="text-sm text-gray-600 font-medium">
                                            Página {currentPage}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleNextPage}
                                            disabled={!hasNextPage || loading}
                                            className="flex items-center gap-1"
                                        >
                                            Siguiente
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Modals */}
                {showFormModal && (
                    <OfferFormModal
                        offer={editingOffer}
                        onClose={() => { setShowFormModal(false); setEditingOffer(undefined) }}
                        onSuccess={handleCreateSuccess}
                    />
                )}

                {selectedOffer && (
                    <OfferDetailModal
                        offer={selectedOffer}
                        onClose={() => setSelectedOffer(undefined)}
                        onEdit={isAdmin ? () => handleEditClick(selectedOffer) : undefined}
                        onFinish={isAdmin ? () => handleFinish(selectedOffer.offerId) : undefined}
                    />
                )}
            </div>
        </DashboardLayout>
    )
}
