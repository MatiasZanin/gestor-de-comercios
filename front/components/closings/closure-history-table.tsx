"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { History, Loader2, Eye, ChevronLeft, ChevronRight } from "lucide-react"
import { apiClient } from "@/lib/api/client"
import type { CashClose, CashCloseListResponse } from "@/lib/types/api"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface ClosureHistoryTableProps {
    refreshTrigger?: number
    startDate?: string
    endDate?: string
}

export function ClosureHistoryTable({ refreshTrigger, startDate, endDate }: ClosureHistoryTableProps) {
    const router = useRouter()
    const [closures, setClosures] = useState<CashClose[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    // pageCursors[0] = undefined (page 1), pageCursors[1] = lastKey for page 2, etc.
    const [pageCursors, setPageCursors] = useState<(string | undefined)[]>([undefined])
    const [hasNextPage, setHasNextPage] = useState(false)

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
        }).format(amount)
    }

    const fetchPage = useCallback(async (cursor: string | undefined) => {
        try {
            setLoading(true)
            setError("")

            const params: Record<string, string | undefined> = {
                lastKey: cursor,
            }

            if (startDate && endDate && startDate === endDate) {
                params.day = startDate
            } else {
                if (startDate) params.start = startDate
                if (endDate) params.end = endDate
            }

            const response: CashCloseListResponse = await apiClient.listClosures(params)

            setClosures(response.items)
            return response.lastKey
        } catch (err) {
            if (err instanceof Error && err.message.includes("admin")) {
                setError("Solo los administradores pueden ver el historial de cierres")
            } else {
                setError(err instanceof Error ? err.message : "Error al cargar cierres")
            }
            return undefined
        } finally {
            setLoading(false)
        }
    }, [startDate, endDate])

    const loadPage = useCallback(async (page: number) => {
        const cursor = pageCursors[page - 1]
        const nextLastKey = await fetchPage(cursor)

        setCurrentPage(page)
        setHasNextPage(!!nextLastKey)

        if (nextLastKey && pageCursors.length <= page) {
            setPageCursors(prev => [...prev.slice(0, page), nextLastKey])
        }
    }, [pageCursors, fetchPage])

    const resetAndLoad = useCallback(async () => {
        setCurrentPage(1)
        setPageCursors([undefined])
        setHasNextPage(false)

        const nextLastKey = await fetchPage(undefined)
        setHasNextPage(!!nextLastKey)

        if (nextLastKey) {
            setPageCursors([undefined, nextLastKey])
        }
    }, [fetchPage])

    useEffect(() => {
        if (startDate && endDate) {
            resetAndLoad()
        }
    }, [startDate, endDate])

    useEffect(() => {
        if (refreshTrigger && refreshTrigger > 0) {
            resetAndLoad()
        }
    }, [refreshTrigger])

    const goToNextPage = () => {
        if (hasNextPage) {
            loadPage(currentPage + 1)
        }
    }

    const goToPrevPage = () => {
        if (currentPage > 1) {
            loadPage(currentPage - 1)
        }
    }

    if (error && error.includes("administradores")) {
        return null
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                    <History className="w-5 h-5" />
                    Historial de Cierres
                </CardTitle>
            </CardHeader>
            <CardContent>
                {error && !error.includes("administradores") && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg mb-4">
                        {error}
                    </div>
                )}

                {loading && closures.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
                        <span className="ml-2 text-gray-500">Cargando cierres...</span>
                    </div>
                ) : closures.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        No hay cierres registrados para esta fecha
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Mobile View */}
                        <div className="sm:hidden space-y-4">
                            {closures.map((closure) => (
                                <div
                                    key={closure.closureId}
                                    className="border rounded-lg p-4 space-y-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <Badge variant="outline">
                                            {format(new Date(closure.closedAt), "HH:mm", { locale: es })}
                                        </Badge>
                                        <Badge
                                            variant={
                                                closure.difference === 0
                                                    ? "default"
                                                    : (closure.difference !== undefined && closure.difference > 0)
                                                        ? "secondary"
                                                        : "destructive"
                                            }
                                        >
                                            {closure.difference === 0
                                                ? "Cuadrado"
                                                : (closure.difference !== undefined && closure.difference > 0)
                                                    ? "Sobrante"
                                                    : "Faltante"}
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <p className="text-gray-500">Efectivo Sistema</p>
                                            <p className="font-medium">{closure.systemTotalCash ? formatCurrency(closure.systemTotalCash) : "-"}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Efectivo Declarado</p>
                                            <p className="font-medium">{closure.declaredCash ? formatCurrency(closure.declaredCash) : "-"}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Gastos</p>
                                            <p className="font-medium">{formatCurrency(closure.expenses)}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Diferencia</p>
                                            <p
                                                className={`font-medium ${closure.difference === 0
                                                    ? "text-emerald-600"
                                                    : (closure.difference !== undefined && closure.difference > 0)
                                                        ? "text-blue-600"
                                                        : "text-red-600"
                                                    }`}
                                            >
                                                {closure.difference !== undefined ? formatCurrency(closure.difference) : "-"}
                                            </p>
                                        </div>
                                    </div>
                                    {closure.notes && (
                                        <p className="text-xs text-gray-500 border-t pt-2">
                                            {closure.notes}
                                        </p>
                                    )}
                                    <div className="pt-2 border-t mt-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full"
                                            onClick={() => router.push(`/dashboard/cierres/${closure.closureId}`)}
                                        >
                                            <Eye className="w-4 h-4 mr-2" />
                                            Ver detalle
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop View */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left border-b">
                                        <th className="pb-2 pr-4">Fecha</th>
                                        <th className="pb-2 px-4">Hora</th>
                                        <th className="pb-2 px-4">Efectivo</th>
                                        <th className="pb-2 px-4">Tarjeta</th>
                                        <th className="pb-2 px-4">Transferencia</th>
                                        <th className="pb-2 px-4">Otros</th>
                                        <th className="pb-2 px-4">Diferencia</th>
                                        <th className="pb-2 px-4">Estado</th>
                                        <th className="pb-2 pl-4">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {closures.map((closure) => (
                                        <tr key={closure.closureId} className="border-b hover:bg-gray-50">
                                            <td className="py-3 pr-4">
                                                {format(new Date(closure.closedAt), "dd/MM/yyyy", { locale: es })}
                                            </td>
                                            <td className="py-3 px-4">
                                                {format(new Date(closure.closedAt), "HH:mm", { locale: es })}
                                            </td>
                                            <td className="py-3 px-4 tabular-nums">
                                                {closure.systemTotalCash !== undefined ? formatCurrency(closure.systemTotalCash) : "-"}
                                            </td>
                                            <td className="py-3 px-4 tabular-nums">
                                                {closure.systemTotalCard !== undefined ? formatCurrency(closure.systemTotalCard) : "-"}
                                            </td>
                                            <td className="py-3 px-4 tabular-nums">
                                                {closure.systemTotalTransfer !== undefined ? formatCurrency(closure.systemTotalTransfer) : "-"}
                                            </td>
                                            <td className="py-3 px-4 tabular-nums">
                                                {closure.systemTotalOther !== undefined ? formatCurrency(closure.systemTotalOther) : "-"}
                                            </td>
                                            <td
                                                className={`py-3 px-4 tabular-nums font-medium ${closure.difference === 0
                                                    ? "text-emerald-600"
                                                    : (closure.difference && closure.difference > 0)
                                                        ? "text-blue-600"
                                                        : "text-red-600"
                                                    }`}
                                            >
                                                {closure.difference !== undefined ? formatCurrency(closure.difference) : "-"}
                                            </td>
                                            <td className="py-3 pl-4">
                                                <Badge
                                                    variant={
                                                        closure.difference === 0
                                                            ? "default"
                                                            : (closure.difference && closure.difference > 0)
                                                                ? "secondary"
                                                                : "destructive"
                                                    }
                                                    className="whitespace-nowrap"
                                                >
                                                    {closure.difference === 0
                                                        ? "Cuadrado"
                                                        : (closure.difference && closure.difference > 0)
                                                            ? "Sobrante"
                                                            : "Faltante"}
                                                </Badge>
                                            </td>
                                            <td className="py-3 pl-4">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => router.push(`/dashboard/cierres/${closure.closureId}`)}
                                                    title="Ver detalle"
                                                >
                                                    {/* <Eye className="w-4 h-4" /> */}
                                                    <span>Ver</span>
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {(currentPage > 1 || hasNextPage) && (
                            <div className="flex items-center justify-end gap-4 pt-4 border-t">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={goToPrevPage}
                                    disabled={currentPage <= 1 || loading}
                                >
                                    <ChevronLeft className="w-4 h-4 mr-1" />
                                    Anterior
                                </Button>
                                <span className="text-sm text-gray-500">
                                    Página {currentPage}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={goToNextPage}
                                    disabled={!hasNextPage || loading}
                                >
                                    Siguiente
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
