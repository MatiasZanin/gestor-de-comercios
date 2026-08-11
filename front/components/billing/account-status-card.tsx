"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { BillingStatus, PublicBillingConfig, RegistrationStatusResponse } from "@/lib/types/api"
import { getStatusLabel } from "@/lib/api/public"
import { ArrowRight, AlertTriangle, Clock3, RefreshCw, ShieldCheck } from "lucide-react"

interface AccountStatusCardProps {
  status?: RegistrationStatusResponse | null
  config?: PublicBillingConfig | null
  onRetry?: () => void
  onContinue?: () => void
  loading?: boolean
}

function statusTone(status?: BillingStatus | string) {
  switch (status) {
    case "trial":
    case "active":
      return "bg-emerald-50 text-emerald-800 border-emerald-200"
    case "past_due":
      return "bg-amber-50 text-amber-900 border-amber-200"
    case "cancelled":
      return "bg-slate-100 text-slate-700 border-slate-200"
    default:
      return "bg-slate-50 text-slate-700 border-slate-200"
  }
}

export function AccountStatusCard({ status, config, onRetry, onContinue, loading }: AccountStatusCardProps) {
  const billingStatus = status?.billingProfile?.status ?? status?.status
  const title = billingStatus ? getStatusLabel(billingStatus) : "Estado de cuenta"

  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-xl backdrop-blur">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-xl text-slate-950">{title}</CardTitle>
          {billingStatus ? <Badge variant="outline" className={statusTone(billingStatus)}>{getStatusLabel(billingStatus)}</Badge> : null}
        </div>
        <CardDescription className="text-slate-600">
          {billingStatus === "pending_subscription" && "Todavía no está habilitado el acceso. Falta confirmar la suscripción en Mercado Pago."}
          {billingStatus === "trial" && "Tu cuenta está activa con prueba gratuita."}
          {billingStatus === "active" && "La suscripción está activa y el acceso se mantiene normal."}
          {billingStatus === "past_due" && "Hubo un intento de cobro fallido. Revisá tu medio de pago o esperá el fin de la gracia."}
          {billingStatus === "cancelled" && "La suscripción fue cancelada. El acceso termina según el período ya cubierto."}
          {!billingStatus && "Podés revisar el estado del alta o volver a intentarlo."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Info label="Comercio" value={status?.registration?.merchantName ?? status?.billingProfile?.merchantName ?? "-"} />
          <Info label="Email" value={status?.registration?.email ?? status?.billingProfile?.ownerEmail ?? "-"} />
          <Info label="Plan" value={config ? `${config.trialDays} días gratis` : "-"} />
        </div>

        {billingStatus === "pending_subscription" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="flex items-center gap-2 font-medium">
              <Clock3 className="h-4 w-4" />
              Esperando autorización de Mercado Pago
            </div>
            <p className="mt-1 text-amber-900/80">
              Si cerraste la ventana de pago, podés reintentar el alta sin crear otra cuenta.
            </p>
          </div>
        ) : null}

        {billingStatus === "past_due" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              Pago pendiente
            </div>
            <p className="mt-1 text-amber-900/80">
              Si el pago no se regulariza, el backend bloqueará el acceso al terminar la gracia configurada.
            </p>
          </div>
        ) : null}

        {billingStatus === "active" || billingStatus === "trial" ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <div className="flex items-center gap-2 font-medium">
              <ShieldCheck className="h-4 w-4" />
              Acceso habilitado
            </div>
            <p className="mt-1 text-emerald-900/80">
              El backend valida tu estado en cada request protegida.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {onRetry ? (
            <Button onClick={onRetry} variant="outline" disabled={loading}>
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
          ) : null}
          {onContinue ? (
            <Button onClick={onContinue} className="bg-slate-950 text-white hover:bg-slate-800" disabled={loading}>
              <ArrowRight className="h-4 w-4" />
              Continuar
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  )
}
