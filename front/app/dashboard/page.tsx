"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { apiClient } from "@/lib/api/client"
import { useAuth } from "@/lib/hooks/use-auth"
import { Package, ShoppingCart, TrendingUp, DollarSign } from "lucide-react"

interface DashboardStats {
  totalProducts: number
  activeProducts: number
  todaySales: number
  todayRevenue: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    activeProducts: 0,
    todaySales: 0,
    todayRevenue: 0,
  })
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState(0)
  const { user } = useAuth()
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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-orange-500 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-gray-600 mt-2">Resumen general de tu negocio</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => {
            if (stat.show === false) return null

            return (
              <Card
                key={index}
                className="border-0 shadow-lg hover:shadow-xl transition-all duration-200 bg-white/80 backdrop-blur-sm"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{loading ? "..." : stat.value}</div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a
                  href="/dashboard/productos"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gradient-to-r hover:from-emerald-50 hover:to-orange-50 transition-all duration-200 hover:shadow-md"
                >
                  <Package className="w-6 h-6 text-emerald-600 mb-2" />
                  <h3 className="font-medium text-gray-900">Gestionar Productos</h3>
                  <p className="text-sm text-gray-600">Crear y editar productos</p>
                </a>
                <a
                  href="/dashboard/ventas"
                  className="p-4 border border-gray-200 rounded-lg hover:bg-gradient-to-r hover:from-emerald-50 hover:to-orange-50 transition-all duration-200 hover:shadow-md"
                >
                  <ShoppingCart className="w-6 h-6 text-orange-600 mb-2" />
                  <h3 className="font-medium text-gray-900">Nueva Venta</h3>
                  <p className="text-sm text-gray-600">Registrar una venta</p>
                </a>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">Información del Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600">
                <p>
                  <strong>Usuario:</strong> {user.username}
                </p>
                <p>
                  <strong>Rol:</strong> <span className="capitalize">{user.role}</span>
                </p>
                <p>
                  <strong>Comercio:</strong> {user.commerceId}
                </p>
                <p>
                  <strong>Última actualización:</strong> {new Date().toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
