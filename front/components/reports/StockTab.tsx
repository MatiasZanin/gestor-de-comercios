"use client";

import { AlertTriangle, Package, TrendingDown, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    mockRestockAlerts,
    mockInventoryValuation,
    mockStaleProducts,
} from "./mock-data";

export function StockTab() {
    const potentialProfit = mockInventoryValuation.totalSalePrice - mockInventoryValuation.totalCostPrice;
    const profitMargin = ((potentialProfit / mockInventoryValuation.totalCostPrice) * 100).toFixed(1);

    return (
        <div className="space-y-6">
            {/* Inventory Valuation KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-white">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100">
                                <DollarSign className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Costo de Reposición</p>
                                <p className="text-xl font-bold text-gray-900">
                                    ${mockInventoryValuation.totalCostPrice.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-100">
                                <TrendingDown className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Venta Potencial</p>
                                <p className="text-xl font-bold text-gray-900">
                                    ${mockInventoryValuation.totalSalePrice.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-white sm:col-span-2 lg:col-span-1">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-100">
                                <Package className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Margen Potencial</p>
                                <p className="text-xl font-bold text-emerald-600">
                                    +{profitMargin}% (${potentialProfit.toLocaleString()})
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Stock Alerts Section */}
            <Card className="border-0 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        Alertas de Stock Crítico
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                            {mockRestockAlerts.length} productos
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {mockRestockAlerts.map((alert) => {
                            const stockPercentage = (alert.stock / alert.minStock) * 100;
                            const isCritical = stockPercentage < 30;

                            return (
                                <div
                                    key={alert.code}
                                    className={`p-4 rounded-xl border-2 ${isCritical
                                            ? "border-red-200 bg-red-50"
                                            : "border-orange-200 bg-orange-50"
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <span
                                            className={`px-2 py-1 text-xs font-semibold rounded ${isCritical
                                                    ? "bg-red-200 text-red-800"
                                                    : "bg-orange-200 text-orange-800"
                                                }`}
                                        >
                                            {isCritical ? "CRÍTICO" : "BAJO"}
                                        </span>
                                        <AlertTriangle
                                            className={`h-5 w-5 ${isCritical ? "text-red-500" : "text-orange-500"
                                                }`}
                                        />
                                    </div>
                                    <h4 className="font-semibold text-gray-900 mb-1 line-clamp-1">
                                        {alert.name}
                                    </h4>
                                    <p className="text-xs text-gray-500 mb-3 font-mono">
                                        {alert.code}
                                    </p>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <span className="text-2xl font-bold text-gray-900">
                                                {alert.stock}
                                            </span>
                                            <span className="text-sm text-gray-500 ml-1">
                                                / {alert.minStock} min
                                            </span>
                                        </div>
                                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${isCritical ? "bg-red-500" : "bg-orange-500"
                                                    }`}
                                                style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Stale Products Table */}
            <Card className="border-0 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                        <Package className="h-5 w-5 text-gray-600" />
                        Productos Sin Movimiento
                        <span className="text-sm font-normal text-gray-500">
                            (Huesos)
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Código</TableHead>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-right">Stock</TableHead>
                                    <TableHead className="text-right">Última Venta</TableHead>
                                    <TableHead className="text-right">Días Sin Venta</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mockStaleProducts.map((product) => (
                                    <TableRow key={product.code}>
                                        <TableCell className="font-mono text-sm text-gray-500">
                                            {product.code}
                                        </TableCell>
                                        <TableCell className="font-medium">{product.name}</TableCell>
                                        <TableCell className="text-right">{product.stock}</TableCell>
                                        <TableCell className="text-right text-gray-500">
                                            {product.lastSaleDate || "Nunca"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span
                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${product.daysWithoutSale > 60
                                                        ? "bg-red-100 text-red-700"
                                                        : product.daysWithoutSale > 30
                                                            ? "bg-orange-100 text-orange-700"
                                                            : "bg-yellow-100 text-yellow-700"
                                                    }`}
                                            >
                                                {product.daysWithoutSale} días
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
