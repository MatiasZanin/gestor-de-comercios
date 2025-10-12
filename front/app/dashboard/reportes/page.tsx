"use client"

import { useState, useEffect } from "react"
import { Calendar, TrendingUp, DollarSign, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useAuth } from "@/lib/hooks/use-auth"
import { apiClient } from "@/lib/api/client"
import type { DailyReportResponse, ReportItem } from "@/lib/types/api"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { DashboardLayout } from "../../../components/dashboard/dashboard-layout"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type SortField = "name" | "code" | "revenue" | "profit" | "units"
type SortDirection = "asc" | "desc"

export default function ReportsPage() {
  const { user } = useAuth()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<DailyReportResponse | null>(null)
  const [sortField, setSortField] = useState<SortField>("revenue")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  const isAdmin = user?.["cognito:groups"]?.includes("admin")

  const loadReport = async (date: Date) => {
    try {
      setLoading(true)
      const dayString = format(date, "yyyy-MM-dd")
      const response: DailyReportResponse = await apiClient.getDailyReport({
        day: dayString,
      })
      setReportData(response)
    } catch (error) {
      console.error("Error loading report:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport(selectedDate)
  }, [selectedDate])

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const sortedResults = reportData?.results
    ? [...reportData.results].sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortField) {
        case "name":
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case "code":
          aValue = a.code.toLowerCase()
          bValue = b.code.toLowerCase()
          break
        case "revenue":
          aValue = a.revenue
          bValue = b.revenue
          break
        case "profit":
          aValue = a.profit || 0
          bValue = b.profit || 0
          break
        case "units":
          aValue = a.units
          bValue = b.units
          break
        default:
          aValue = 0
          bValue = 0
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    })
    : []

  const totalRevenue = reportData?.results.reduce((sum, item) => sum + item.revenue, 0) || 0
  const totalProfit = reportData?.results.reduce((sum, item) => sum + (item.profit || 0), 0) || 0

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(amount)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 ml-1 inline" />
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="w-4 h-4 ml-1 inline" />
    ) : (
      <ArrowDown className="w-4 h-4 ml-1 inline" />
    )
  }

  return (
    <DashboardLayout>
      {loading && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      )}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-orange-500 bg-clip-text text-transparent">
              Reportes
            </h1>
            <p className="text-gray-600">Analiza el desempeño de tu comercio</p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[280px] justify-start text-left font-normal border-2",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {selectedDate ? (
                  format(selectedDate, "PPP", { locale: es })
                ) : (
                  <span>Seleccionar fecha</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                initialFocus
                locale={es}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Cards de totales */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-2 border-emerald-100 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Facturado
              </CardTitle>
              <DollarSign className="h-5 w-5" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatCurrency(totalRevenue)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {reportData?.results.length || 0} productos vendidos
              </p>
            </CardContent>
          </Card>

          {isAdmin && (
            <Card className="border-2 border-orange-100 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  Total Ganancia
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-600">
                  {formatCurrency(totalProfit)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Margen: {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tabla de productos */}
        <Card className="border-2 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-gray-900">
              Detalle por Producto
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sortedResults.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">
                  No hay ventas registradas para esta fecha
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead
                        className="cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort("code")}
                      >
                        <div className="flex items-center font-semibold">
                          Código
                          <SortIcon field="code" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center font-semibold">
                          Producto
                          <SortIcon field="name" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-gray-100 transition-colors text-right"
                        onClick={() => handleSort("units")}
                      >
                        <div className="flex items-center justify-end font-semibold">
                          Unidades Vendidas
                          <SortIcon field="units" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-gray-100 transition-colors text-right"
                        onClick={() => handleSort("revenue")}
                      >
                        <div className="flex items-center justify-end font-semibold">
                          Facturado
                          <SortIcon field="revenue" />
                        </div>
                      </TableHead>
                      {isAdmin && (
                        <TableHead
                          className="cursor-pointer hover:bg-gray-100 transition-colors text-right"
                          onClick={() => handleSort("profit")}
                        >
                          <div className="flex items-center justify-end font-semibold">
                            Ganancia
                            <SortIcon field="profit" />
                          </div>
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedResults.map((item) => (
                      <TableRow key={item.code} className="hover:bg-gray-50">
                        <TableCell className="font-mono text-sm">
                          {item.code}
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold">{item.units}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-gray-800">
                            {formatCurrency(item.revenue)}
                          </span>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <span
                              className={cn(
                                "font-semibold",
                                (item.profit || 0) >= 0 ? "text-green-600" : "text-red-600"
                              )}
                            >
                              {formatCurrency(item.profit || 0)}
                            </span>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
