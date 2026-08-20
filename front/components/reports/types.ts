// types.ts

// Respuesta de getDailySummary
export interface DailySummaryItem {
    date: string; // "YYYY-MM-DD" o SK: "SUMMARY#..."
    totalDay: number; // Facturación total
    txCount: number;  // Cantidad de tickets
    // Contadores dinámicos de horas (h00...h23) y métodos de pago
    [key: string]: any;
}

export interface DailySummary {
    date: string;
    ticketCount: number;
    totalSales: number;
    byPaymentMethod: { efectivo: number; tarjeta: number; transferencia: number };
    byHour: Record<string, number>;
}

// Respuesta de getRestockAlerts
export interface RestockAlertItem {
    code: string;
    name: string;
    stock: number;
    minStock: number;
    alertStatus: "LOW" | "OK";
}
export type RestockAlert = RestockAlertItem;

// Respuesta de getMonthlyRanking
export interface RankingItem {
    code: string;
    name: string;
    monthlyUnits: number;
    priceSale?: number;
    uom?: string;
}
export type MonthlyRanking = RankingItem;

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

// Respuesta de listClosures
export interface CashClosureItem {
    PK: string;
    SK: string; // CLOSE#...
    closureId: string;
    closedAt: string;
    ticketCount: number; // systemTotalCash + Card + Transfer count? 
    // Nota: Tu lambda closeRegister guarda systemTotalCash/Card/Transfer
    systemTotalCash: number;
    systemTotalCard: number;
    systemTotalTransfer: number;
    declaredCash: number;
    difference: number;
    userId: string;
}

// Para el componente StockTab (Valuación)
// Como aún no tienes endpoint de valuación, lo dejaremos preparado
export interface InventoryValuation {
    totalCost: number;
    totalRetail: number;
    count: number;
    totalCostPrice?: number;
    totalSalePrice?: number;
}

export interface StaleProduct {
    code: string;
    name: string;
    stock: number;
    lastSaleDate: string | null;
    daysWithoutSale: number;
}

// Respuesta de getStaleProducts
export interface DeadStockItem {
    code: string;
    name: string;
    stock: number;
    lastSaleDate: string | null;
}

export interface OverstockItem {
    code: string;
    name: string;
    stock: number;
    lastSaleDate: string | null;
    monthlySales: number;
    coverageMonths: number;
}

export interface StaleProductsResponse {
    deadStock: DeadStockItem[];
    overstock: OverstockItem[];
}
