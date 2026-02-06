export interface CashClose {
    PK: string; // COM#{commerceId}
    SK: string; // CLOSE#{isoDate}#{uuid}
    GSI1PK: string; // COM#{commerceId}#{day}
    GSI1SK: string; // {isoDate}
    closureId: string;
    commerceId: string;
    userId: string;
    openedAt: string; // Last closure date or start of day (00:00:00)
    closedAt: string; // Current ISO date
    systemTotalCash: number;
    systemTotalCard: number;
    systemTotalTransfer: number;
    systemTotalOther: number;
    declaredCash: number;
    expenses: number;
    initialFund: number;
    difference: number; // declaredCash - (systemTotalCash - expenses + initialFund)
    notes?: string;
}

export interface CreateCashCloseRequest {
    declaredCash: number;
    expenses: number;
    initialFund: number;
    notes?: string;
}
