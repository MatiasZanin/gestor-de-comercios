"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Loader2, Receipt, Clock, DollarSign } from "lucide-react"
import { apiClient } from "@/lib/api/client"
import type { CashClose, Sale, CashCloseDetailResponse } from "@/lib/types/api"
import { PAYMENT_METHOD_LABELS } from "@/lib/types/api"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export default function ClosureDetailPage() {
    const params = useParams()
    const router = useRouter()
    const closureId = params.closureId as string

    const [closure, setClosure] = useState<CashClose | null>(null)
    const [sales, setSales] = useState<Sale[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
        }).format(amount)
    }

    useEffect(() => {
        const loadClosureDetail = async () => {
            try {
                setLoading(true)
                setError("")
                const response: CashCloseDetailResponse = await apiClient.getClosureDetail(closureId)
                setClosure(response.closure)
                setSales(response.sales)
            } catch (err) {
                setError(err instanceof Error ? err.message : "Error al cargar el detalle del cierre")
            } finally {
                setLoading(false)
            }
        }

        if (closureId) {
            loadClosureDetail()
        }
    }, [closureId])

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
                    <span className="ml-3 text-gray-500">Cargando detalle del cierre...</span>
                </div>
            </DashboardLayout>
        )
    }

    if (error) {
        return (
            <DashboardLayout>
                <div className="space-y-4">
                    <Button variant="outline" onClick={() => router.back()}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver
                    </Button>
                    <div className="text-red-600 bg-red-50 p-4 rounded-lg">{error}</div>
                </div>
            </DashboardLayout>
        )
    }

    if (!closure) {
        return (
            <DashboardLayout>
                <div className="space-y-4">
                    <Button variant="outline" onClick={() => router.back()}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver
                    </Button>
                    <div className="text-gray-500">Cierre no encontrado</div>
                </div>
            </DashboardLayout>
        )
    }

    const systemTotal = closure.systemTotalCash + closure.systemTotalCard + closure.systemTotalTransfer

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={() => router.back()}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver
                    </Button>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                            Detalle del Cierre
                        </h1>
                        <p className="text-sm text-gray-600">
                            {format(new Date(closure.closedAt), "EEEE dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
                        </p>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-100 rounded-lg">
                                    <DollarSign className="w-5 h-5 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Total Sistema</p>
                                    <p className="text-xl font-bold">{formatCurrency(systemTotal)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Receipt className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Ventas del Período</p>
                                    <p className="text-xl font-bold">{sales.length}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-100 rounded-lg">
                                    <Clock className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Período</p>
                                    <p className="text-sm font-medium">
                                        {format(new Date(closure.openedAt), "HH:mm", { locale: es })} - {format(new Date(closure.closedAt), "HH:mm", { locale: es })}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${closure.difference === 0 ? 'bg-emerald-100' :
                                    closure.difference > 0 ? 'bg-blue-100' : 'bg-red-100'
                                    }`}>
                                    <DollarSign className={`w-5 h-5 ${closure.difference === 0 ? 'text-emerald-600' :
                                        closure.difference > 0 ? 'text-blue-600' : 'text-red-600'
                                        }`} />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Diferencia</p>
                                    <p className={`text-xl font-bold ${closure.difference === 0 ? 'text-emerald-600' :
                                        closure.difference > 0 ? 'text-blue-600' : 'text-red-600'
                                        }`}>
                                        {formatCurrency(closure.difference)}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Closure Details */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Resumen del Cierre
                            <Badge
                                className="ml-2"
                                variant={
                                    closure.difference === 0 ? "default" :
                                        closure.difference > 0 ? "secondary" : "destructive"
                                }
                            >
                                {closure.difference === 0 ? "Cuadrado" :
                                    closure.difference > 0 ? "Sobrante" : "Faltante"}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Efectivo</p>
                                <p className="text-lg font-semibold">{formatCurrency(closure.systemTotalCash)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Tarjeta</p>
                                <p className="text-lg font-semibold">{formatCurrency(closure.systemTotalCard)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Transferencia</p>
                                <p className="text-lg font-semibold">{formatCurrency(closure.systemTotalTransfer)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Otros</p>
                                <p className="text-lg font-semibold">{formatCurrency(closure.systemTotalOther)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Efectivo Declarado</p>
                                <p className="text-lg font-semibold">{formatCurrency(closure.declaredCash)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Gastos</p>
                                <p className="text-lg font-semibold">{formatCurrency(closure.expenses)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Fondo Inicial</p>
                                <p className="text-lg font-semibold">{formatCurrency(closure.initialFund)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Diferencia</p>
                                <p className={`text-lg font-semibold ${closure.difference === 0 ? 'text-emerald-600' :
                                    closure.difference > 0 ? 'text-blue-600' : 'text-red-600'
                                    }`}>{formatCurrency(closure.difference)}</p>
                            </div>
                        </div>
                        {closure.notes && (
                            <div className="mt-4 pt-4 border-t">
                                <p className="text-sm text-gray-500 mb-1">Notas</p>
                                <p className="text-gray-700">{closure.notes}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Sales List */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Receipt className="w-5 h-5" />
                            Ventas del Período ({sales.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {sales.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                No hay ventas registradas en este período
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {sales.map((sale) => (
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
                                                        <th className="px-5 py-1 whitespace-nowrap">Marca</th>
                                                        <th className="px-5 py-1 whitespace-nowrap">Categoría</th>
                                                        <th className="px-5 py-1 whitespace-nowrap text-left">Cantidad</th>
                                                        <th className="px-5 py-1 whitespace-nowrap text-left">Precio</th>
                                                        <th className="px-5 py-1 whitespace-nowrap text-left">Total</th>
                                                        <th className="px-5 py-1 whitespace-nowrap text-left">Método de Pago</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sale.items.map((item, index) => (
                                                        <tr key={index} className="hover:bg-gray-50">
                                                            <td className="pr-5 py-1 whitespace-nowrap w-0">{item.name}</td>
                                                            <td className="px-5 py-1 whitespace-nowrap w-0">{item.code}</td>
                                                            <td className="px-5 py-1 whitespace-nowrap w-0 text-left tabular-nums">{item.brand}</td>
                                                            <td className="px-5 py-1 whitespace-nowrap w-0 text-left tabular-nums">{item.category}</td>
                                                            <td className="px-5 py-1 whitespace-nowrap w-0 text-left tabular-nums">{item.qty} {item.uom}</td>
                                                            <td className="px-5 py-1 whitespace-nowrap w-0 text-left tabular-nums">{formatCurrency(item.priceSale)}</td>
                                                            <td className="px-5 py-1 whitespace-nowrap w-0 text-left tabular-nums font-medium">
                                                                {formatCurrency(item.qty * item.priceSale)}
                                                            </td>
                                                            {index === 0 && (
                                                                <td className="px-5 py-1 whitespace-nowrap w-0 text-left" rowSpan={sale.items.length}>
                                                                    {sale.paymentMethod ? PAYMENT_METHOD_LABELS[sale.paymentMethod] : '-'}
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))}
                                                    {/* Fila de Total Principal */}
                                                    <tr className="border-t-2 border-gray-100">
                                                        <td colSpan={7} className="pt-4 pb-1 text-right font-bold text-gray-900">Total:</td>
                                                        <td className="pt-4 pb-1 px-5 text-left text-lg font-bold text-gray-900 tabular-nums">
                                                            {formatCurrency(sale.total)}
                                                        </td>
                                                    </tr>

                                                    {/* Fila de Ganancias (Independiente) */}
                                                    {sale.profit !== null && sale.profit !== undefined && (
                                                        <tr>
                                                            <td colSpan={7} className=" pb-1 text-right font-bold text-gray-900">Ganancia:</td>
                                                            <td colSpan={7} className=" pb-1 px-5 text-left text-l font-bold  tabular-nums text-emerald-600 ">
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
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
