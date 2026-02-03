import {
    DailySummary,
    RestockAlert,
    MonthlyRanking,
    CashClosure,
    InventoryValuation,
    StaleProduct,
} from "./types";

// Generate 30 days of sales data for trend chart
export const generateDailySummaries = (): DailySummary[] => {
    const summaries: DailySummary[] = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];

        // Random data with weekday patterns (weekends have more sales)
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const baseTickets = isWeekend ? 45 : 30;
        const ticketCount = baseTickets + Math.floor(Math.random() * 20);
        const avgTicket = 2500 + Math.floor(Math.random() * 1500);
        const totalSales = ticketCount * avgTicket;

        // Payment method distribution
        const cashRatio = 0.5 + Math.random() * 0.1;
        const cardRatio = 0.3 + Math.random() * 0.1;
        const transferRatio = 1 - cashRatio - cardRatio;

        // Hourly distribution (peak at 12-14 and 18-20)
        const byHour: Record<string, number> = {};
        for (let h = 0; h < 24; h++) {
            const hourKey = h.toString().padStart(2, "0");
            let hourTickets = 0;
            if (h >= 9 && h <= 21) {
                hourTickets = Math.floor(Math.random() * 5) + 1;
                if (h >= 12 && h <= 14) hourTickets += 3;
                if (h >= 18 && h <= 20) hourTickets += 4;
            }
            byHour[hourKey] = hourTickets;
        }

        summaries.push({
            date: dateStr,
            ticketCount,
            totalSales,
            byPaymentMethod: {
                efectivo: Math.round(totalSales * cashRatio),
                tarjeta: Math.round(totalSales * cardRatio),
                transferencia: Math.round(totalSales * transferRatio),
            },
            byHour,
        });
    }

    return summaries;
};

// Peak hours data aggregated
export const generatePeakHoursData = (summaries: DailySummary[]) => {
    const hourlyTotals: Record<string, number> = {};

    for (let h = 0; h < 24; h++) {
        const hourKey = h.toString().padStart(2, "0");
        hourlyTotals[hourKey] = 0;
    }

    summaries.forEach((day) => {
        Object.entries(day.byHour).forEach(([hour, count]) => {
            hourlyTotals[hour] = (hourlyTotals[hour] || 0) + count;
        });
    });

    return Object.entries(hourlyTotals).map(([hour, count]) => ({
        hour: `${hour}:00`,
        tickets: count,
    }));
};

// Top 5 products mock data
export const mockTopProducts: MonthlyRanking[] = [
    { code: "7790001234567", name: "Coca Cola 500ml", uom: "UN", priceSale: 1500, monthlyUnits: 342 },
    { code: "7790009876543", name: "Pan Lactal Bimbo", uom: "UN", priceSale: 2800, monthlyUnits: 287 },
    { code: "7791234567890", name: "Leche La Serenísima 1L", uom: "UN", priceSale: 1200, monthlyUnits: 256 },
    { code: "PROD-001", name: "Yerba Mate Cruz de Malta 1kg", uom: "UN", priceSale: 4500, monthlyUnits: 198 },
    { code: "PROD-002", name: "Galletitas Oreo x3", uom: "UN", priceSale: 1800, monthlyUnits: 175 },
];

// Restock alerts mock data
export const mockRestockAlerts: RestockAlert[] = [
    { code: "7790001234567", name: "Coca Cola 500ml", stock: 3, minStock: 10, alertStatus: "LOW" },
    { code: "PROD-003", name: "Aceite Natura 1.5L", stock: 2, minStock: 8, alertStatus: "LOW" },
    { code: "PROD-004", name: "Azúcar Ledesma 1kg", stock: 5, minStock: 15, alertStatus: "LOW" },
    { code: "PROD-005", name: "Harina 0000 Cañuelas 1kg", stock: 4, minStock: 12, alertStatus: "LOW" },
    { code: "PROD-006", name: "Fideos Matarazzo 500g", stock: 6, minStock: 20, alertStatus: "LOW" },
];

// Inventory valuation mock
export const mockInventoryValuation: InventoryValuation = {
    totalCostPrice: 2450000,
    totalSalePrice: 3675000,
};

// Stale products (no movement)
export const mockStaleProducts: StaleProduct[] = [
    { code: "PROD-OLD-001", name: "Conserva de Durazno Premium", stock: 12, lastSaleDate: "2025-11-15", daysWithoutSale: 80 },
    { code: "PROD-OLD-002", name: "Vino Tinto Reserva 750ml", stock: 8, lastSaleDate: "2025-12-01", daysWithoutSale: 64 },
    { code: "PROD-OLD-003", name: "Sardinas en Aceite", stock: 24, lastSaleDate: "2025-12-10", daysWithoutSale: 55 },
    { code: "PROD-OLD-004", name: "Mermelada de Higo", stock: 6, lastSaleDate: "2025-12-20", daysWithoutSale: 45 },
    { code: "PROD-OLD-005", name: "Aceitunas Negras 500g", stock: 15, lastSaleDate: "2026-01-05", daysWithoutSale: 29 },
];

// Cash closure history mock
export const mockCashClosures: CashClosure[] = [
    {
        closureId: "CLOSE-20260203-001",
        closedAt: "2026-02-03T22:15:00",
        ticketCount: 42,
        totalCash: 65000,
        totalCard: 43000,
        totalTransfer: 18000,
        total: 126000,
        closedBy: "admin",
    },
    {
        closureId: "CLOSE-20260202-001",
        closedAt: "2026-02-02T21:45:00",
        ticketCount: 38,
        totalCash: 58000,
        totalCard: 38000,
        totalTransfer: 22000,
        total: 118000,
        closedBy: "admin",
    },
    {
        closureId: "CLOSE-20260201-001",
        closedAt: "2026-02-01T22:00:00",
        ticketCount: 51,
        totalCash: 72000,
        totalCard: 52000,
        totalTransfer: 28000,
        total: 152000,
        closedBy: "admin",
    },
    {
        closureId: "CLOSE-20260131-001",
        closedAt: "2026-01-31T21:30:00",
        ticketCount: 35,
        totalCash: 48000,
        totalCard: 35000,
        totalTransfer: 15000,
        total: 98000,
        closedBy: "vendedor1",
    },
    {
        closureId: "CLOSE-20260130-001",
        closedAt: "2026-01-30T22:10:00",
        ticketCount: 44,
        totalCash: 62000,
        totalCard: 41000,
        totalTransfer: 19000,
        total: 122000,
        closedBy: "admin",
    },
];

// Payment method composition for donut chart
export const getPaymentMethodComposition = (summaries: DailySummary[]) => {
    const totals = summaries.reduce(
        (acc, day) => ({
            efectivo: acc.efectivo + day.byPaymentMethod.efectivo,
            tarjeta: acc.tarjeta + day.byPaymentMethod.tarjeta,
            transferencia: acc.transferencia + day.byPaymentMethod.transferencia,
        }),
        { efectivo: 0, tarjeta: 0, transferencia: 0 }
    );

    return [
        { name: "Efectivo", value: totals.efectivo, fill: "#22c55e" },
        { name: "Tarjeta", value: totals.tarjeta, fill: "#3b82f6" },
        { name: "Transferencia", value: totals.transferencia, fill: "#f59e0b" },
    ];
};
