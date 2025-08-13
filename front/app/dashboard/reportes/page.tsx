"use client"

import { useState } from "react"
import { Calendar, TrendingUp, BarChart3, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/lib/hooks/use-auth"
import { apiClient } from "@/lib/api/client"
import type { DailyReportResponse, RangeReportResponse, ReportItem } from "@/lib/types/api"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export default function ReportsPage() {
  const { user } = useAuth()
  const [dailyReport, setDailyReport] = useState<DailyReportResponse | null>(null)
  const [rangeReport, setRangeReport] = useState<RangeReportResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Daily report state
  const [dailyDate, setDailyDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [dailyOrderBy, setDailyOrderBy] = useState<"units" | "revenue" | "profit">("units")

  // Range report state
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [rangeOrderBy, setRangeOrderBy] = useState<"units" | "revenue" | "profit">("units")

  const isAdmin = user?.role === "admin"

  const loadDailyReport = async () => {
    setLoading(true)
    setError("")

    try {
      const response = await apiClient.getDailyReport({
        day: dailyDate,
        orderBy: dailyOrderBy,
      })
      setDailyReport(response)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error al cargar reporte diario")
    } finally {
      setLoading(false)
    }
  }

  const loadRangeReport = async () => {
    setLoading(true)
    setError("")

    try {
      const response = await apiClient.getRangeReport({
        start: startDate,
        end: endDate,
        orderBy: rangeOrderBy,
      })
      setRangeReport(response)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error al cargar reporte por rango")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: es })
  }

  const renderReportTable = (items: ReportItem[]) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left p-3">Código</th>
            <th className="text-left p-3">Producto</th>
            <th className="text-right p-3">Unidades</th>
            <th className="text-right p-3">Ingresos</th>
            {isAdmin && <th className="text-right p-3">Ganancia</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.code} className={index % 2 === 0 ? "bg-gray-50" : ""}>
              <td className="p-3 font-mono text-sm">{item.code}</td>
              <td className="p-3">{item.name}</td>
              <td className="p-3 text-right">{item.units}</td>
              <td className="p-3 text-right">{formatCurrency(item.revenue)}</td>
              {isAdmin && (
                <td className="p-3 text-right text-emerald-600">{item.profit ? formatCurrency(item.profit) : "-"}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-600">Analiza el rendimiento de ventas</p>
        </div>
      </div>

      <Tabs defaultValue="daily" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="daily" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Reporte Diario
          </TabsTrigger>
          <TabsTrigger value="range" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Reporte por Rango
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Reporte Diario
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4 mb-6">
                <div>
                  <Label htmlFor="dailyDate">Fecha</Label>
                  <Input
                    id="dailyDate"
                    type="date"
                    value={dailyDate}
                    onChange={(e) => setDailyDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div>
                  <Label htmlFor="dailyOrderBy">Ordenar por</Label>
                  <Select value={dailyOrderBy} onValueChange={(value: any) => setDailyOrderBy(value)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="units">Unidades</SelectItem>
                      <SelectItem value="revenue">Ingresos</SelectItem>
                      {isAdmin && <SelectItem value="profit">Ganancia</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={loadDailyReport} disabled={loading}>
                  {loading ? "Cargando..." : "Generar Reporte"}
                </Button>
              </div>

              {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

              {dailyReport && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Reporte del {formatDate(dailyReport.day)}</h3>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Exportar
                    </Button>
                  </div>

                  {dailyReport.results.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay datos para la fecha seleccionada</p>
                  ) : (
                    renderReportTable(dailyReport.results)
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="range" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Reporte por Rango de Fechas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-4 mb-6">
                <div>
                  <Label htmlFor="startDate">Fecha Inicio</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">Fecha Fin</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div>
                  <Label htmlFor="rangeOrderBy">Ordenar por</Label>
                  <Select value={rangeOrderBy} onValueChange={(value: any) => setRangeOrderBy(value)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="units">Unidades</SelectItem>
                      <SelectItem value="revenue">Ingresos</SelectItem>
                      {isAdmin && <SelectItem value="profit">Ganancia</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={loadRangeReport} disabled={loading}>
                  {loading ? "Cargando..." : "Generar Reporte"}
                </Button>
              </div>

              {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

              {rangeReport && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                      Reporte del {formatDate(rangeReport.start)} al {formatDate(rangeReport.end)}
                    </h3>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Exportar
                    </Button>
                  </div>

                  {rangeReport.results.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay datos para el rango de fechas seleccionado</p>
                  ) : (
                    renderReportTable(rangeReport.results)
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
