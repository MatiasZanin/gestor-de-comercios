export interface Product {
  PK: string;
  SK: string;
  commerceId: string;
  code: string;
  name: string;
  priceBuy: number;
  priceSale: number;
  notes?: string;
  stock: number;
  unitsSold: number;
  revenue: number;
  profit: number;
  createdAt: string;
  updatedAt: string;
  uom: string;
  isActive: boolean;
  qtyStep: number;
}
