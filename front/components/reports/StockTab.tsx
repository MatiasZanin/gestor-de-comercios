"use client";

import { AlertTriangle, Package, TrendingUp, DollarSign, Turtle, Skull } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { RestockAlertItem, StaleProductsResponse } from "./types";

interface InventoryValuation {
    totalCost: number;
    totalRetail: number;
    count: number;
}

interface StockTabProps {
    restockAlerts: RestockAlertItem[];
    inventoryValuation?: InventoryValuation;
    staleProducts?: StaleProductsResponse;
}

export function StockTab({ restockAlerts, inventoryValuation, staleProducts }: StockTabProps) {
    const valuation = inventoryValuation ?? { totalCost: 0, totalRetail: 0, count: 0 };
    const profitMargin = valuation.totalRetail > 0
        ? ((valuation.totalRetail - valuation.totalCost) / valuation.totalRetail) * 100
        : 0;

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(value);

    const deadStock = staleProducts?.deadStock || [];
    const overstock = staleProducts?.overstock || [];

    const formatDate = (date: string | null) => {
        if (!date) return "Nunca";
        return new Date(date + "T00:00:00").toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    return (
        <div className="space-y-6">
            {/* Inventory Valuation KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/50">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-200">
                                <DollarSign className="h-5 w-5 text-blue-700" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Costo de Reposición</p>
                                <p className="text-xl font-bold text-gray-900">
                                    {formatCurrency(valuation.totalCost)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100/50">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-200">
                                <TrendingUp className="h-5 w-5 text-green-700" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Valor a Precio de Venta</p>
                                <p className="text-xl font-bold text-gray-900">
                                    {formatCurrency(valuation.totalRetail)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/50">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-200">
                                <Package className="h-5 w-5 text-purple-700" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Ganancia Potencial</p>
                                <p className="text-xl font-bold text-gray-900">
                                    {formatCurrency(valuation.totalRetail - valuation.totalCost)}
                                    <span className="text-sm font-normal text-gray-500 ml-2">
                                        ({profitMargin.toFixed(1)}% margen)
                                    </span>
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Stock Alerts Table */}
            <Card className="border-0 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        Alertas de Stock Crítico
                        {restockAlerts.length > 0 && (
                            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                                {restockAlerts.length} productos
                            </span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {restockAlerts.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 flex flex-col items-center">
                            <Package className="h-10 w-10 mb-2 opacity-20" />
                            <p>¡Todo en orden! No hay productos con stock crítico.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Producto</TableHead>
                                        <TableHead className="text-right">Stock Actual</TableHead>
                                        <TableHead className="text-right">Stock Mínimo</TableHead>
                                        <TableHead className="text-center">Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {restockAlerts.map((alert) => {
                                        const isCritical = alert.stock <= 0;
                                        return (
                                            <TableRow key={alert.code}>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{alert.name}</p>
                                                        <p className="text-xs text-gray-500 font-mono">{alert.code}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {alert.stock}
                                                </TableCell>
                                                <TableCell className="text-right text-gray-600">
                                                    {alert.minStock}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span
                                                        className={`px-2 py-1 text-xs font-semibold rounded ${isCritical
                                                            ? "bg-red-200 text-red-800"
                                                            : "bg-orange-200 text-orange-800"
                                                            }`}
                                                    >
                                                        {isCritical ? "AGOTADO" : "BAJO"}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Stale Products Section */}
            <Card className="border-0 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                        <Turtle className="h-5 w-5 text-amber-600" />
                        Productos de Baja Rotación
                        {(deadStock.length + overstock.length) > 0 && (
                            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                                {deadStock.length + overstock.length} productos
                            </span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {(deadStock.length === 0 && overstock.length === 0) ? (
                        <div className="text-center py-8 text-gray-500 flex flex-col items-center">
                            <TrendingUp className="h-10 w-10 mb-2 opacity-20" />
                            <p>¡Excelente! Todos los productos tienen buena rotación.</p>
                        </div>
                    ) : (
                        <>
                            {/* Dead Stock Table */}
                            {deadStock.length > 0 && (
                                <div>
                                    <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                                        <Skull className="h-4 w-4 text-gray-600" />
                                        Stock Muerto
                                        <span className="text-xs font-normal text-gray-500">
                                            (Sin ventas en +90 días)
                                        </span>
                                    </h4>
                                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-gray-50">
                                                    <TableHead>Producto</TableHead>
                                                    <TableHead className="text-right">Stock</TableHead>
                                                    <TableHead className="text-right">Última Venta</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {deadStock.map((item) => (
                                                    <TableRow key={item.code}>
                                                        <TableCell>
                                                            <div>
                                                                <p className="font-medium text-gray-900">{item.name}</p>
                                                                <p className="text-xs text-gray-500 font-mono">{item.code}</p>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold">
                                                            {item.stock}
                                                        </TableCell>
                                                        <TableCell className="text-right text-gray-600">
                                                            {formatDate(item.lastSaleDate)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            {/* Overstock Table */}
                            {overstock.length > 0 && (
                                <div>
                                    <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                                        <Turtle className="h-4 w-4 text-amber-600" />
                                        Sobrestock / Rotación Lenta
                                        <span className="text-xs font-normal text-gray-500">
                                            (Cobertura &gt; 6 meses)
                                        </span>
                                    </h4>
                                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-gray-50">
                                                    <TableHead>Producto</TableHead>
                                                    <TableHead className="text-right">Stock</TableHead>
                                                    <TableHead className="text-right">Ventas/Mes</TableHead>
                                                    <TableHead className="text-right">Cobertura</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {overstock.map((item) => (
                                                    <TableRow key={item.code}>
                                                        <TableCell>
                                                            <div>
                                                                <p className="font-medium text-gray-900">{item.name}</p>
                                                                <p className="text-xs text-gray-500 font-mono">{item.code}</p>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold">
                                                            {item.stock}
                                                        </TableCell>
                                                        <TableCell className="text-right text-gray-600">
                                                            {item.monthlySales}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <span className="px-2 py-1 text-xs font-semibold bg-amber-100 text-amber-800 rounded">
                                                                {item.coverageMonths} meses
                                                            </span>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}