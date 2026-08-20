"use client"

import { useState } from "react"
import { AlertCircle, CalendarDays, CreditCard, Loader2, Mail, RefreshCw, Store } from "lucide-react"
import { CancellationDialog } from "@/components/billing/cancellation-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { formatArgentinaDate, relevantDateLabels, subscriptionStatePresentation, trialPromotion } from "@/lib/billing/subscription-presentation"
import { useSubscription } from "@/lib/hooks/use-subscription"
import type { BillingStatusResponse } from "@/lib/types/api"

const MERCADO_PAGO_SUBSCRIPTIONS_URL = "https://www.mercadopago.com.ar/subscriptions"
const resubscribeStates = new Set<BillingStatusResponse["viewState"]>([
  "cancellation_scheduled", "cancelled", "expired", "payment_rejected",
])

function MerchantCard({ merchantName }: { merchantName: string }) {
  return (
    <Card className="border-0 bg-white/80 shadow-lg backdrop-blur-sm">
      <CardContent className="flex items-center gap-4 p-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
          <Store className="h-6 w-6 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold text-gray-900">{merchantName.trim() || "Tu comercio"}</h2>
          <p className="mt-1 text-sm text-gray-600">Gracias por ser parte de Gestión & Stock.</p>
        </div>
      </CardContent>
    </Card>
  )
}

function MercadoPagoEmailField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <div className="max-w-md space-y-2">
      <Label htmlFor="mercado-pago-email">Email de Mercado Pago</Label>
      <Input id="mercado-pago-email" type="email" autoComplete="email" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} placeholder="tu-email@ejemplo.com" />
      <p className="text-xs text-gray-500">Puede ser distinto del email que usás para ingresar.</p>
    </div>
  )
}

export function SubscriptionPage() {
  const subscription = useSubscription()
  const [cancelOpen, setCancelOpen] = useState(false)

  if (subscription.loading) {
    return (
      <div className="space-y-8" aria-label="Cargando suscripción">
        <div className="space-y-2"><Skeleton className="h-9 w-48" /><Skeleton className="h-5 w-72" /></div>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    )
  }

  const status = subscription.status
  const presentation = status ? subscriptionStatePresentation[status.viewState] : null
  const isStarting = subscription.operation === "subscribe"
  const isCancelling = subscription.operation === "cancel"
  const isSubscribed = status?.viewState === "trial_active" || status?.viewState === "active"
  const shouldResubscribe = !!status && resubscribeStates.has(status.viewState)

  return (
    <div className="space-y-8">
      <header>
        <h1 className="bg-gradient-to-r from-emerald-600 to-orange-500 bg-clip-text text-3xl font-bold text-transparent">Suscripción</h1>
        <p className="mt-2 text-sm text-gray-600 sm:text-base">Gestioná tu suscripción al sistema</p>
      </header>

      {subscription.error ? (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="flex flex-col gap-3 text-red-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{subscription.error}</span>
            <Button size="sm" variant="outline" onClick={() => void subscription.refresh()}><RefreshCw className="h-4 w-4" />Reintentar</Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {status ? <MerchantCard merchantName={status.merchantName} /> : null}

      {status && presentation ? (
        <Card className="border-0 bg-white/80 shadow-lg backdrop-blur-sm">
          <CardHeader className="border-b border-gray-100 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1"><CardTitle className="text-xl text-gray-900">Datos de la suscripción</CardTitle><CardDescription>Información actualizada desde Mercado Pago.</CardDescription></div>
            <Badge className={presentation.badgeClass}>{presentation.label}</Badge>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700"><CreditCard className="h-4 w-4 text-emerald-600" />Estado</div>
                <p className="mt-2 font-semibold text-gray-900">{presentation.label}</p>
              </div>
              {status.relevantDate ? (
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700"><CalendarDays className="h-4 w-4 text-emerald-600" />{relevantDateLabels[status.relevantDate.kind]}</div>
                  <p className="mt-2 font-semibold text-gray-900">{formatArgentinaDate(status.relevantDate.value)}</p>
                </div>
              ) : null}
            </div>

            {status.billingPayerEmail ? (
              <div className="flex items-start gap-3 rounded-xl border border-gray-100 p-4"><Mail className="mt-0.5 h-4 w-4 text-emerald-600" /><div><p className="text-sm text-gray-500">Email asociado a Mercado Pago</p><p className="font-medium text-gray-900">{status.billingPayerEmail}</p></div></div>
            ) : null}

            {status.viewState === "never_subscribed" ? (
              <div className="space-y-5">
                <div className="rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">{subscription.config ? trialPromotion(subscription.config) : "Consultando las condiciones de la prueba gratuita..."}</div>
                <MercadoPagoEmailField value={subscription.payerEmail} onChange={subscription.setPayerEmail} disabled={isStarting} />
                <Button disabled={isStarting} onClick={() => void subscription.startSubscription()} className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800">{isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}Iniciar prueba gratuita</Button>
              </div>
            ) : null}

            {status.viewState === "checkout_pending" ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Completá la autorización en Mercado Pago para activar el servicio.</p>
                {status.checkoutUrl ? <Button onClick={subscription.continueCheckout} className="bg-emerald-600 hover:bg-emerald-700"><CreditCard className="h-4 w-4" />Continuar en Mercado Pago</Button> : <><MercadoPagoEmailField value={subscription.payerEmail} onChange={subscription.setPayerEmail} disabled={isStarting} /><Button disabled={isStarting} onClick={() => void subscription.startSubscription()}>Continuar suscripción</Button></>}
              </div>
            ) : null}

            {isSubscribed ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="outline"><a href={MERCADO_PAGO_SUBSCRIPTIONS_URL} target="_blank" rel="noopener noreferrer">Cambiar medio de pago</a></Button>
                <Button variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={isCancelling} onClick={() => setCancelOpen(true)}>Cancelar suscripción</Button>
              </div>
            ) : null}

            {status.viewState === "payment_pending" ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Mercado Pago todavía está procesando el pago. Podés revisar la suscripción allí sin iniciar otra.
                </p>
                <Button asChild variant="outline">
                  <a href={MERCADO_PAGO_SUBSCRIPTIONS_URL} target="_blank" rel="noopener noreferrer">
                    Revisar en Mercado Pago
                  </a>
                </Button>
              </div>
            ) : null}

            {shouldResubscribe ? (
              <div className="space-y-5">
                <div><h3 className="text-lg font-semibold text-gray-900">Volvé a suscribirte</h3><p className="mt-1 text-sm text-gray-600">Retomá el servicio desde el checkout seguro de Mercado Pago.</p></div>
                <MercadoPagoEmailField value={subscription.payerEmail} onChange={subscription.setPayerEmail} disabled={isStarting} />
                <Button disabled={isStarting} onClick={() => void subscription.startSubscription()} className="bg-emerald-600 hover:bg-emerald-700">{isStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}Volver a suscribirme</Button>
              </div>
            ) : null}

            <div className="border-t border-gray-100 pt-4 text-xs leading-5 text-gray-500">Los datos de pago se ingresan y administran exclusivamente en Mercado Pago. Gestión & Stock no almacena datos de tarjeta.</div>
          </CardContent>
        </Card>
      ) : null}

      <CancellationDialog open={cancelOpen} submitting={isCancelling} onOpenChange={setCancelOpen} onConfirm={subscription.cancelSubscription} />
    </div>
  )
}
