"use client";

import { useState, useMemo } from "react";
import { Calendar, TrendingUp, Package, DollarSign } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { SalesTab } from "@/components/reports/SalesTab";
import { StockTab } from "@/components/reports/StockTab";
import { FinanceTab } from "@/components/reports/FinanceTab";
import { generateDailySummaries } from "@/components/reports/mock-data";

export default function ReportsPage() {
  // Date range state
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    };
  });

  // Generate mock data
  const dailySummaries = useMemo(() => {
    return generateDailySummaries();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-orange-500 bg-clip-text text-transparent">
              Reportes
            </h1>
            <p className="text-gray-600 mt-1">
              Análisis de ventas, stock y finanzas
            </p>
          </div>

          {/* Date Range Selector */}
          <Card className="flex items-center gap-3 px-4 py-2 border-0 shadow-sm bg-white">
            <Calendar className="h-4 w-4 text-gray-500" />
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, start: e.target.value }))
                }
                className="px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <span className="text-gray-400">—</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value }))
                }
                className="px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </Card>
        </div>

        {/* Tabs Navigation */}
        <Tabs defaultValue="sales" className="w-full">
          <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex gap-1 p-1 bg-gray-100 rounded-xl">
            <TabsTrigger
              value="sales"
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Ventas & Tendencias</span>
              <span className="sm:hidden">Ventas</span>
            </TabsTrigger>
            <TabsTrigger
              value="stock"
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Stock & Inventario</span>
              <span className="sm:hidden">Stock</span>
            </TabsTrigger>
            <TabsTrigger
              value="finance"
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg transition-all"
            >
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Finanzas & Caja</span>
              <span className="sm:hidden">Finanzas</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="mt-6">
            <SalesTab dailySummaries={dailySummaries} />
          </TabsContent>

          <TabsContent value="stock" className="mt-6">
            <StockTab />
          </TabsContent>

          <TabsContent value="finance" className="mt-6">
            <FinanceTab dailySummaries={dailySummaries} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
