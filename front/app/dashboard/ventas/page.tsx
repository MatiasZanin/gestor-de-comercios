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
  const [searchDate, setSearchDate] = useState("")
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
    }
  }

  useEffect(() => {
    if (sales.length === 0) {
      loadSales(true)
    }
    console.log("🚀 ~ SalesPage ~ true:", true)
  }, [])

  const handleDateFilter = () => {
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
    setShowForm(false)
    loadSales(true)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(amount)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ventas</h1>
            <p className="text-gray-600">Registra y gestiona las ventas</p>
          </div>
          <Button onClick={handleCreateSale} className="bg-orange-600 hover:bg-orange-700">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Venta
          </Button>
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Lista de Ventas
              </CardTitle>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <Input
                    type="date"
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                    className="w-40"
                  />
                  <Button onClick={handleDateFilter} size="sm">
                    Filtrar
                  </Button>
                  {searchDate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchDate("")
                        loadSales(true)
                      }}
                    >
                      Limpiar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading && sales.length === 0 ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Cargando ventas...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sales.map((sale) => (
                  <div key={sale.saleId} className="p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-gray-900">Venta #{sale.saleId.slice(-8)}</h3>
                        <Badge variant="outline">
                          {format(new Date(sale.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">{formatCurrency(sale.total)}</div>
                        {isAdmin && sale.profit && (
                          <div className="text-sm text-emerald-600">Ganancia: {formatCurrency(sale.profit)}</div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {sale.items.map((item, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-gray-500">({item.code})</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span>Cant: {item.qty}</span>
                            <span>Precio: {formatCurrency(item.priceSale)}</span>
                            <span className="font-medium">{formatCurrency(item.qty * item.priceSale)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {sale.notes && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm text-gray-600">
                          <strong>Notas:</strong> {sale.notes}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
                {lastKey && (
                  <div className="text-center pt-4">
                    <Button variant="outline" onClick={() => loadSales(false)} disabled={loading}>
                      {loading ? "Cargando..." : "Cargar más"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        {showForm && <SaleForm onSuccess={handleFormSuccess} onCancel={() => setShowForm(false)} />}
      </div>
    </DashboardLayout>
  )
}
