"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, Label } from "recharts";
import { Wallet, CreditCard, ArrowRightLeft, History } from "lucide-react";
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
import { DailySummary } from "./types";
import { getPaymentMethodComposition, mockCashClosures } from "./mock-data";

interface FinanceTabProps {
    dailySummaries: DailySummary[];
}

const paymentChartConfig = {
    efectivo: {
        label: "Efectivo",
        color: "#22c55e",
    },
    tarjeta: {
        label: "Tarjeta",
        color: "#3b82f6",
    },
    transferencia: {
        label: "Transferencia",
        color: "#f59e0b",
    },
} satisfies ChartConfig;

export function FinanceTab({ dailySummaries }: FinanceTabProps) {
    const paymentData = useMemo(() => {
        return getPaymentMethodComposition(dailySummaries);
    }, [dailySummaries]);

    const totalIncome = useMemo(() => {
        return paymentData.reduce((sum, item) => sum + item.value, 0);
    }, [paymentData]);

    const paymentIcons = {
        Efectivo: Wallet,
        Tarjeta: CreditCard,
        Transferencia: ArrowRightLeft,
    };

    return (
        <div className="space-y-6">
            {/* Payment Method KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {paymentData.map((method) => {
                    const Icon = paymentIcons[method.name as keyof typeof paymentIcons];
                    const percentage = ((method.value / totalIncome) * 100).toFixed(1);

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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Donut Chart */}
                <Card className="border-0 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                            <Wallet className="h-5 w-5 text-emerald-600" />
                            Composición de Ingresos
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
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
                                                            ${(totalIncome / 1000000).toFixed(1)}M
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
                        {/* Legend */}
                        <div className="flex justify-center gap-6 mt-4">
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

                {/* Cash Closures History */}
                <Card className="border-0 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                            <History className="h-5 w-5 text-blue-600" />
                            Historial de Cierres de Caja
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead className="text-right">Tickets</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="text-right">Usuario</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mockCashClosures.map((closure) => {
                                        const date = new Date(closure.closedAt);
                                        const formattedDate = date.toLocaleDateString("es-AR", {
                                            day: "2-digit",
                                            month: "2-digit",
                                        });
                                        const formattedTime = date.toLocaleTimeString("es-AR", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        });

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
                                                <TableCell className="text-right">
                                                    {closure.ticketCount}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold text-emerald-600">
                                                    ${closure.total.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                        {closure.closedBy}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
