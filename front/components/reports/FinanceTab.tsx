"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, Label } from "recharts";
import { Wallet, CreditCard, ArrowRightLeft, History, AlertCircle } from "lucide-react";
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
import { DailySummaryItem, CashClosureItem } from "./types";

interface FinanceTabProps {
    dailySummaries: DailySummaryItem[];
    closures: CashClosureItem[];
}

const paymentChartConfig = {
    efectivo: {
        label: "Efectivo",
        color: "#22c55e", // green-500
    },
    tarjeta: {
        label: "Tarjeta",
        color: "#3b82f6", // blue-500
    },
    transferencia: {
        label: "Transferencia",
        color: "#f59e0b", // amber-500
    },
    otros: {
        label: "Otros",
        color: "#94a3b8", // slate-400
    }
} satisfies ChartConfig;

export function FinanceTab({ dailySummaries, closures }: FinanceTabProps) {
    // 1. Calcular composición de pagos sumando todos los días del rango
    const paymentData = useMemo(() => {
        let cash = 0;
        let card = 0;
        let transfer = 0;
        let other = 0;

        dailySummaries.forEach(day => {
            // Asumiendo que createSale guarda: method_CASH, method_CARD, etc.
            cash += day.method_CASH || 0;
            card += day.method_CARD || 0;
            transfer += day.method_TRANSFER || 0;
            other += day.method_OTHER || 0;
        });

        const data = [
            { name: "Efectivo", value: cash, fill: "#22c55e" },
            { name: "Tarjeta", value: card, fill: "#3b82f6" },
            { name: "Transferencia", value: transfer, fill: "#f59e0b" },
        ];

        // Solo agregar "Otros" si tiene valor para no ensuciar el gráfico
        if (other > 0) {
            data.push({ name: "Otros", value: other, fill: "#94a3b8" });
        }

        return data;
    }, [dailySummaries]);

    const totalIncome = useMemo(() => {
        return paymentData.reduce((sum, item) => sum + item.value, 0);
    }, [paymentData]);

    const paymentIcons: Record<string, any> = {
        Efectivo: Wallet,
        Tarjeta: CreditCard,
        Transferencia: ArrowRightLeft,
        Otros: AlertCircle
    };

    return (
        <div className="space-y-6">
            {/* KPIs Métodos de Pago */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {paymentData.map((method) => {
                    const Icon = paymentIcons[method.name] || Wallet;
                    const percentage = totalIncome > 0
                        ? ((method.value / totalIncome) * 100).toFixed(1)
                        : "0.0";

                    return (
                        <Card
                            key={method.name}
                            className="border-0 shadow-sm"
                            style={{
                                background: `linear-gradient(to bottom right, ${method.fill}10, white)`,
                            }}
                        >
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="p-2 rounded-lg"
                                        style={{ backgroundColor: `${method.fill}20` }}
                                    >
                                        <Icon className="h-5 w-5" style={{ color: method.fill }} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-gray-600">{method.name}</p>
                                        <p className="text-xl font-bold text-gray-900">
                                            ${method.value.toLocaleString()}
                                        </p>
                                    </div>
                                    <div
                                        className="px-2 py-1 rounded-full text-xs font-semibold"
                                        style={{
                                            backgroundColor: `${method.fill}20`,
                                            color: method.fill,
                                        }}
                                    >
                                        {percentage}%
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
                <Card
                    key={"total"}
                    className="border-0 shadow-sm"
                    style={{
                        background: `linear-gradient(to bottom right, #0f172a10, white)`, // Slate-900 al 10%
                    }}
                >
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-3">
                            <div
                                className="p-2 rounded-lg"
                                style={{ backgroundColor: `#0f172a20` }} // Slate-900 al 20%
                            >
                                <Wallet className="h-5 w-5" style={{ color: "#0f172a" }} />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-gray-600">Total</p>
                                <p className="text-xl font-bold text-slate-900">
                                    ${totalIncome.toLocaleString()}
                                </p>
                            </div>
                            <div
                                className="px-2 py-1 rounded-full text-xs font-semibold"
                                style={{
                                    backgroundColor: `#0f172a20`,
                                    color: "#0f172a",
                                }}
                            >
                                100%
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico de Torta */}
                <Card className="border-0 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                            <Wallet className="h-5 w-5 text-emerald-600" />
                            Composición de Ingresos
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {totalIncome > 0 ? (
                            <ChartContainer
                                config={paymentChartConfig}
                                className="mx-auto aspect-square max-h-[300px]"
                            >
                                <PieChart>
                                    <ChartTooltip
                                        content={
                                            <ChartTooltipContent
                                                formatter={(value) => `$${Number(value).toLocaleString()}`}
                                            />
                                        }
                                    />
                                    <Pie
                                        data={paymentData}
                                        dataKey="value"
                                        nameKey="name"
                                        innerRadius={70}
                                        outerRadius={110}
                                        strokeWidth={3}
                                        stroke="#fff"
                                    >
                                        {paymentData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                        <Label
                                            content={({ viewBox }) => {
                                                if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                                    return (
                                                        <text
                                                            x={viewBox.cx}
                                                            y={viewBox.cy}
                                                            textAnchor="middle"
                                                            dominantBaseline="middle"
                                                        >
                                                            <tspan
                                                                x={viewBox.cx}
                                                                y={viewBox.cy}
                                                                className="fill-gray-900 text-2xl font-bold"
                                                            >
                                                                ${(totalIncome / 1000).toFixed(0)}k
                                                            </tspan>
                                                            <tspan
                                                                x={viewBox.cx}
                                                                y={(viewBox.cy || 0) + 24}
                                                                className="fill-gray-500 text-sm"
                                                            >
                                                                Total
                                                            </tspan>
                                                        </text>
                                                    );
                                                }
                                            }}
                                        />
                                    </Pie>
                                </PieChart>
                            </ChartContainer>
                        ) : (
                            <div className="flex h-[300px] items-center justify-center text-gray-400">
                                No hay datos de ingresos en este periodo
                            </div>
                        )}

                        {/* Legend */}
                        <div className="flex justify-center gap-6 mt-4 flex-wrap">
                            {paymentData.map((method) => (
                                <div key={method.name} className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: method.fill }}
                                    />
                                    <span className="text-sm text-gray-600">{method.name}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Historial de Cierres */}
                <Card className="border-0 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                            <History className="h-5 w-5 text-blue-600" />
                            Últimos Cierres de Caja
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead className="text-right">Sistema</TableHead>
                                        <TableHead className="text-right">Declarado</TableHead>
                                        <TableHead className="text-right">Dif.</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {closures.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                                No hay cierres registrados
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        closures.slice(0, 10).map((closure) => {
                                            const date = new Date(closure.closedAt);
                                            const formattedDate = date.toLocaleDateString("es-AR", {
                                                day: "2-digit",
                                                month: "2-digit",
                                            });
                                            const formattedTime = date.toLocaleTimeString("es-AR", {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            });

                                            // Calcular total sistema (suma de medios de pago)
                                            const totalSystem =
                                                (closure.systemTotalCash || 0) +
                                                (closure.systemTotalCard || 0) +
                                                (closure.systemTotalTransfer || 0);

                                            return (
                                                <TableRow key={closure.closureId}>
                                                    <TableCell>
                                                        <div>
                                                            <span className="font-medium">{formattedDate}</span>
                                                            <span className="text-gray-500 text-sm ml-2">
                                                                {formattedTime}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right text-gray-600">
                                                        ${totalSystem.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        ${(closure.declaredCash || 0).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${closure.difference === 0
                                                            ? "bg-green-100 text-green-700"
                                                            : "bg-red-100 text-red-700"
                                                            }`}>
                                                            {closure.difference > 0 ? "+" : ""}
                                                            ${closure.difference.toLocaleString()}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}