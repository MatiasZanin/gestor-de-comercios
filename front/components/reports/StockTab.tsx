"use client";

import { AlertTriangle, Package, TrendingDown, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RestockAlertItem } from "./types";

interface StockTabProps {
    restockAlerts: RestockAlertItem[];
}

export function StockTab({ restockAlerts }: StockTabProps) {
    // Nota: Estos valores vendrían de un futuro endpoint 'getInventoryValuation'
    // Por ahora los dejamos en 0 o podrías calcularlos si tuvieras la lista completa de productos.
    const valuation = { cost: 0, retail: 0 };
    const profitMargin = 0;

    return (
        <div className="space-y-6">
            {/* Inventory Valuation KPIs (Placeholder para Futura Implementación) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60 grayscale-[0.5]">
                <Card className="border-0 shadow-sm bg-gray-50">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gray-200">
                                <DollarSign className="h-5 w-5 text-gray-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Costo de Reposición</p>
                                <p className="text-xl font-bold text-gray-900">
                                    --
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                {/* ... (Otras cards de KPI) ... */}
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