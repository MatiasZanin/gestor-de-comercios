"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Plus, Receipt, CalendarIcon, Search, ChevronLeft, ChevronRight, X, Tag, RotateCcw, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { DateRange } from "react-day-picker"

// Componente para celdas truncadas con tooltip
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/hooks/use-auth"
import { apiClient } from "@/lib/api/client"
import type { Sale, SaleListResponse } from "@/lib/types/api"
import { PAYMENT_METHOD_LABELS } from "@/lib/types/api"
import { SaleForm } from "@/components/sales/sale-form"
import { ReturnTicketModal } from "@/components/sales/return-ticket-modal"
import { format, startOfMonth, subDays } from "date-fns"
import { es } from "date-fns/locale"
import { DashboardLayout } from "../../../components/dashboard/dashboard-layout"
import { ExportCSVModal, escapeCSVValue, downloadCSV } from "@/components/shared/export-csv-modal"

export default function SalesPage() {
  const { user } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [isFiltering, setIsFiltering] = useState(false)
  const [searchSaleId, setSearchSaleId] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnItems, setReturnItems] = useState<import("@/lib/types/api").SaleItem[] | undefined>(undefined)
  const [isInitialized, setIsInitialized] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)

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

  const isVendedor = user?.role === "vendedor"


  // Helper: get today as DateRange
  const getTodayRange = (): { start: string; end: string; dateRange: DateRange } => {
    const today = new Date();

    // Extracción de valores locales (getMonth devuelve 0-11, por lo que sumamos 1)
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    // Construcción del string garantizando la zona horaria correcta
    const todayStr = `${year}-${month}-${day}`;

    console.log("Hora local exacta:", today);
    console.log("String formateado local:", todayStr);

    return {
      start: todayStr,
      end: todayStr,
      dateRange: { from: today, to: today },
    };
  };

  // Helper: determine if any filter is active (differs from default "today" view)
  const hasActiveFilters = useMemo(() => {
    if (searchSaleId.trim()) return true
    const { start: todayStr } = getTodayRange()
    if (startDate && startDate !== todayStr) return true
    if (endDate && endDate !== todayStr) return true
    return false
  }, [searchSaleId, startDate, endDate])

  // Helper: apply a date range, update state, and load sales
  const applyDateRange = useCallback((newStart: string, newEnd: string, dateRange: DateRange) => {
    setStartDate(newStart)
    setEndDate(newEnd)
    setTempDateRange(dateRange)
    setSearchSaleId("")
    setIsCalendarOpen(false)
    setCurrentPage(1)
    setPageKeys({ 1: undefined })
    setHasNextPage(false)
    setLoading(true)
    setSales([])
    const params: Record<string, string> = newStart === newEnd
      ? { day: newStart }
      : { start: newStart, end: newEnd }
    apiClient.listSales(params).then((response: SaleListResponse) => {
      setSales(response.items)
      if (response.lastKey) {
        setHasNextPage(true)
        setPageKeys({ 1: undefined, 2: response.lastKey })
      }
    }).catch((error) => {
      console.error("Error loading sales:", error)
    }).finally(() => {
      setLoading(false)
      setIsFiltering(false)
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

  const buildQueryParams = useCallback(() => {
    if (searchSaleId.trim()) {
      return { saleId: searchSaleId.trim() }
    }
    const params: any = {}
    if (startDate && endDate && startDate === endDate) {
      // Si ambas fechas son iguales, usar el filtro por día (GSI)
      params.day = startDate
    } else {
      if (startDate) params.start = startDate
      if (endDate) params.end = endDate
    }
    return params
  }, [searchSaleId, startDate, endDate])

  const loadPage = useCallback(async (page: number, cursorKey?: string) => {
    try {
      console.log("loadPage")
      setLoading(true)
      setSales([])
      const params = {
        ...buildQueryParams(),
        lastKey: cursorKey,
      }
      const response: SaleListResponse = await apiClient.listSales(params)

      setSales(response.items)
      setCurrentPage(page)

      if (response.lastKey) {
        setHasNextPage(true)
        setPageKeys((prev) => ({ ...prev, [page + 1]: response.lastKey }))
      } else {
        setHasNextPage(false)
      }
    } catch (error) {
      console.error("Error loading sales:", error)
    } finally {
      setLoading(false)
      setIsFiltering(false)
    }
  }, [buildQueryParams])

  useEffect(() => {
    if (isInitialized && sales.length === 0) {
      loadPage(1, undefined)
    }
  }, [isInitialized])

  const handleFilter = () => {
    setIsFiltering(true)
    setCurrentPage(1)
    setPageKeys({ 1: undefined })
    setHasNextPage(false)
    loadPage(1, undefined)
  }

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

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleFilter()
    }
  }

  const handleCreateSale = () => {
    setShowForm(true)
  }

  const handleFormSuccess = (newSale: Sale) => {
    // Auto-append only if we're viewing today's sales on page 1
    const today = new Date().toISOString().split("T")[0]
    if (currentPage === 1 && (!startDate || startDate === today)) {
      setSales((prev) => [newSale, ...prev])
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(amount)
  }

  const csvHeaders: string[] = [
    "N° Venta", "Fecha", "Método Pago", "Producto", "Código", "Marca",
    "Categoría", "Cantidad", "Unidad", "Precio Compra", "Precio Venta", "Subtotal", "Total Venta", "Ganancia", "Notas"
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
    if (searchSaleId.trim()) filters.push({ label: "N° Venta", value: searchSaleId.trim() })
    return filters
  }, [startDate, endDate, searchSaleId])

  const handleExportSales = async (selectedColumnIndices: number[]) => {
    const params: { day?: string; start?: string; end?: string } = {}
    if (startDate && endDate && startDate === endDate) {
      params.day = startDate
    } else {
      if (startDate) params.start = startDate
      if (endDate) params.end = endDate
    }

    const response = await apiClient.exportSales(params)
    const allSales = response.items

    // Una fila por item de cada venta
    const allRows: any[][] = []
    for (const sale of allSales) {
      for (const item of sale.items) {
        allRows.push([
          sale.saleId?.slice(-8) ?? "",
          sale.createdAt ? new Date(sale.createdAt).toLocaleString("es-AR") : "",
          sale.paymentMethod ? (PAYMENT_METHOD_LABELS[sale.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? sale.paymentMethod) : "",
          item.name ?? "",
          item.code ?? "",
          item.brand ?? "",
          item.category ?? "",
          item.qty ?? 0,
          item.uom ?? "",
          item.priceBuy ?? 0,
          item.priceSale ?? 0,
          (item.qty ?? 0) * (item.priceSale ?? 0),
          sale.total ?? 0,
          sale.profit,
          sale.notes ?? "",
        ])
      }
    }

    const filteredHeaders = selectedColumnIndices.map((i) => csvHeaders[i])
    const filteredRows = allRows.map((r) => selectedColumnIndices.map((i) => r[i]))

    const csvContent = [
      filteredHeaders.map(escapeCSVValue).join(","),
      ...filteredRows.map((r) => r.map(escapeCSVValue).join(",")),
    ].join("\n")

    downloadCSV(csvContent, "ventas")
    setShowExportModal(false)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Ventas</h1>
            <p className="text-sm sm:text-base text-gray-600">Registra y gestiona las ventas</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {!isVendedor && (
              <Button

                variant="outline"
                onClick={() => setShowExportModal(true)}
                disabled={sales.length === 0}
                className="border-emerald-300 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 hover:border-emerald-400 text-base sm:text-lg px-4 py-4 sm:px-6 sm:py-6 rounded-lg cursor-pointer transition-transform transform hover:scale-105 w-full sm:w-auto"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            )}
            <Button
              onClick={() => setShowReturnModal(true)}
              variant="outline"
              className="-3border-red00 text-red-600 hover:bg-red-50 hover:text-red-700 text-base sm:text-lg px-4 py-4 sm:px-6 sm:py-6 rounded-lg cursor-pointer transition-transform transform hover:scale-105 w-full sm:w-auto"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Devolución
            </Button>
            <Button
              onClick={handleCreateSale}
              className="bg-orange-600 hover:bg-orange-700 text-base sm:text-lg px-4 py-4 sm:px-6 sm:py-6 rounded-lg cursor-pointer transition-transform transform hover:scale-105 w-full sm:w-auto"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nueva Venta
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 mb-4">
              <Receipt className="w-5 h-5" />
              Lista de Ventas
            </CardTitle>

            {/* ═══ Toolbar de Filtros ═══ */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Buscador por ID */}
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar por N° de venta..."
                  value={searchSaleId}
                  onChange={(e) => setSearchSaleId(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="pl-9"
                />
              </div>

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

              {/* Botón Buscar */}
              <Button
                onClick={handleFilter}
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 w-full sm:w-auto"
              >
                <Search className="w-4 h-4 mr-1.5" />
                Buscar
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
          </CardHeader>
          <CardContent>
            {!loading || (loading && sales.length > 0) ? (
              <div className="space-y-4">
                {sales.length === 0 && !loading ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No se encontraron ventas.</p>
                  </div>
                ) : (
                  sales.map((sale) => (
                    <div key={sale.saleId} className="p-3 sm:p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Venta #{sale.saleId.slice(-8)}</h3>
                          <Badge variant="outline" className="w-fit text-xs">
                            {format(new Date(sale.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                          </Badge>
                          {sale.paymentMethod && (
                            <Badge variant="secondary" className="w-fit text-xs">
                              {PAYMENT_METHOD_LABELS[sale.paymentMethod]}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Vista mobile - Cards */}
                      <div className="sm:hidden space-y-3">
                        {sale.items.map((item, index) => {
                          const isReturn = item.qty < 0
                          return (
                            <div key={index} className={`p-3 rounded-lg space-y-1.5 ${isReturn ? "bg-red-50 border border-red-200" : "bg-gray-50"}`}>
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                  <div className={`font-medium text-sm ${isReturn ? "text-red-600" : "text-gray-900"}`}>{item.name}</div>
                                  {isReturn && (
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-red-500 bg-red-100 px-1.5 py-0.5 rounded shrink-0">
                                      Devolución
                                    </span>
                                  )}
                                </div>
                                <div className={`font-bold text-sm tabular-nums ${isReturn ? "text-red-600" : "text-gray-900"}`}>
                                  {formatCurrency(item.qty * item.priceSale)}
                                </div>
                              </div>
                              <div className="text-xs text-gray-600 space-y-0.5">
                                <div className="flex items-center gap-1">
                                  Código: {item.code}
                                  {item.discountApplied && item.discountApplied > 0 && (
                                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded flex items-center gap-0.5">
                                      <Tag className="w-2.5 h-2.5" />
                                      {item.offerName || 'Oferta'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex justify-between">
                                  <span>Cantidad: {Math.abs(item.qty)} {item.uom}</span>
                                  <span>
                                    {item.discountApplied && item.discountApplied > 0 && item.originalPrice ? (
                                      <>
                                        <span className="line-through text-gray-400 mr-1">{formatCurrency(item.originalPrice)}</span>
                                        {formatCurrency(item.priceSale)}
                                      </>
                                    ) : (
                                      <>Precio: {formatCurrency(item.priceSale)}</>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        <div className="border-t-2 pt-3 mt-3">
                          <div className="flex justify-between items-center">
                            <span className="text-base font-bold text-gray-900">Total</span>
                            <div className="text-right">
                              <div className="text-base font-bold text-gray-900">{formatCurrency(sale.total)}</div>
                              {sale.profit !== null && sale.profit !== undefined && (
                                <div className="text-xs text-emerald-600">
                                  Ganancia: {formatCurrency(sale.profit)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Vista desktop - Tabla */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm text-gray-700 table-fixed min-w-0">
                          <thead>
                            <tr className="text-left">
                              <th className="pr-3 py-1 w-[18%]">Nombre</th>
                              <th className="px-3 py-1 w-[15%]">Código</th>
                              <th className="px-3 py-1 w-[12%]">Marca</th>
                              <th className="px-3 py-1 w-[12%]">Categoría</th>
                              <th className="px-3 py-1 w-[12%] text-left">Cantidad</th>
                              <th className="px-3 py-1 w-[14%] text-left">Precio</th>
                              <th className="px-3 py-1 w-[14%] text-left">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sale.items.map((item, index) => {
                              const isReturn = item.qty < 0
                              return (
                                <tr key={index} className={isReturn ? "bg-red-50" : "hover:bg-gray-50"}>
                                  <td className="pr-3 py-1">
                                    <div className="flex items-center gap-1.5">
                                      <TruncatedCell className={isReturn ? "text-red-600" : ""}>{item.name}</TruncatedCell>
                                      {isReturn && (
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-red-500 bg-red-100 px-1 py-0.5 rounded shrink-0">
                                          Dev.
                                        </span>
                                      )}
                                      {item.discountApplied && item.discountApplied > 0 && (
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded shrink-0 flex items-center gap-0.5">
                                          <Tag className="w-2.5 h-2.5" />
                                          {item.offerName || 'Dto'}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-1">
                                    <TruncatedCell>{item.code}</TruncatedCell>
                                  </td>
                                  <td className="px-3 py-1">
                                    <TruncatedCell>{item.brand}</TruncatedCell>
                                  </td>
                                  <td className="px-3 py-1">
                                    <TruncatedCell>{item.category}</TruncatedCell>
                                  </td>
                                  <td className={`px-3 py-1 whitespace-nowrap text-left tabular-nums ${isReturn ? "text-red-600" : ""}`}>{Math.abs(item.qty)} {item.uom}</td>
                                  <td className="px-3 py-1 whitespace-nowrap text-left tabular-nums">
                                    {item.discountApplied && item.discountApplied > 0 && item.originalPrice ? (
                                      <>
                                        <span className="line-through text-gray-400 mr-1">{formatCurrency(item.originalPrice)}</span>
                                        <span className="text-emerald-700">{formatCurrency(item.priceSale)}</span>
                                      </>
                                    ) : (
                                      formatCurrency(item.priceSale)
                                    )}
                                  </td>
                                  <td className={`px-3 py-1 whitespace-nowrap text-left tabular-nums font-medium ${isReturn ? "text-red-600" : ""}`}>
                                    {formatCurrency(item.qty * item.priceSale)}
                                  </td>
                                </tr>
                              )
                            })}
                            {/* Fila de Total Principal */}
                            <tr className="border-t-2 border-gray-100">
                              <td colSpan={6} className="pt-4 pb-1 text-right font-bold text-gray-900">Total:</td>
                              <td className="pt-4 pb-1 px-3 text-left text-lg font-bold text-gray-900 tabular-nums">
                                {formatCurrency(sale.total)}
                              </td>
                            </tr>

                            {/* Fila de Ganancias (Independiente) */}
                            {sale.profit !== null && sale.profit !== undefined && (
                              <tr>
                                <td colSpan={6} className="pb-1 text-right font-bold text-gray-900">Ganancia:</td>
                                <td className="pb-1 px-3 text-left text-l font-bold tabular-nums text-emerald-600">
                                  {formatCurrency(sale.profit)}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {sale.notes && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs sm:text-sm text-gray-600">
                            <strong>Notas:</strong> {sale.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}

                {/* Paginación */}
                {sales.length > 0 && (
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
            ) : (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Cargando ventas...</p>
              </div>
            )}
          </CardContent>
        </Card>
        {showForm && (
          <SaleForm
            onSuccess={handleFormSuccess}
            onCancel={() => { setShowForm(false); setReturnItems(undefined) }}
            initialItems={returnItems}
          />
        )}
        {showReturnModal && (
          <ReturnTicketModal
            onClose={() => setShowReturnModal(false)}
            onGenerateReturn={(sale) => {
              // Convert sale items to return items (negative qty)
              const items = sale.items
                .filter((item) => item.qty > 0) // Only return positive-qty items
                .map((item) => ({
                  ...item,
                  code: `${item.code}__RET`, // Suffix to avoid key collision with catalog products
                  qty: -Math.abs(item.qty), // Make qty negative for return
                }))
              setReturnItems(items)
              setShowReturnModal(false)
              setShowForm(true)
            }}
          />
        )}

        {/* --- Modal de confirmación de exportación --- */}
        <ExportCSVModal
          title="Exportar Ventas"
          description="Se exportarán las ventas filtradas a un archivo CSV."
          filenamePrefix="ventas"
          headers={csvHeaders}
          rows={[]}
          filters={activeFilters}
          itemCount={0} // no mostrar
          itemLabel="ventas"
          open={showExportModal}
          onOpenChange={setShowExportModal}
          onExport={handleExportSales}
        />
      </div>
    </DashboardLayout>
  )
}
