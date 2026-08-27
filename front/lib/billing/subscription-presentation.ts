import type { PublicBillingConfig, SubscriptionViewState } from "@/lib/types/api"

export const subscriptionStatePresentation: Record<SubscriptionViewState, { label: string; badgeClass: string }> = {
  never_subscribed: { label: "Sin suscripción", badgeClass: "bg-gray-100 text-gray-700 hover:bg-gray-100" },
  checkout_pending: { label: "Suscripción pendiente", badgeClass: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  trial_active: { label: "Prueba gratuita activa", badgeClass: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  active: { label: "Suscripción activa", badgeClass: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  cancellation_scheduled: { label: "Cancelación programada", badgeClass: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  cancelled: { label: "Suscripción cancelada", badgeClass: "bg-gray-100 text-gray-700 hover:bg-gray-100" },
  expired: { label: "Suscripción vencida", badgeClass: "bg-gray-100 text-gray-700 hover:bg-gray-100" },
  payment_pending: { label: "Pago pendiente", badgeClass: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  payment_rejected: { label: "Pago rechazado", badgeClass: "bg-red-100 text-red-800 hover:bg-red-100" },
}

export const relevantDateLabels = {
  trial_ends: "La prueba finaliza",
  renews: "Próximo vencimiento",
  access_until: "Acceso disponible hasta",
  grace_until: "Período de gracia hasta",
  ended: "Finalizó el",
} as const

export function formatArgentinaDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Fecha no disponible"
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date)
}

export function formatBillingPrice(config: PublicBillingConfig): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: config.currencyId,
    maximumFractionDigits: 0,
  }).format(config.monthlyAmount)
}

export function trialPromotion(config: PublicBillingConfig): string {
  const price = formatBillingPrice(config)
  return `Probá Gestión & Stock gratis durante ${config.trialDays} días si sos elegible. Para comenzar, autorizá un medio de pago en Mercado Pago; al terminar la prueba, se cobrará ${price} por mes hasta que canceles.`
}
