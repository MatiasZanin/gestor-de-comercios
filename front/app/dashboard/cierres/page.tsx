"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { CalendarIcon, X, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { DateRange } from "react-day-picker"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { CloseRegisterForm } from "@/components/closings/close-register-form"
import { ClosureHistoryTable } from "@/components/closings/closure-history-table"
import { ExportCSVModal, escapeCSVValue, downloadCSV } from "@/components/shared/export-csv-modal"
import { useAuth } from "@/lib/hooks/use-auth"
import { apiClient } from "@/lib/api/client"
import { format, startOfMonth, subDays } from "date-fns"
import { es } from "date-fns/locale"

export default function ClosuresPage() {
    const { user } = useAuth()
    const [refreshTrigger, setRefreshTrigger] = useState(0)
    const [isInitialized, setIsInitialized] = useState(false)
    const [showExportModal, setShowExportModal] = useState(false)

    // Date range state (applied)
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")

    // Temp date range for the calendar picker (before applying)
    const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(undefined)
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)

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

    // Helper: apply a date range
    const applyDateRange = useCallback((newStart: string, newEnd: string, dateRange: DateRange) => {
        setStartDate(newStart)
        setEndDate(newEnd)
        setTempDateRange(dateRange)
        setIsCalendarOpen(false)
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

    const handleClearFilters = () => {
        const { start, end, dateRange } = getTodayRange()
        applyDateRange(start, end, dateRange)
    }

    const handleClosureSuccess = () => {
        // Trigger refresh of history table
        setRefreshTrigger((prev) => prev + 1)
    }

    // ═══ Export CSV ═══
    const csvHeaders: string[] = [
        "ID Cierre", "Fondo Inicial", "Abierto", "Cerrado",
        "Total Transferencia (Sistema)", "Total Efectivo (Sistema)", "Efectivo Declarado",
        "Gastos", "Usuario", "Notas", "Total Tarjeta (Sistema)",
        "Diferencia", "Total Otros (Sistema)",
    ]

    const activeFilters = useMemo(() => {
        const filters: { label: string; value: string }[] = []
        if (startDate && endDate) {
            if (startDate === endDate) {
                filters.push({ label: "Fecha", value: startDate })
            } else {
                filters.push({ label: "Desde", value: startDate })
                filters.push({ label: "Hasta", value: endDate })
            }
        }
        return filters
    }, [startDate, endDate])

    const handleExportClosures = async (selectedColumnIndices: number[]) => {
        const params: { day?: string; start?: string; end?: string } = {}
        if (startDate && endDate && startDate === endDate) {
            params.day = startDate
        } else {
            if (startDate) params.start = startDate
            if (endDate) params.end = endDate
        }

        const response = await apiClient.exportClosures(params)
        const allClosures = response.items

        const allRows: any[][] = allClosures.map((c) => [
            c.closureId ?? "",
            c.initialFund ?? 0,
            c.closedAt ? new Date(c.closedAt).toLocaleString("es-AR") : "",
            c.openedAt ? new Date(c.openedAt).toLocaleString("es-AR") : "",
            c.systemTotalTransfer ?? 0,
            c.systemTotalCash ?? 0,
            c.declaredCash ?? 0,
            c.expenses ?? 0,
            c.userId ?? "",
            c.notes ?? "",
            c.systemTotalCard ?? 0,
            c.difference ?? 0,
            c.systemTotalOther ?? 0,
        ])

        const filteredHeaders = selectedColumnIndices.map((i) => csvHeaders[i])
        const filteredRows = allRows.map((r) => selectedColumnIndices.map((i) => r[i]))

        const csvContent = [
            filteredHeaders.map(escapeCSVValue).join(","),
            ...filteredRows.map((r) => r.map(escapeCSVValue).join(",")),
        ].join("\n")

        downloadCSV(csvContent, "cierres")
        setShowExportModal(false)
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                        Cierre de Caja
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600">
                        Registra el cierre de caja y consulta el historial
                    </p>
                </div>

                <CloseRegisterForm onSuccess={handleClosureSuccess} />

                {isAdmin && (
                    <>
                        {/* ═══ Toolbar de Filtros ═══ */}
                        <div className="flex flex-col justify-end sm:flex-row items-stretch sm:items-center gap-3">
                            {/* Date Range Picker */}
                            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="justify-start text-left font-normal gap-2 bg-white border shadow-sm hover:bg-gray-50 w-full sm:w-auto"
                                    >
                                        <CalendarIcon className="h-4 w-4 text-orange-500" />
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
                                            className="bg-orange-600 hover:bg-orange-700"
                                        >
                                            Aplicar
                                        </Button>
                                    </div>
                                </PopoverContent>
                            </Popover>

                            {/* Botón Exportar */}
                            <Button
                                variant="outline"
                                onClick={() => setShowExportModal(true)}
                                className="border-emerald-300 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 hover:border-emerald-400 rounded-lg cursor-pointer transition-transform transform hover:scale-105 w-full sm:w-auto"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Exportar
                            </Button>

                            {/* Limpiar Filtros — visible siempre que haya un filtro activo */}
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

                        <ClosureHistoryTable
                            refreshTrigger={refreshTrigger}
                            startDate={startDate}
                            endDate={endDate}
                        />
                    </>
                )}

                {/* --- Modal de confirmación de exportación --- */}
                <ExportCSVModal
                    title="Exportar Cierres de Caja"
                    description="Se exportarán los cierres de caja filtrados a un archivo CSV."
                    filenamePrefix="cierres"
                    headers={csvHeaders}
                    rows={[]}
                    filters={activeFilters}
                    itemCount={0}
                    itemLabel="cierres"
                    open={showExportModal}
                    onOpenChange={setShowExportModal}
                    onExport={handleExportClosures}
                />
            </div>
        </DashboardLayout>
    )
}
