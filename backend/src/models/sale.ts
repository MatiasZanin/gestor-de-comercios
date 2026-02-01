export interface SaleItem {
  code: string;
  name: string;
  qty: number;
  priceBuy?: number;
  priceSale: number;
  profit?: number;
  uom: string;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';

export interface Sale {
  PK: string;
  SK: string;
  saleId: string;
  commerceId: string;
  sellerId: string;
  createdAt: string;
  day: string;
  ttl: number;
  items: SaleItem[];
  total: number;
  notes?: string;
  profit?: number;
  paymentMethod?: PaymentMethod;
  GSI1PK?: string;
  GSI1SK?: string;
}
