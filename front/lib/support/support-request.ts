import { z } from "zod";

export const SUPPORT_PROBLEM_TYPES = [
  "PRODUCTS",
  "SALES",
  "USERS",
  "CLOSURES",
  "OFFERS",
  "OTHER",
] as const;

export type SupportProblemType = (typeof SUPPORT_PROBLEM_TYPES)[number];

export const SUPPORT_PROBLEM_TYPE_LABELS: Record<SupportProblemType, string> = {
  PRODUCTS: "Productos",
  SALES: "Ventas",
  USERS: "Usuarios",
  CLOSURES: "Cierres",
  OFFERS: "Ofertas",
  OTHER: "Otros",
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `No puede superar los ${max} caracteres`)
    .optional();

export const supportRequestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Ingresá un título de al menos 3 caracteres")
    .max(120, "El título no puede superar los 120 caracteres"),
  problemType: z.enum(SUPPORT_PROBLEM_TYPES, {
    required_error: "Seleccioná un tipo de problema",
  }),
  phone: optionalText(30).refine(
    (value) =>
      !value ||
      (/^[+\d\s().-]+$/.test(value) && value.replace(/\D/g, "").length >= 6),
    "Ingresá un número de teléfono válido",
  ),
  saleTicketNumber: optionalText(100),
  productCode: optionalText(100),
  description: z
    .string()
    .trim()
    .min(20, "Describí el problema con al menos 20 caracteres")
    .max(5000, "La descripción no puede superar los 5000 caracteres"),
});

export type SupportRequestFormValues = z.infer<typeof supportRequestSchema>;
