export interface SaleItem {
  code: string;
  name: string;
  qty: number;
  priceBuy?: number;
  priceSale: number;
  profit?: number;
  uom: string;
  originalPrice?: number;      // Precio original antes del descuento
  discountApplied?: number;    // Monto de descuento por unidad
  offerId?: string;            // ID de la oferta aplicada
  offerName?: string;          // Nombre de la oferta aplicada
  brand?: string;
  category?: string;
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
