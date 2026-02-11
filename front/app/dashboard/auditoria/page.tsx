"use client"

import { useState, useEffect } from "react"
import { Eye, ClipboardList, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { useAuth } from "@/lib/hooks/use-auth"
import { apiClient } from "@/lib/api/client"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { AuditLog, AuditLogListResponse, AuditAction } from "@/lib/types/api"
import { ACTION_LABELS, DETAIL_FIELD_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/types/api"
import type { PaymentMethod } from "@/lib/types/api"

const ACTION_COLORS: Record<AuditAction, string> = {
    PRODUCT_CREATE: "bg-emerald-100 text-emerald-800 border-emerald-200",
    PRODUCT_UPDATE: "bg-blue-100 text-blue-800 border-blue-200",
    SALE_CREATE: "bg-amber-100 text-amber-800 border-amber-200",
    REGISTER_CLOSE: "bg-purple-100 text-purple-800 border-purple-200",
}

function formatDetailValue(key: string, value: any): string {
    if (value === null || value === undefined) return "—"
    if (typeof value === "boolean") return value ? "Sí" : "No"

    if (key === "paymentMethod" && typeof value === "string") {
        return PAYMENT_METHOD_LABELS[value as PaymentMethod] ?? value
    }

    if (
        (key === "total" || key === "declaredCash" || key === "difference" ||
            key === "priceBuy" || key === "priceSale") &&
        typeof value === "number"
    ) {
        return new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
        }).format(value)
    }

    if (key === "saleId" && typeof value === "string") {
        return `#${value.slice(-8)}`
    }

    return String(value)
}

export default function AuditPage() {
    const { user } = useAuth()
    const [logs, setLogs] = useState<AuditLog[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [lastKey, setLastKey] = useState<string | undefined>()
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

    const isAdmin = user?.role === "admin"

    const loadLogs = async (reset = false) => {
        try {
            if (reset) setLoading(true)
            else setLoadingMore(true)

            const response: AuditLogListResponse = await apiClient.listAuditLogs({
                lastKey: reset ? undefined : lastKey,
            })

            if (reset) {
                setLogs(response.items)
            } else {
                setLogs((prev) => [...prev, ...response.items])
            }
            setLastKey(response.lastKey)
        } catch (error) {
            console.error("Error loading audit logs:", error)
        } finally {
            setLoading(false)
            setLoadingMore(false)
        }
    }

    useEffect(() => {
        if (isAdmin) {
            loadLogs(true)
        }
    }, [isAdmin])

    if (!isAdmin) {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center py-20">
                    <ClipboardList className="w-16 h-16 text-gray-300 mb-4" />
                    <h2 className="text-xl font-semibold text-gray-600">Acceso restringido</h2>
                    <p className="text-gray-400 mt-2">Solo los administradores pueden ver los registros de auditoría.</p>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            {loading && (
                <div className="fixed inset-0 bg-white/50 flex items-center justify-center z-50">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            )}
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Auditoría</h1>
                    <p className="text-sm sm:text-base text-gray-600">
                        Registro de actividades del sistema
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ClipboardList className="w-5 h-5" />
                            Registros de Auditoría
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!loading && logs.length === 0 ? (
                            <div className="text-center py-12">
                                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">No hay registros de auditoría aún.</p>
                            </div>
                        ) : (
                            <div className="space-y-0">
                                {/* Desktop table */}
                                <div className="hidden sm:block overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-left text-gray-500">
                                                <th className="pb-3 pr-4 font-medium">Fecha</th>
                                                <th className="pb-3 px-4 font-medium">Acción</th>
                                                <th className="pb-3 px-4 font-medium">Usuario</th>
                                                <th className="pb-3 pl-4 font-medium text-right">Detalles</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {logs.map((log, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                    <td className="py-3 pr-4 whitespace-nowrap text-gray-700">
                                                        {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: es })}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <Badge
                                                            variant="outline"
                                                            className={`${ACTION_COLORS[log.action]} text-xs font-medium`}
                                                        >
                                                            {ACTION_LABELS[log.action]}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-4 text-gray-600 text-xs">
                                                        {log.userEmail || log.userId.slice(0, 8) + "…"}
                                                    </td>
                                                    <td className="py-3 pl-4 text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setSelectedLog(log)}
                                                            className="hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile cards */}
                                <div className="sm:hidden space-y-3">
                                    {logs.map((log, idx) => (
                                        <div
                                            key={idx}
                                            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <Badge
                                                    variant="outline"
                                                    className={`${ACTION_COLORS[log.action]} text-xs font-medium`}
                                                >
                                                    {ACTION_LABELS[log.action]}
                                                </Badge>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSelectedLog(log)}
                                                    className="hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: es })}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1">
                                                {log.userEmail || log.userId.slice(0, 8) + "…"}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {lastKey && (
                                    <div className="text-center pt-6">
                                        <Button
                                            variant="outline"
                                            onClick={() => loadLogs(false)}
                                            disabled={loadingMore}
                                            className="w-full sm:w-auto"
                                        >
                                            {loadingMore ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Cargando...
                                                </>
                                            ) : (
                                                "Cargar más"
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Detail Modal */}
            <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ClipboardList className="w-5 h-5" />
                            Detalle de Auditoría
                        </DialogTitle>
                        {selectedLog && (
                            <DialogDescription>
                                {format(new Date(selectedLog.createdAt), "dd 'de' MMMM 'de' yyyy, HH:mm:ss", {
                                    locale: es,
                                })}
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    {selectedLog && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Badge
                                    variant="outline"
                                    className={`${ACTION_COLORS[selectedLog.action]} text-sm font-medium`}
                                >
                                    {ACTION_LABELS[selectedLog.action]}
                                </Badge>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                <h4 className="text-sm font-semibold text-gray-700">Información</h4>
                                <div className="grid grid-cols-1 gap-2">
                                    {Object.entries(selectedLog.details).map(([key, value]) => (
                                        <div
                                            key={key}
                                            className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0"
                                        >
                                            <span className="text-sm text-gray-500">
                                                {DETAIL_FIELD_LABELS[key] ?? key}
                                            </span>
                                            <span className="text-sm font-medium text-gray-900 text-right max-w-[60%] truncate">
                                                {formatDetailValue(key, value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="text-xs text-gray-400">
                                Realizado por: <span className="font-medium text-gray-600">{selectedLog.userEmail || selectedLog.userId}</span>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    )
}
