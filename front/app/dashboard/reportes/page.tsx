"use client";

import { useState, useEffect } from "react";
import { Calendar, TrendingUp, Package, DollarSign, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { SalesTab } from "@/components/reports/SalesTab";
import { StockTab } from "@/components/reports/StockTab";
import { FinanceTab } from "@/components/reports/FinanceTab";
import { apiClient } from "@/lib/api/client";
// Importamos los tipos desde types.ts (o donde los hayas definido)
import { DailySummaryItem, RankingItem, RestockAlertItem, CashClosureItem } from "@/components/reports/types";

export default function ReportsPage() {
  // Estado para el rango de fechas
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30); // Default: Últimos 30 días

    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    };
  });

  // Estado de Carga y Errores
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados de Datos para las 3 pestañas
  const [dailySummaries, setDailySummaries] = useState<DailySummaryItem[]>([]);
  const [topProducts, setTopProducts] = useState<RankingItem[]>([]);
  const [restockAlerts, setRestockAlerts] = useState<RestockAlertItem[]>([]);
  const [closures, setClosures] = useState<CashClosureItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const startMonth = dateRange.start.slice(0, 7);
        const endMonth = dateRange.end.slice(0, 7);

        // Disparamos las 4 peticiones en paralelo
        const [summaryRes, rankingRes, alertsRes, closuresRes] = await Promise.all([
          // 1. Gráficos de Ventas y Pagos
          apiClient.getDailySummary({ start: dateRange.start, end: dateRange.end }),
          // 2. Ranking de Productos
          apiClient.getMonthlyRanking({ startMonth, endMonth }),
          // 3. Alertas de Stock (No depende de fecha, es foto actual)
          apiClient.getRestockAlerts({}),
          // 4. Cierres de Caja
          apiClient.listClosures({ /* Opcional: day: dateRange.end */ })
        ]);

        // Guardamos los resultados en el estado
        setDailySummaries(summaryRes.items || []);

        // Manejo defensivo para el ranking (por si viene anidado o plano)
        const flatRankings = rankingRes.rankings
          ? rankingRes.rankings.flatMap((r: any) => r.items)
          : (rankingRes.results || []);
        setTopProducts(flatRankings);

        setRestockAlerts(alertsRes.items || []);
        setClosures(closuresRes.items || []);

      } catch (err: any) {
        console.error("Error fetching report data:", err);
        setError("Error al cargar datos. Verifica tu conexión.");
      } finally {
        setIsLoading(false);
      }
    };

    if (dateRange.start && dateRange.end) {
      fetchData();
    }
  }, [dateRange.start, dateRange.end]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header con Filtro */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-orange-500 bg-clip-text text-transparent">
              Reportes
            </h1>
            <p className="text-gray-600 mt-1">
              Análisis de ventas, stock y finanzas
            </p>
          </div>

          <Card className="flex items-center gap-3 px-4 py-2 border-0 shadow-sm bg-white">
            <Calendar className="h-4 w-4 text-gray-500" />
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                className="px-2 py-1 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-gray-400">—</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className="px-2 py-1 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </Card>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-100">
            {error}
          </div>
        ) : (
          <Tabs defaultValue="sales" className="w-full">
            <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex gap-1 p-1 bg-gray-100 rounded-xl">
              <TabsTrigger value="sales" className="gap-2 px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Ventas</span>
              </TabsTrigger>
              <TabsTrigger value="stock" className="gap-2 px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Stock</span>
              </TabsTrigger>
              <TabsTrigger value="finance" className="gap-2 px-4 py-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm transition-all">
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Finanzas</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sales" className="mt-6">
              <SalesTab dailySummaries={dailySummaries} topProducts={topProducts} />
            </TabsContent>

            <TabsContent value="stock" className="mt-6">
              {/* Aquí pasamos restockAlerts que ahora sí tenemos en el estado */}
              <StockTab restockAlerts={restockAlerts} />
            </TabsContent>

            <TabsContent value="finance" className="mt-6">
              {/* Aquí pasamos closures que ahora sí tenemos en el estado */}
              <FinanceTab dailySummaries={dailySummaries} closures={closures} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}