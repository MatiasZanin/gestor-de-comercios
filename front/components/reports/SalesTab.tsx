"use client";

import { useMemo } from "react";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    XAxis,
    YAxis,
} from "recharts";
import { TrendingUp, Clock, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

// Interfaces basadas en la respuesta real de la API
export interface DailySummaryItem {
    date: string; // YYYY-MM-DD
    totalDay: number;
    txCount: number;
    // Horas dinámicas
    [key: string]: any;
}

export interface RankingItem {
    code: string;
    name: string;
    monthlyUnits: number;
    priceSale?: number;
}

interface SalesTabProps {
    dailySummaries: DailySummaryItem[];
    topProducts: RankingItem[];
}

const salesChartConfig = {
    ventas: {
        label: "Ventas",
        color: "#10b981",
    },
} satisfies ChartConfig;

const peakHoursConfig = {
    tickets: {
        label: "Tickets",
        color: "#f59e0b",
    },
} satisfies ChartConfig;

export function SalesTab({ dailySummaries, topProducts }: SalesTabProps) {
    const formatDateLabel = (dateStr: string) => {
        const date = new Date(dateStr + "T12:00:00")
        return date.toLocaleDateString("es-ES", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    }

    // 1. Preparar datos para el gráfico de líneas (Evolución)
    const salesData = useMemo(() => {
        return dailySummaries.map((day) => {
            // Extraer fecha del SK si viene como "SUMMARY#2023-10-27" o usar campo date
            // Asumimos que tu endpoint devuelve el item limpio o con un campo 'date' inyectado
            // Si el backend devuelve items crudos SUMMARY, la fecha está en el SK.
            // Para simplificar, asumiremos que el backend devuelve items ordenados.
            let dateLabel = day.SK?.replace("SUMMARY#", "") || day.date;
            dateLabel = formatDateLabel(dateLabel);

            return {
                date: dateLabel,
                ventas: day.totalDay || 0,
            };
        });
    }, [dailySummaries]);


    // 2. Calcular datos para el Mapa de Calor (Sumar h00...h23)
    const peakHoursData = useMemo(() => {
        const hoursMap = new Array(24).fill(0);

        dailySummaries.forEach((day) => {
            for (let i = 0; i < 24; i++) {
                const hourKey = `h${i.toString().padStart(2, '0')}`; // h09, h10...
                if (day[hourKey]) {
                    hoursMap[i] += day[hourKey];
                }
            }
        });

        return hoursMap.map((count, index) => ({
            hour: `${index.toString().padStart(2, '0')}:00`,
            tickets: count,
        }));
    }, [dailySummaries]);

    // 3. KPIs Generales
    const totalSales = useMemo(() => {
        return dailySummaries.reduce((sum, day) => sum + (day.totalDay || 0), 0);
    }, [dailySummaries]);

    const totalTickets = useMemo(() => {
        return dailySummaries.reduce((sum, day) => sum + (day.txCount || 0), 0);
    }, [dailySummaries]);

    const avgDailySales = useMemo(() => {
        if (dailySummaries.length === 0) return 0;
        return Math.round(totalSales / dailySummaries.length);
    }, [totalSales, dailySummaries.length]);

    return (
        <div className="space-y-6">
            {/* KPI Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-100">
                                <TrendingUp className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Ventas Totales</p>
                                <p className="text-xl font-bold text-gray-900">
                                    ${totalSales.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-white">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100">
                                <Clock className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Promedio Diario</p>
                                <p className="text-xl font-bold text-gray-900">
                                    ${avgDailySales.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm bg-gradient-to-br from-orange-50 to-white">
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-orange-100">
                                <Trophy className="h-5 w-5 text-orange-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Total Tickets</p>
                                <p className="text-xl font-bold text-gray-900">
                                    {totalTickets}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Sales Trend Chart */}
            <Card className="border-0 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                        Evolución de Ventas
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={salesChartConfig} className="h-[300px] w-full">
                        <AreaChart data={salesData} margin={{ left: 12, right: 12 }}>
                            <defs>
                                <linearGradient id="fillVentas" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                fontSize={12}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                fontSize={12}
                                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                            />
                            <ChartTooltip
                                content={
                                    <ChartTooltipContent
                                        formatter={(value) => `$${Number(value).toLocaleString()}`}
                                    />
                                }
                            />
                            <Area
                                dataKey="ventas"
                                type="monotone"
                                fill="url(#fillVentas)"
                                stroke="#10b981"
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            {/* Bottom Row: Peak Hours + Top Products */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Peak Hours Chart */}
                <Card className="border-0 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                            <Clock className="h-5 w-5 text-orange-600" />
                            Horarios Pico
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={peakHoursConfig} className="h-[250px] w-full">
                            <BarChart data={peakHoursData} margin={{ left: 0, right: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="hour"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    fontSize={10}
                                    interval={2}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    fontSize={12}
                                />
                                <ChartTooltip
                                    content={<ChartTooltipContent />}
                                />
                                <Bar
                                    dataKey="tickets"
                                    fill="#f59e0b"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>

                {/* Top Products Table */}
                <Card className="border-0 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                            <Trophy className="h-5 w-5 text-yellow-600" />
                            Top 5 Productos del Mes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-right">Unidades</TableHead>
                                    <TableHead className="text-right">Precio Actual</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {topProducts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                                            Sin datos de ventas en este periodo
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    topProducts.slice(0, 5).map((product, index) => (
                                        <TableRow key={product.code}>
                                            <TableCell>
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? "bg-yellow-100 text-yellow-700" :
                                                    index === 1 ? "bg-gray-100 text-gray-600" :
                                                        index === 2 ? "bg-orange-100 text-orange-700" :
                                                            "bg-gray-50 text-gray-500"
                                                    }`}>
                                                    {index + 1}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">{product.name}</TableCell>
                                            <TableCell className="text-right font-semibold text-emerald-600">
                                                {product.monthlyUnits}
                                            </TableCell>
                                            <TableCell className="text-right text-gray-600">
                                                ${(product.priceSale || 0).toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}