"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Eye, ClipboardList, CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { DateRange } from "react-day-picker"
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
import { format, subDays, startOfMonth } from "date-fns"
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
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
    const [isInitialized, setIsInitialized] = useState(false)

    // Date range state (applied)
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")

    // Temp date range for the calendar picker (before applying)
    const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(undefined)
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const [pageKeys, setPageKeys] = useState<Record<number, string | undefined>>({ 1: undefined })
    const [hasNextPage, setHasNextPage] = useState(false)

    const isAdmin = user?.role === "admin"

    // Helper: get today as DateRange
    const getTodayRange = (): { start: string; end: string; dateRange: DateRange } => {
        const today = new Date()
        const todayStr = today.toISOString().split("T")[0]
        return {
            start: todayStr,
            end: todayStr,
            dateRange: { from: today, to: today },
        }
    }

    // Helper: determine if any filter is active (differs from default "today" view)
    const hasActiveFilters = useMemo(() => {
        const { start: todayStr } = getTodayRange()
        if (startDate && startDate !== todayStr) return true
        if (endDate && endDate !== todayStr) return true
        return false
    }, [startDate, endDate])

    const buildQueryParams = useCallback(() => {
        const params: any = {}
        if (startDate) params.start = startDate
        if (endDate) params.end = endDate
        return params
    }, [startDate, endDate])

    const loadPage = useCallback(async (page: number, cursorKey?: string) => {
        try {
            setLoading(true)
            const params = {
                ...buildQueryParams(),
                lastKey: cursorKey,
            }
            const response: AuditLogListResponse = await apiClient.listAuditLogs(params)

            setLogs(response.items)
            setCurrentPage(page)

            if (response.lastKey) {
                setHasNextPage(true)
                setPageKeys((prev) => ({ ...prev, [page + 1]: response.lastKey }))
            } else {
                setHasNextPage(false)
            }
        } catch (error) {
            console.error("Error loading audit logs:", error)
        } finally {
            setLoading(false)
        }
    }, [buildQueryParams])

    // Helper: apply a date range, update state, and load logs
    const applyDateRange = useCallback((newStart: string, newEnd: string, dateRange: DateRange) => {
        setStartDate(newStart)
        setEndDate(newEnd)
        setTempDateRange(dateRange)
        setIsCalendarOpen(false)
        setCurrentPage(1)
        setPageKeys({ 1: undefined })
        setHasNextPage(false)
        setLoading(true)
        apiClient.listAuditLogs({ start: newStart, end: newEnd }).then((response: AuditLogListResponse) => {
            setLogs(response.items)
            if (response.lastKey) {
                setHasNextPage(true)
                setPageKeys({ 1: undefined, 2: response.lastKey })
            }
        }).catch((error) => {
            console.error("Error loading audit logs:", error)
        }).finally(() => {
            setLoading(false)
        })
    }, [])

    // Date preset handlers
    const handlePresetToday = () => {
        const today = new Date()
        const todayStr = today.toISOString().split("T")[0]
        applyDateRange(todayStr, todayStr, { from: today, to: today })
    }

    const handlePresetLast7Days = () => {
        const today = new Date()
        const from = subDays(today, 6)
        applyDateRange(
            from.toISOString().split("T")[0],
            today.toISOString().split("T")[0],
            { from, to: today }
        )
    }

    const handlePresetThisMonth = () => {
        const today = new Date()
        const from = startOfMonth(today)
        applyDateRange(
            from.toISOString().split("T")[0],
            today.toISOString().split("T")[0],
            { from, to: today }
        )
    }

    // Set initial date on client side only to avoid hydration mismatch
    useEffect(() => {
        if (!isInitialized) {
            const { start, end, dateRange } = getTodayRange()
            setStartDate(start)
            setEndDate(end)
            setTempDateRange(dateRange)
            setIsInitialized(true)
        }
    }, [isInitialized])

    useEffect(() => {
        if (isInitialized && isAdmin && logs.length === 0) {
            loadPage(1, undefined)
        }
    }, [isInitialized, isAdmin])

    const handleClearFilters = () => {
        const { start, end, dateRange } = getTodayRange()
        applyDateRange(start, end, dateRange)
    }

    const handleNextPage = () => {
        const nextPage = currentPage + 1
        const nextKey = pageKeys[nextPage]
        loadPage(nextPage, nextKey)
    }

    const handlePrevPage = () => {
        if (currentPage <= 1) return
        const prevPage = currentPage - 1
        const prevKey = pageKeys[prevPage]
        loadPage(prevPage, prevKey)
    }

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
                    <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 mb-4">
                            <ClipboardList className="w-5 h-5" />
                            Registros de Auditoría
                        </CardTitle>

                        {/* ═══ Toolbar de Filtros ═══ */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            {/* Date Range Picker */}
                            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="justify-start text-left font-normal gap-2 bg-white border shadow-sm hover:bg-gray-50 w-full sm:w-auto"
                                    >
                                        <CalendarIcon className="h-4 w-4 text-indigo-500" />
                                        <span className="text-sm truncate">
                                            {tempDateRange?.from ? (
                                                tempDateRange.to ? (
                                                    <>
                                                        {format(tempDateRange.from, "dd MMM yyyy", { locale: es })} —{" "}
                                                        {format(tempDateRange.to, "dd MMM yyyy", { locale: es })}
                                                    </>
                                                ) : (
                                                    format(tempDateRange.from, "dd MMM yyyy", { locale: es })
                                                )
                                            ) : (
                                                "Seleccionar fechas"
                                            )}
                                        </span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    {/* Presets de fecha */}
                                    <div className="flex flex-wrap gap-1.5 p-3 border-b">
                                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={handlePresetToday}>
                                            Hoy
                                        </Button>
                                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={handlePresetLast7Days}>
                                            Últimos 7 días
                                        </Button>
                                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={handlePresetThisMonth}>
                                            Este mes
                                        </Button>
                                    </div>
                                    <Calendar
                                        mode="range"
                                        defaultMonth={tempDateRange?.from}
                                        selected={tempDateRange}
                                        onSelect={(newRange, selectedDay) => {
                                            if (tempDateRange?.from && tempDateRange?.to && selectedDay) {
                                                setTempDateRange({ from: selectedDay, to: undefined });
                                            } else {
                                                setTempDateRange(newRange);
                                            }
                                        }}
                                        numberOfMonths={1}
                                        locale={es}
                                    />
                                    <div className="flex items-center justify-end gap-2 p-3 border-t">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsCalendarOpen(false)}
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                if (tempDateRange?.from && tempDateRange?.to) {
                                                    const newStart = tempDateRange.from.toISOString().split("T")[0]
                                                    const newEnd = tempDateRange.to.toISOString().split("T")[0]
                                                    applyDateRange(newStart, newEnd, tempDateRange)
                                                }
                                            }}
                                            disabled={!tempDateRange?.from || !tempDateRange?.to}
                                            className="bg-indigo-600 hover:bg-indigo-700"
                                        >
                                            Aplicar
                                        </Button>
                                    </div>
                                </PopoverContent>
                            </Popover>

                            {/* Limpiar Filtros */}
                            {hasActiveFilters && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClearFilters}
                                    className="text-gray-500 hover:text-gray-700 w-full sm:w-auto"
                                >
                                    <X className="w-4 h-4 mr-1.5" />
                                    Limpiar filtros
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {!loading && logs.length === 0 ? (
                            <div className="text-center py-12">
                                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500">No hay registros de auditoría para el rango seleccionado.</p>
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

                                {/* Paginación */}
                                {logs.length > 0 && (
                                    <div className="flex items-center justify-end gap-4 pt-6 border-t">
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
