"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Receipt, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/hooks/use-auth"
import { apiClient } from "@/lib/api/client"
import type { Sale, SaleListResponse } from "@/lib/types/api"
import { SaleForm } from "@/components/sales/sale-form"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DashboardLayout } from "../../../components/dashboard/dashboard-layout"

export default function SalesPage() {
  const { user } = useAuth()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [isFiltering, setIsFiltering] = useState(false)
  const [searchDate, setSearchDate] = useState(new Date().toISOString().split("T")[0])
  const [showForm, setShowForm] = useState(false)
  const [lastKey, setLastKey] = useState<string | undefined>()

  const isAdmin = user?.role === "admin"

  const loadSales = async (reset = false, params?: any) => {
    try {
      setLoading(true)
      const response: SaleListResponse = await apiClient.listSales({
        ...params,
        lastKey: reset ? undefined : lastKey,
      })

      if (reset) {
        setSales(response.items)
      } else {
        setSales((prev) => [...prev, ...response.items])
      }

      setLastKey(response.lastKey)
    } catch (error) {
      console.error("Error loading sales:", error)
    } finally {
      setLoading(false)
      setIsFiltering(false)
    }
  }

  useEffect(() => {
    if (sales.length === 0) {
      loadSales(true, { day: searchDate })
    }
  }, [])

  const handleDateFilter = () => {
    setIsFiltering(true)
    if (searchDate) {
      loadSales(true, { day: searchDate })
    } else {
      loadSales(true)
    }
  }

  const handleCreateSale = () => {
    setShowForm(true)
  }

  const handleFormSuccess = () => {
    // setShowForm(false)
    // loadSales(true)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(amount)
  }

  return (
    <DashboardLayout>
      {loading && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center z-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
        </div>
      )}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Ventas</h1>
            <p className="text-sm sm:text-base text-gray-600">Registra y gestiona las ventas</p>
          </div>
          <Button
            onClick={handleCreateSale}
            className="bg-orange-600 hover:bg-orange-700 text-base sm:text-lg px-4 py-4 sm:px-6 sm:py-6 rounded-lg cursor-pointer transition-transform transform hover:scale-105 w-full sm:w-auto"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nueva Venta
          </Button>
        </div>
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Lista de Ventas
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
                <div className="flex gap-2">
                  <Button onClick={handleDateFilter} size="sm" className="flex-1 sm:flex-initial">
                    Filtrar
                  </Button>
                  {searchDate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchDate("")
                        setIsFiltering(true)
                        loadSales(true)
                      }}
                      className="flex-1 sm:flex-initial"
                    >
                      Limpiar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!loading || (loading && sales.length > 0) ? (
              <div className="space-y-4">
                {sales.map((sale) => (
                  <div key={sale.saleId} className="p-3 sm:p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Venta #{sale.saleId.slice(-8)}</h3>
                        <Badge variant="outline" className="w-fit text-xs">
                          {format(new Date(sale.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                        </Badge>
                      </div>
                    </div>

                    {/* Vista mobile - Cards */}
                    <div className="sm:hidden space-y-3">
                      {sale.items.map((item, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-lg space-y-1.5">
                          <div className="flex justify-between items-start">
                            <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                            <div className="font-bold text-gray-900 text-sm tabular-nums">
                              {formatCurrency(item.qty * item.priceSale)}
                            </div>
                          </div>
                          <div className="text-xs text-gray-600 space-y-0.5">
                            <div>Código: {item.code}</div>
                            <div className="flex justify-between">
                              <span>Cantidad: {item.qty} {item.uom}</span>
                              <span>Precio: {formatCurrency(item.priceSale)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
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
                    <div className="hidden sm:block">
                      <table className="w-full text-sm text-gray-700">
                        <thead>
                          <tr className="text-left">
                            <th className="pr-5 py-1 whitespace-nowrap">Nombre</th>
                            <th className="px-5 py-1 whitespace-nowrap">Código</th>
                            <th className="px-5 py-1 whitespace-nowrap text-left">Cantidad</th>
                            <th className="px-5 py-1 whitespace-nowrap text-left">Precio</th>
                            <th className="px-5 py-1 whitespace-nowrap text-left">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sale.items.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="pr-5 py-1 whitespace-nowrap w-0">{item.name}</td>
                              <td className="px-5 py-1 whitespace-nowrap w-0">{item.code}</td>
                              <td className="px-5 py-1 whitespace-nowrap w-0 text-left tabular-nums">{item.qty} {item.uom}</td>
                              <td className="px-5 py-1 whitespace-nowrap w-0 text-left tabular-nums">{formatCurrency(item.priceSale)}</td>
                              <td className="px-5 py-1 whitespace-nowrap w-full text-left tabular-nums font-medium">
                                {formatCurrency(item.qty * item.priceSale)}
                              </td>
                            </tr>
                          ))}
                          <tr className="hover:bg-gray-50 border-t-2">
                            <td className="pr-5 py-2 whitespace-nowrap w-0 text-lg font-bold text-gray-900 align-top">Total</td>
                            <td className="px-5 py-2 whitespace-nowrap w-0"></td>
                            <td className="px-5 py-2 whitespace-nowrap w-0 text-left tabular-nums"></td>
                            <td className="px-5 py-2 whitespace-nowrap w-0 text-left tabular-nums"></td>
                            <td className="px-5 py-2 whitespace-nowrap w-full text-left tabular-nums font-medium">
                              <div className="flex flex-col">
                                <span className="text-lg font-bold text-gray-900">{formatCurrency(sale.total)}</span>
                                {sale.profit !== null && sale.profit !== undefined && (
                                  <span className="text-sm text-emerald-600">
                                    Ganancia: {formatCurrency(sale.profit)}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
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
                ))}
                {lastKey && (
                  <div className="text-center pt-4">
                    <Button variant="outline" onClick={() => loadSales(false)} disabled={loading} className="w-full sm:w-auto">
                      {loading ? "Cargando..." : "Cargar más"}
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
        {showForm && <SaleForm onSuccess={handleFormSuccess} onCancel={() => setShowForm(false)} />}
      </div>
    </DashboardLayout>
  )
}
