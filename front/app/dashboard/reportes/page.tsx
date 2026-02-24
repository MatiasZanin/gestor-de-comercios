"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarIcon, TrendingUp, Package, DollarSign, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SalesTab } from "@/components/reports/SalesTab";
import { StockTab } from "@/components/reports/StockTab";
import { FinanceTab } from "@/components/reports/FinanceTab";
import { apiClient } from "@/lib/api/client";
import { DailySummaryItem, RankingItem, RestockAlertItem, CashClosureItem, InventoryValuation, StaleProductsResponse } from "@/components/reports/types";

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "sales";
  // Función helper para obtener el rango del mes corriente
  const getCurrentMonthRange = (): { start: string; end: string } => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    };
  };

  // Función helper para obtener el rango del mes corriente como DateRange
  const getCurrentMonthDateRange = (): DateRange => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  };

  // Estado para el rango de fechas aplicado (usado en las queries)
  const [dateRange, setDateRange] = useState(getCurrentMonthRange);

  // Estado temporal para el selector de fechas (antes de aplicar)
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(getCurrentMonthDateRange);

  // Estado del popover
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Estado de Carga y Errores
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados de Datos para las 3 pestañas
  const [dailySummaries, setDailySummaries] = useState<DailySummaryItem[]>([]);
  const [topProducts, setTopProducts] = useState<RankingItem[]>([]);
  const [restockAlerts, setRestockAlerts] = useState<RestockAlertItem[]>([]);
  const [closures, setClosures] = useState<CashClosureItem[]>([]);
  const [inventoryValuation, setInventoryValuation] = useState<InventoryValuation>();
  const [staleProducts, setStaleProducts] = useState<StaleProductsResponse>({ deadStock: [], overstock: [] });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const startMonth = dateRange.start.slice(0, 7);
        const endMonth = dateRange.end.slice(0, 7);

        // Disparamos las 4 peticiones en paralelo
        const [summaryRes, rankingRes, alertsRes, closuresRes, valuationRes, staleRes] = await Promise.all([
          // 1. Gráficos de Ventas y Pagos
          apiClient.getDailySummary({ start: dateRange.start, end: dateRange.end }),
          // 2. Ranking de Productos
          apiClient.getMonthlyRanking({ startMonth, endMonth }),
          // 3. Alertas de Stock (No depende de fecha, es foto actual)
          apiClient.getRestockAlerts({}),
          // 4. Cierres de Caja
          apiClient.listClosures({ /* Opcional: day: dateRange.end */ }),
          // 5. Valoración de Inventario
          apiClient.getInventoryValuation(),
          // 6. Productos de Baja Rotación (Dead Stock y Overstock)
          apiClient.getStaleProducts(),
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
        setInventoryValuation(valuationRes || 0);
        setStaleProducts(staleRes || { deadStock: [], overstock: [] });
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

          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="justify-start text-left font-normal gap-2 bg-white border-0 shadow-sm hover:bg-gray-50"
              >
                <CalendarIcon className="h-4 w-4 text-gray-500" />
                <span className="text-sm">
                  {tempDateRange?.from ? (
                    tempDateRange.to ? (
                      <>
                        {format(tempDateRange.from, "dd MMM yyyy", { locale: es })} —{" "}
                        {format(tempDateRange.to, "dd MMM yyyy", { locale: es })}
                      </>
                    ) : (
                      format(tempDateRange.from, "dd MMM yyyy", { locale: es })
                    )
                  ) : (
                    "Seleccionar fechas"
                  )}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                defaultMonth={tempDateRange?.from}
                selected={tempDateRange}
                // --- CAMBIO AQUÍ: Lógica personalizada de selección ---
                onSelect={(newRange, selectedDay) => {
                  if (tempDateRange?.from && tempDateRange?.to && selectedDay) {
                    // Si ya hay un rango completo, iniciamos uno nuevo desde el día seleccionado
                    setTempDateRange({ from: selectedDay, to: undefined });
                  } else {
                    // Si no, dejamos que la librería calcule el rango (completar final o seleccionar inicio)
                    setTempDateRange(newRange);
                  }
                }}
                // ------------------------------------------------------
                numberOfMonths={1}
                locale={es}
              />
              <div className="flex items-center justify-end gap-2 p-3 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCalendarOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (tempDateRange?.from && tempDateRange?.to) {
                      setDateRange({
                        start: tempDateRange.from.toISOString().split("T")[0],
                        end: tempDateRange.to.toISOString().split("T")[0],
                      });
                    }
                    setIsCalendarOpen(false);
                  }}
                  disabled={!tempDateRange?.from || !tempDateRange?.to}
                  className="bg-emerald-500 hover:bg-emerald-600"
                >
                  Aplicar
                </Button>
              </div>
            </PopoverContent>
          </Popover>
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
          <Tabs defaultValue={initialTab} className="w-full">
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
              <StockTab restockAlerts={restockAlerts} inventoryValuation={inventoryValuation} staleProducts={staleProducts} />
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