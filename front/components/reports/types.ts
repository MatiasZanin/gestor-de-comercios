// types.ts

// Respuesta de getDailySummary
export interface DailySummaryItem {
    date: string; // "YYYY-MM-DD" o SK: "SUMMARY#..."
    totalDay: number; // Facturación total
    txCount: number;  // Cantidad de tickets
    // Contadores dinámicos de horas (h00...h23) y métodos de pago
    [key: string]: any;
}

// Respuesta de getRestockAlerts
export interface RestockAlertItem {
    code: string;
    name: string;
    stock: number;
    minStock: number;
    alertStatus: "LOW" | "OK";
}

// Respuesta de getMonthlyRanking
export interface RankingItem {
    code: string;
    name: string;
    monthlyUnits: number;
    priceSale?: number;
    uom?: string;
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
}