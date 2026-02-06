"use client";

import { AlertTriangle, Package, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RestockAlertItem } from "./types";

interface InventoryValuation {
    totalCost: number;
    totalRetail: number;
    count: number;
}

interface StockTabProps {
    restockAlerts: RestockAlertItem[];
    inventoryValuation?: InventoryValuation;
}

export function StockTab({ restockAlerts, inventoryValuation }: StockTabProps) {
    const valuation = inventoryValuation ?? { totalCost: 0, totalRetail: 0, count: 0 };
    const profitMargin = valuation.totalRetail > 0
        ? ((valuation.totalRetail - valuation.totalCost) / valuation.totalRetail) * 100
        : 0;

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(value);

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

            {/* Stock Alerts Section (REAL DATA) */}
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {restockAlerts.map((alert) => {
                                const stockPercentage = alert.minStock > 0
                                    ? (alert.stock / alert.minStock) * 100
                                    : 0;
                                const isCritical = alert.stock <= 0;

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
                                                {isCritical ? "AGOTADO" : "BAJO"}
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
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}