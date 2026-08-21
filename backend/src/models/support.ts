export const SUPPORT_PROBLEM_TYPES = [
  'PRODUCTS',
  'SALES',
  'USERS',
  'CLOSURES',
  'OFFERS',
  'OTHER',
] as const;

export type SupportProblemType = (typeof SUPPORT_PROBLEM_TYPES)[number];

export const SUPPORT_PROBLEM_TYPE_LABELS: Record<SupportProblemType, string> = {
  PRODUCTS: 'Productos',
  SALES: 'Ventas',
  USERS: 'Usuarios',
  CLOSURES: 'Cierres',
  OFFERS: 'Ofertas',
  OTHER: 'Otros',
};

export interface CreateSupportRequest {
  title: string;
  problemType: SupportProblemType;
  phone?: string;
  saleTicketNumber?: string;
  productCode?: string;
  description: string;
}

export interface SupportRequestActor {
  sub: string;
  email: string;
  role?: string;
}

export interface SupportRequestResponse {
  message: string;
  sentAt: string;
}
