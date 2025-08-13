/**
 * Funciones de acceso a la API backend. Estas funciones encapsulan
 * llamadas HTTP a los endpoints definidos en el backend y devuelven
 * los resultados tipados.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// Tipo para producto simplificado en frontend
export interface Product {
  code: string;
  name: string;
  priceBuy?: number;
  priceSale: number;
  notes?: string;
  stock: number;
  unitsSold: number;
  revenue: number;
  profit?: number;
  uom: string;
  isActive: boolean;
  qtyStep: number;
}

export interface SaleItem {
  code: string;
  name: string;
  qty: number;
  priceBuy?: number;
  priceSale: number;
  profit?: number;
}

export interface Sale {
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
}

interface ListResponse<T> {
  items: T[];
  lastKey?: string;
}

function buildHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchProducts(
  commerceId: string,
  token: string,
  options: { isActive?: boolean; lastKey?: string } = {},
): Promise<ListResponse<Product>> {
  const url = new URL(`${API_BASE}/${commerceId}/products`);
  if (options.isActive !== undefined) {
    url.searchParams.set('isActive', String(options.isActive));
  }
  if (options.lastKey) {
    url.searchParams.set('lastKey', options.lastKey);
  }
  const res = await fetch(url.toString(), {
    headers: buildHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Error fetching products: ${res.status}`);
  }
  return res.json();
}

export async function createProduct(
  commerceId: string,
  token: string,
  product: Omit<Product, 'stock' | 'unitsSold' | 'revenue' | 'profit'>,
): Promise<Product> {
  const url = `${API_BASE}/${commerceId}/products`;
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(product),
  });
  if (!res.ok) {
    throw new Error(`Error creating product: ${res.status}`);
  }
  return res.json();
}

export async function updateProduct(
  commerceId: string,
  code: string,
  token: string,
  updates: Partial<Omit<Product, 'code' | 'stock' | 'unitsSold' | 'revenue' | 'profit'>>,
): Promise<Product> {
  const url = `${API_BASE}/${commerceId}/products/${code}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: buildHeaders(token),
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    throw new Error(`Error updating product: ${res.status}`);
  }
  return res.json();
}

export async function fetchSales(
  commerceId: string,
  token: string,
  options: { day?: string; start?: string; end?: string; lastKey?: string } = {},
): Promise<ListResponse<Sale>> {
  const url = new URL(`${API_BASE}/${commerceId}/sales`);
  if (options.day) {
    url.searchParams.set('day', options.day);
  }
  if (options.start) {
    url.searchParams.set('start', options.start);
  }
  if (options.end) {
    url.searchParams.set('end', options.end);
  }
  if (options.lastKey) {
    url.searchParams.set('lastKey', options.lastKey);
  }
  const res = await fetch(url.toString(), {
    headers: buildHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Error fetching sales: ${res.status}`);
  }
  return res.json();
}

export async function createSale(
  commerceId: string,
  token: string,
  sale: { items: SaleItem[]; notes?: string },
): Promise<Sale> {
  const url = `${API_BASE}/${commerceId}/sales`;
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(sale),
  });
  if (!res.ok) {
    throw new Error(`Error creating sale: ${res.status}`);
  }
  return res.json();
}

export async function getDailyReport(
  commerceId: string,
  token: string,
  day: string,
  orderBy: 'units' | 'revenue' | 'profit' = 'units',
): Promise<any> {
  const url = new URL(`${API_BASE}/${commerceId}/reports/daily`);
  url.searchParams.set('day', day);
  url.searchParams.set('orderBy', orderBy);
  const res = await fetch(url.toString(), {
    headers: buildHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Error fetching daily report: ${res.status}`);
  }
  return res.json();
}

export async function getRangeReport(
  commerceId: string,
  token: string,
  start: string,
  end: string,
  orderBy: 'units' | 'revenue' | 'profit' = 'units',
): Promise<any> {
  const url = new URL(`${API_BASE}/${commerceId}/reports/range`);
  url.searchParams.set('start', start);
  url.searchParams.set('end', end);
  url.searchParams.set('orderBy', orderBy);
  const res = await fetch(url.toString(), {
    headers: buildHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`Error fetching range report: ${res.status}`);
  }
  return res.json();
}