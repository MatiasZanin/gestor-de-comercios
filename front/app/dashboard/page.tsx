"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api/client"
import { useAuth } from "@/lib/hooks/use-auth"
import { Package, ShoppingCart, DollarSign, AlertTriangle, TrendingUp, Trophy } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"

interface DashboardStats {
  totalProducts: number
  activeProducts: number
  todaySales: number
  todayRevenue: number
}

interface DailySummaryItem {
  date: string
  ticketCount: number
  totalRevenue: number
}

interface TopProductItem {
  productCode: string
  productName: string
  monthlyUnits: number
  uom: string
}

interface RestockAlertItem {
  productCode: string
  productName: string
  stock: number
  minStock: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    activeProducts: 0,
    todaySales: 0,
    todayRevenue: 0,
  })
  const [loading, setLoading] = useState(true)
  const [dailySalesData, setDailySalesData] = useState<DailySummaryItem[]>([])
  const [topProducts, setTopProducts] = useState<TopProductItem[]>([])
  const [restockAlerts, setRestockAlerts] = useState<RestockAlertItem[]>([])
  const [count, setCount] = useState(0)
  const { user } = useAuth()
  const router = useRouter()
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    if (user && !hasLoadedRef.current) {
      hasLoadedRef.current = true
      setCount(prev => {
        const newCount = prev + 1
        console.log("count:", newCount)
        return newCount
      })
      loadDashboardData()
    }

    return () => {
      // Cleanup si es necesario
    }
  }, [user])

  const loadDashboardData = async () => {
    try {
      setLoading(true)

      // Load products
      const productsResponse = await apiClient.listProducts()
      const totalProducts = productsResponse.items.length
      const activeProducts = productsResponse.items.filter((p: any) => p.isActive).length

      // Build a map of product code -> product data for cross-referencing
      const productsMap = new Map<string, any>()
      productsResponse.items.forEach((p: any) => {
        const code = p.code || p.productCode || ""
        if (code) productsMap.set(code, p)
      })

      // Load today's report
      const today = new Date().toISOString().split("T")[0]
      const dailyReport = await apiClient.getDailyReport({ day: today })

      const todaySales = dailyReport.results.length
      const todayRevenue = dailyReport.results.reduce((sum: number, item: any) => sum + item.revenue, 0)

      setStats({
        totalProducts,
        activeProducts,
        todaySales,
        todayRevenue,
      })

      // Load daily summary for last 7 days
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 6)

      try {
        const dailySummary = await apiClient.getDailySummary({
          start: startDate.toISOString().split("T")[0],
          end: endDate.toISOString().split("T")[0],
        })

        // Transform data for chart - backend returns totalDay and txCount
        const chartData = (dailySummary.items || []).map((item: any) => ({
          date: item.SK?.replace("SUMMARY#", "") || item.date,
          ticketCount: item.txCount || 0,
          totalRevenue: item.totalDay || 0,
        }))
        setDailySalesData(chartData)
      } catch (error) {
        console.error("Error loading daily summary:", error)
      }

      // Load monthly ranking (top products)
      const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
      try {
        const monthlyRanking = await apiClient.getMonthlyRanking({
          startMonth: currentMonth,
        })

        // Backend returns { rankings: [{ month, items }] }
        const currentMonthData = monthlyRanking.rankings?.find((r: any) => r.month === currentMonth)
        const products = (currentMonthData?.items || []).slice(0, 5).map((item: any) => {
          return {
            productCode: item.code,
            productName: item.name || "Producto",
            monthlyUnits: item.monthlyUnits || 0,
            uom: item.uom || "uds",
          }
        })
        setTopProducts(products)
      } catch (error) {
        console.error("Error loading monthly ranking:", error)
      }

      // Load restock alerts
      try {
        const alerts = await apiClient.getRestockAlerts({})
        const alertItems = (alerts.items || []).slice(0, 5).map((item: any) => ({
          productCode: item.code || item.productCode || "",
          productName: item.name || item.productName || "Producto",
          stock: item.stock || 0,
          minStock: item.minStock || 0,
        }))
        setRestockAlerts(alertItems)
      } catch (error) {
        console.error("Error loading restock alerts:", error)
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error)
      setStats({
        totalProducts: 0,
        activeProducts: 0,
        todaySales: 0,
        todayRevenue: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReponer = (productCode: string) => {
    // Navigate to products page with the product code
    window.location.href = `/dashboard/productos?code=${productCode}`
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  const statCards = [
    {
      title: "Total Productos",
      value: stats.activeProducts,
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Ventas Hoy",
      value: stats.todaySales,
      icon: ShoppingCart,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Ingresos Hoy",
      value: `$${stats.todayRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-50",
      show: user.role === "admin",
    },
  ]

  // Chart config
  const chartConfig = {
    totalRevenue: {
      label: "Ventas ($)",
      color: "#10b981",
    },
  }

  // Format date for chart labels
  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00")
    return date.toLocaleDateString("es-AR", { weekday: "short", day: "numeric" })
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-orange-500 bg-clip-text text-transparent">
            Dashboard
          </h1>
        </div>

        {/* Stat Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => {
            if (stat.show === false) return null

            return (
              <Card
                key={index}
                className="border-0 shadow-lg hover:shadow-xl transition-all duration-200 bg-white/80 backdrop-blur-sm"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
                  <div className="text-2xl font-bold text-gray-900">{loading ? "..." : stat.value}</div>
                </CardHeader>
              </Card>
            )
          })}
        </div>

        {/* Chart - Full Width */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <CardTitle className="text-lg font-semibold text-gray-900">Ventas de los últimos 7 días</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              </div>
            ) : dailySalesData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <LineChart data={dailySalesData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDateLabel}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) => {
                          const date = new Date(value + "T12:00:00")
                          return date.toLocaleDateString("es-AR", {
                            weekday: "long",
                            day: "numeric",
                            month: "long"
                          })
                        }}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="totalRevenue"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: "#059669" }}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                No hay datos disponibles
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bottom Row - Top Products + Stock Alerts side by side */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Top Products */}
          <Card className="flex-1 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center gap-2">
              <Trophy className="w-5 h-5 text-orange-500" />
              <CardTitle className="text-lg font-semibold text-gray-900">Top Productos del Mes</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-32 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : topProducts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600"></th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Código</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Nombre</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Ventas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((product, index) => (
                        <tr key={product.productCode} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? "bg-yellow-100 text-yellow-700" :
                              index === 1 ? "bg-gray-100 text-gray-600" :
                                index === 2 ? "bg-orange-100 text-orange-700" :
                                  "bg-gray-50 text-gray-500"
                              }`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm text-gray-600">{product.productCode}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm font-medium text-gray-900">{product.productName}</span>
                          </td>
                          <td className="text-center py-3 px-4">
                            <span className="text-sm font-semibold text-gray-700">
                              {product.monthlyUnits} {product.uom}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-gray-500">
                  No hay datos disponibles
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stock Alerts */}
          <Card className="flex-1 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <CardTitle className="text-lg font-semibold text-gray-900">Alerta de Stock Bajo</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-32 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
                </div>
              ) : restockAlerts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Código</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Nombre</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Stock Actual</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Stock Mínimo</th>
                        <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {restockAlerts.map((item) => (
                        <tr key={item.productCode} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4">
                            <span className="text-sm text-gray-600">{item.productCode}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-sm font-medium text-gray-900">{item.productName}</span>
                          </td>
                          <td className="text-center py-3 px-4">
                            <span className="text-sm font-bold text-red-600">{item.stock}</span>
                          </td>
                          <td className="text-center py-3 px-4">
                            <span className="text-sm text-gray-600">{item.minStock}</span>
                          </td>
                          <td className="text-center py-3 px-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Crítico
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-32 flex flex-col items-center justify-center text-gray-500">
                  <Package className="w-10 h-10 text-gray-300 mb-2" />
                  <p>No hay productos con stock bajo</p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/dashboard/reportes?tab=stock")}
              >
                Ver todos los productos
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
