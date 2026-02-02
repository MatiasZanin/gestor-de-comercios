"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Calendar, History, Loader2, Eye } from "lucide-react"
import { apiClient } from "@/lib/api/client"
import type { CashClose, CashCloseListResponse } from "@/lib/types/api"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface ClosureHistoryTableProps {
    refreshTrigger?: number
}

export function ClosureHistoryTable({ refreshTrigger }: ClosureHistoryTableProps) {
    const router = useRouter()
    const [closures, setClosures] = useState<CashClose[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [searchDate, setSearchDate] = useState(new Date().toISOString().split("T")[0])
    const [lastKey, setLastKey] = useState<string | undefined>()

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
        }).format(amount)
    }

    const loadClosures = useCallback(async (reset = false) => {
        try {
            setLoading(true)
            setError("")

            const response: CashCloseListResponse = await apiClient.listClosures({
                day: searchDate,
                lastKey: reset ? undefined : lastKey,
            })

            if (reset) {
                setClosures(response.items)
            } else {
                setClosures((prev) => [...prev, ...response.items])
            }

            setLastKey(response.lastKey)
        } catch (err) {
            // Handle 403 gracefully - user is not admin
            if (err instanceof Error && err.message.includes("admin")) {
                setError("Solo los administradores pueden ver el historial de cierres")
            } else {
                setError(err instanceof Error ? err.message : "Error al cargar cierres")
            }
        } finally {
            setLoading(false)
        }
    }, [searchDate, lastKey])

    useEffect(() => {
        loadClosures(true)
    }, [searchDate])

    useEffect(() => {
        if (refreshTrigger && refreshTrigger > 0) {
            loadClosures(true)
        }
    }, [refreshTrigger])

    const handleDateFilter = () => {
        loadClosures(true)
    }

    if (error && error.includes("administradores")) {
        return null // Don't show the component at all if user is not admin
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <CardTitle className="flex items-center gap-2 text-xl">
                        <History className="w-5 h-5" />
                        Historial de Cierres
                    </CardTitle>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <Input
                                type="date"
                                value={searchDate}
                                onChange={(e) => setSearchDate(e.target.value)}
                                className="flex-1 sm:w-40"
                            />
                        </div>
                        <Button onClick={handleDateFilter} size="sm" disabled={loading}>
                            Filtrar
                        </Button>
                    </div>
                </div>
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
                                                    : closure.difference > 0
                                                        ? "secondary"
                                                        : "destructive"
                                            }
                                        >
                                            {closure.difference === 0
                                                ? "Cuadrado"
                                                : closure.difference > 0
                                                    ? "Sobrante"
                                                    : "Faltante"}
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <p className="text-gray-500">Efectivo Sistema</p>
                                            <p className="font-medium">{formatCurrency(closure.systemTotalCash)}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Efectivo Declarado</p>
                                            <p className="font-medium">{formatCurrency(closure.declaredCash)}</p>
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
                                                    : closure.difference > 0
                                                        ? "text-blue-600"
                                                        : "text-red-600"
                                                    }`}
                                            >
                                                {formatCurrency(closure.difference)}
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
                                        <th className="pb-2 pr-4">Hora</th>
                                        <th className="pb-2 px-4">Efectivo Sistema</th>
                                        <th className="pb-2 px-4">Tarjeta</th>
                                        <th className="pb-2 px-4">Transferencia</th>
                                        <th className="pb-2 px-4">Declarado</th>
                                        <th className="pb-2 px-4">Gastos</th>
                                        <th className="pb-2 px-4">Fondo</th>
                                        <th className="pb-2 px-4">Diferencia</th>
                                        <th className="pb-2 px-4">Estado</th>
                                        <th className="pb-2 pl-4">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {closures.map((closure) => (
                                        <tr key={closure.closureId} className="border-b hover:bg-gray-50">
                                            <td className="py-3 pr-4">
                                                {format(new Date(closure.closedAt), "HH:mm", { locale: es })}
                                            </td>
                                            <td className="py-3 px-4 tabular-nums">
                                                {formatCurrency(closure.systemTotalCash)}
                                            </td>
                                            <td className="py-3 px-4 tabular-nums">
                                                {formatCurrency(closure.systemTotalCard)}
                                            </td>
                                            <td className="py-3 px-4 tabular-nums">
                                                {formatCurrency(closure.systemTotalTransfer)}
                                            </td>
                                            <td className="py-3 px-4 tabular-nums">
                                                {formatCurrency(closure.declaredCash)}
                                            </td>
                                            <td className="py-3 px-4 tabular-nums">
                                                {formatCurrency(closure.expenses)}
                                            </td>
                                            <td className="py-3 px-4 tabular-nums">
                                                {formatCurrency(closure.initialFund)}
                                            </td>
                                            <td
                                                className={`py-3 px-4 tabular-nums font-medium ${closure.difference === 0
                                                    ? "text-emerald-600"
                                                    : closure.difference > 0
                                                        ? "text-blue-600"
                                                        : "text-red-600"
                                                    }`}
                                            >
                                                {formatCurrency(closure.difference)}
                                            </td>
                                            <td className="py-3 pl-4">
                                                <Badge
                                                    variant={
                                                        closure.difference === 0
                                                            ? "default"
                                                            : closure.difference > 0
                                                                ? "secondary"
                                                                : "destructive"
                                                    }
                                                    className="whitespace-nowrap"
                                                >
                                                    {closure.difference === 0
                                                        ? "Cuadrado"
                                                        : closure.difference > 0
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
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {lastKey && (
                            <div className="text-center pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => loadClosures(false)}
                                    disabled={loading}
                                >
                                    {loading ? "Cargando..." : "Cargar más"}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
