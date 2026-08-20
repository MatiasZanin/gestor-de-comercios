import { z } from "zod"

export const mercadoPagoEmailSchema = z.string().trim().email("Ingresá un email válido")

export const cancellationReasonSchema = z.string()
  .transform((value) => value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1, "Contanos brevemente por qué cancelás").max(1000, "El motivo no puede superar los 1000 caracteres"))

