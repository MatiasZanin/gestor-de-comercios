"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { CalendarIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { DateRange } from "react-day-picker"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { CloseRegisterForm } from "@/components/closings/close-register-form"
import { ClosureHistoryTable } from "@/components/closings/closure-history-table"
import { useAuth } from "@/lib/hooks/use-auth"
import { format, startOfMonth, subDays } from "date-fns"
import { es } from "date-fns/locale"

export default function ClosuresPage() {
    const { user } = useAuth()
    const [refreshTrigger, setRefreshTrigger] = useState(0)
    const [isInitialized, setIsInitialized] = useState(false)

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
            </div>
        </DashboardLayout>
    )
}
