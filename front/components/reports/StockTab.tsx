"use client";

import { useState } from "react";
import { AlertTriangle, Package, TrendingUp, DollarSign, Turtle, Skull, Info, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

    const [showInfo, setShowInfo] = useState<Record<string, boolean>>({});

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

            {/* Tables in Tabs */}
            <Card className="border-0 shadow-sm">
                <CardContent className="">
                    <Tabs defaultValue="critical-stock">
                        <TabsList className="w-full">
                            <TabsTrigger value="critical-stock" className="gap-1.5">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                Alerta Stock Crítico
                                {restockAlerts.length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                                        {restockAlerts.length}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="dead-stock" className="gap-1.5">
                                <Skull className="h-4 w-4 text-gray-600" />
                                Stock Muerto
                                {deadStock.length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-full">
                                        {deadStock.length}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="slow-rotation" className="gap-1.5">
                                <Turtle className="h-4 w-4 text-amber-600" />
                                Rotación Lenta
                                {overstock.length > 0 && (
                                    <span className="ml-1 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                                        {overstock.length}
                                    </span>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        {/* Alerta Stock Crítico */}
                        <TabsContent value="critical-stock">
                            <div className="flex justify-end mb-2">
                                <button
                                    onClick={() => setShowInfo(prev => ({ ...prev, critical: !prev.critical }))}
                                    className="p-1.5 flex items-center gap-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                                    title="¿Qué muestra esta tabla?"
                                >
                                    <Info className="h-4 w-4" />
                                    <span className="text-xs">¿Qué muestra esta tabla?</span>
                                </button>
                            </div>
                            {showInfo.critical && (
                                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                                    <p className="text-sm text-red-800 flex-1">
                                        Productos cuyo stock actual está por debajo del stock mínimo configurado. Los marcados como <strong>AGOTADO</strong> tienen stock en 0 o negativo, y los marcados como <strong>BAJO</strong> están por debajo del umbral mínimo.
                                    </p>
                                    <button
                                        onClick={() => setShowInfo(prev => ({ ...prev, critical: false }))}
                                        className="p-0.5 rounded hover:bg-red-100 text-red-500 shrink-0"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
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
                        </TabsContent>

                        {/* Stock Muerto */}
                        <TabsContent value="dead-stock">
                            <div className="flex justify-end mb-2">
                                <button
                                    onClick={() => setShowInfo(prev => ({ ...prev, dead: !prev.dead }))}
                                    className="p-1.5 flex items-center gap-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                                    title="¿Qué muestra esta tabla?"
                                >
                                    <Info className="h-4 w-4" />
                                    <span className="text-xs">¿Qué muestra esta tabla?</span>
                                </button>
                            </div>
                            {showInfo.dead && (
                                <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-2">
                                    <Skull className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
                                    <p className="text-sm text-gray-700 flex-1">
                                        Productos que no registran ninguna venta en los últimos <strong>90 días</strong>. Este inventario inmovilizado representa capital estancado que podría liberarse con promociones o liquidaciones.
                                    </p>
                                    <button
                                        onClick={() => setShowInfo(prev => ({ ...prev, dead: false }))}
                                        className="p-0.5 rounded hover:bg-gray-200 text-gray-500 shrink-0"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                            {deadStock.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 flex flex-col items-center">
                                    <Skull className="h-10 w-10 mb-2 opacity-20" />
                                    <p>¡Excelente! No hay productos con stock muerto.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
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
                            )}
                        </TabsContent>

                        {/* Rotación Lenta */}
                        <TabsContent value="slow-rotation">
                            <div className="flex justify-end mb-2">
                                <button
                                    onClick={() => setShowInfo(prev => ({ ...prev, slow: !prev.slow }))}
                                    className="p-1.5 flex items-center gap-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                                    title="¿Qué muestra esta tabla?"
                                >
                                    <Info className="h-4 w-4" />
                                    <span className="text-xs">¿Qué muestra esta tabla?</span>
                                </button>
                            </div>
                            {showInfo.slow && (
                                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                                    <Turtle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                    <p className="text-sm text-amber-800 flex-1">
                                        Productos con una cobertura de stock superior a <strong>6 meses</strong>, basada en el promedio de ventas mensuales. Indica que hay más inventario del necesario para la demanda actual.
                                    </p>
                                    <button
                                        onClick={() => setShowInfo(prev => ({ ...prev, slow: false }))}
                                        className="p-0.5 rounded hover:bg-amber-100 text-amber-500 shrink-0"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                            {overstock.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 flex flex-col items-center">
                                    <TrendingUp className="h-10 w-10 mb-2 opacity-20" />
                                    <p>¡Excelente! Todos los productos tienen buena rotación.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
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
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}