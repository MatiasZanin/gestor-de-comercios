// Types for Reports page based on DynamoDB models

// Based on SUMMARY#YYYY-MM-DD from createSale write-time aggregation
export interface DailySummary {
    date: string;
    ticketCount: number;
    totalSales: number;
    byPaymentMethod: {
        efectivo: number;
        tarjeta: number;
        transferencia: number;
    };
    byHour: Record<string, number>; // "00" - "23" -> ticket count
}

// Based on GSI-Stock-Critico (alertStatus = "LOW")
export interface RestockAlert {
    code: string;
    name: string;
    stock: number;
    minStock: number;
    alertStatus: "LOW" | "OK";
}

// Based on GSI-Ranking-Mensual
export interface MonthlyRanking {
    code: string;
    name: string;
    uom: string;
    priceSale: number;
    monthlyUnits: number;
}

// Cash closure record
export interface CashClosure {
    closureId: string;
    closedAt: string;
    ticketCount: number;
    totalCash: number;
    totalCard: number;
    totalTransfer: number;
    total: number;
    closedBy: string;
}

// Inventory valuation
export interface InventoryValuation {
    totalCostPrice: number;
    totalSalePrice: number;
}

// Stale product (no movement)
export interface StaleProduct {
    code: string;
    name: string;
    stock: number;
    lastSaleDate: string | null;
    daysWithoutSale: number;
}

// Date range for filtering
export interface DateRange {
    start: string;
    end: string;
}
