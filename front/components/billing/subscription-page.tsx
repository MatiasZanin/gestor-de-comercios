"use client"

import { CancellationDialog } from "@/components/billing/cancellation-dialog"
import { ProductLogo } from "@/components/shared/product-logo"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { formatArgentinaDate, formatBillingPrice, relevantDateLabels, subscriptionStatePresentation } from "@/lib/billing/subscription-presentation"
import { useSubscription } from "@/lib/hooks/use-subscription"
import type { BillingStatusResponse, PublicBillingConfig } from "@/lib/types/api"
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  Check,
  CreditCard,
  Globe2,
  Loader2,
  LockKeyhole,
  Mail,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Store,
  Users,
} from "lucide-react"
import Script from "next/script"
import { useState, type ReactNode } from "react"

const MERCADO_PAGO_SUBSCRIPTIONS_URL = "https://www.mercadopago.com.ar/subscriptions"
const MERCADO_PAGO_BUTTON_SCRIPT = "https://secure.mlstatic.com/mptools/render.js"
const MERCADO_PAGO_LOGO_URL = "https://http2.mlstatic.com/frontend-assets/mp-web-navigation/ui-navigation/7.4.14/mercadopago/logo__large@2x.png"
const resubscribeStates = new Set<BillingStatusResponse["viewState"]>([
  "cancelled", "expired", "payment_rejected",
])

declare global {
  interface Window {
    $MPC?: () => void
  }
}

const benefits = [
  { icon: PackageCheck, text: "Controlá el stock y anticipá faltantes" },
  { icon: BarChart3, text: "Entendé tus ventas con reportes claros" },
  { icon: Store, text: "Gestioná productos, precios y ofertas" },
  { icon: Users, text: "Trabajá con tu equipo y registrá su actividad" },
  { icon: Globe2, text: "Accedé desde cualquier parte del mundo" },
  { icon: Smartphone, text: "Usalo desde cualquier dispositivo" },
]

function MercadoPagoCheckoutButton({
  label,
  loading,
  onActivate,
}: {
  label: string
  loading: boolean
  onActivate: () => void
}) {
  const renderOfficialButton = () => window.$MPC?.()

  return (
    <div className=" text-center" aria-busy={loading}>
      <Script
        src={MERCADO_PAGO_BUTTON_SCRIPT}
        strategy="afterInteractive"
        onLoad={renderOfficialButton}
        onReady={renderOfficialButton}
      />
      <a
        href="#mercado-pago-checkout"
        role="button"
        className="blue-ar-l-rn-aron"
        {...({ name: "MP-payButton", "mp-mode": "dftl" } as Record<string, string>)}
        aria-disabled={loading}
        onClick={(event) => {
          event.preventDefault()
          if (!loading) onActivate()
        }}
      >
        {loading ? "Conectando…" : label}
      </a>
    </div>
  )
}

function MercadoPagoEmailField({
  value,
  ownerEmail,
  onChange,
  disabled,
}: {
  value: string
  ownerEmail: string
  onChange: (value: string) => void
  disabled: boolean
}) {
  const [editing, setEditing] = useState(!value)
  const displayedEmail = value || ownerEmail

  if (!editing && displayedEmail) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Email para Mercado Pago</p>
            <p className="mt-1 truncate text-sm font-medium text-slate-900">{displayedEmail}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setEditing(true)}>
            Cambiar
          </Button>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">Usamos el email del propietario del comercio.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="mercado-pago-email">Email para Mercado Pago</Label>
        {displayedEmail ? (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setEditing(false)}>
            Listo
          </Button>
        ) : null}
      </div>
      <Input
        id="mercado-pago-email"
        type="email"
        autoComplete="email"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder="tu-email@ejemplo.com"
      />
      <p className="text-xs leading-5 text-slate-500">Podés usar un email distinto al de tu cuenta.</p>
    </div>
  )
}

function Price({ config, trialEligible }: { config: PublicBillingConfig; trialEligible: boolean }) {
  const price = formatBillingPrice(config)

  if (trialEligible) {
    return (
      <div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-lg font-medium text-slate-400 line-through decoration-2">{price}</span>
          <span className="text-sm font-medium text-slate-500">por mes</span>
        </div>
        <p className="mt-1 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">1 mes gratis</p>
        <p className="mt-3 text-sm leading-6 text-slate-600">Hoy no pagás nada. Después, {price} por mes.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">{price}</span>
        <span className="pb-1 text-sm font-medium text-slate-500">/ mes</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">Un único plan con todas las herramientas incluidas.</p>
    </div>
  )
}

function SubscriptionOffer({
  status,
  config,
  payerEmail,
  ownerEmail,
  isStarting,
  onEmailChange,
  onSubscribe,
  onContinueCheckout,
}: {
  status: BillingStatusResponse
  config: PublicBillingConfig
  payerEmail: string
  ownerEmail: string
  isStarting: boolean
  onEmailChange: (value: string) => void
  onSubscribe: () => void
  onContinueCheckout: () => void
}) {
  const trialEligible = status.trialEligible
  const checkoutPending = status.viewState === "checkout_pending" && !!status.checkoutUrl
  const label = checkoutPending ? "Continuar en Mercado Pago" : "Suscribirme"
  const statePresentation = subscriptionStatePresentation[status.viewState]
  const showStateNotice = status.viewState !== "never_subscribed" && !checkoutPending

  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] border border-emerald-100 bg-white shadow-[0_24px_80px_-32px_rgba(15,118,110,0.35)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.20),transparent_20%),radial-gradient(circle_at_top_right,rgba(249,115,22,0.13),transparent_46%)]" />
      <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
        <div className="p-6 sm:p-10 lg:p-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            <Check className="h-3.5 w-3.5" />
            Todo tu comercio en un solo lugar
          </div>

          <h2 className="mt-6 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl">
            Comenzá a potenciar tu negocio con
            <span className="mt-2 block"><ProductLogo className="text-[2rem] sm:text-[2.65rem]" /></span>
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
            Tomá mejores decisiones, ahorrá tiempo en las tareas diarias y mantené el control aunque no estés en el local.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {benefits.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/75 p-3 shadow-sm backdrop-blur-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="pt-1 text-sm font-medium leading-5 text-slate-700">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-emerald-100 bg-slate-50/75 p-4 sm:p-8 lg:border-t-0 lg:border-l">
          <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
            <p className="mb-4 text-sm font-semibold text-slate-700">{status.merchantName.trim() || "Tu comercio"}</p>
            {showStateNotice ? (
              <div className={`mb-5 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statePresentation.badgeClass}`}>
                {statePresentation.label}
              </div>
            ) : null}
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Plan mensual</p>
            <div className="mt-4"><Price config={config} trialEligible={trialEligible} /></div>

            {checkoutPending ? (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Tu activación está pendiente. Retomá el proceso donde lo dejaste.
              </div>
            ) : (
              <div className="mt-6">
                <MercadoPagoEmailField
                  value={payerEmail}
                  ownerEmail={ownerEmail}
                  onChange={onEmailChange}
                  disabled={isStarting}
                />
              </div>
            )}

            <div className="mt-5">
              <MercadoPagoCheckoutButton
                label={label}
                loading={isStarting}
                onActivate={checkoutPending ? onContinueCheckout : onSubscribe}
              />
            </div>

            <div className="mt-2 space-y-2 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-600 flex items-center gap-2 justify-center">
              <img src={MERCADO_PAGO_LOGO_URL} alt="Mercado Pago" className="mx-auto mt-1 h-8 w-auto" />

              <div>
                <p className="flex items-start gap-2"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />El alta y los datos de pago se procesan en Mercado Pago.</p>
                <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />Sin permanencia: podés cancelar cuando quieras.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function DetailItem({ icon: Icon, label, children }: { icon: typeof CreditCard; label: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        <Icon className="h-4 w-4 text-emerald-600" />
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{children}</div>
    </div>
  )
}

function SubscriptionDetails({
  status,
  config,
  isCancelling,
  onCancel,
}: {
  status: BillingStatusResponse
  config: PublicBillingConfig
  isCancelling: boolean
  onCancel: () => void
}) {
  const presentation = subscriptionStatePresentation[status.viewState]
  const canCancel = status.viewState === "trial_active" || status.viewState === "active"

  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-xl shadow-slate-200/50">
      <CardHeader className="border-b border-slate-100 bg-[linear-gradient(120deg,rgba(236,253,245,0.9),rgba(255,247,237,0.65))] p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${presentation.badgeClass}`}>{presentation.label}</div>
            <CardTitle className="mt-4 text-2xl text-slate-950">Tu suscripción</CardTitle>
            <CardDescription className="mt-2">Plan de {status.merchantName.trim() || "tu comercio"}, actualizado desde Mercado Pago.</CardDescription>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-2xl font-bold tracking-tight text-slate-950">{formatBillingPrice(config)}</p>
            <p className="text-sm text-slate-500">por mes</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 p-6 sm:p-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem icon={Store} label="Plan"><ProductLogo className="text-lg" /></DetailItem>
          <DetailItem icon={CreditCard} label="Estado">{presentation.label}</DetailItem>
          <DetailItem icon={BarChart3} label="Valor mensual">{formatBillingPrice(config)}</DetailItem>
          {status.relevantDate ? (
            <DetailItem icon={CalendarDays} label={relevantDateLabels[status.relevantDate.kind]}>
              {formatArgentinaDate(status.relevantDate.value)}
            </DetailItem>
          ) : null}
          <DetailItem icon={Mail} label="Email de Mercado Pago">{status.billingPayerEmail || "No informado"}</DetailItem>
          <DetailItem icon={ShieldCheck} label="Cobro">Administrado por Mercado Pago</DetailItem>
        </div>

        {status.viewState === "payment_pending" ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Mercado Pago todavía está procesando el pago. Revisalo allí sin iniciar otra suscripción.</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row">
          <Button asChild className="bg-[#009ee3] text-white hover:bg-[#008ed0]">
            <a href={MERCADO_PAGO_SUBSCRIPTIONS_URL} target="_blank" rel="noopener noreferrer">
              {status.viewState === "payment_pending" ? "Revisar en Mercado Pago" : "Cambiar medio de pago"}
            </a>
          </Button>
          {canCancel ? (
            <Button variant="outline" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={isCancelling} onClick={onCancel}>
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Cancelar suscripción
            </Button>
          ) : null}
        </div>

        <p className="text-xs leading-5 text-slate-500">Gestor de Comercios no almacena datos de tarjeta. Los medios de pago se administran exclusivamente en Mercado Pago.</p>
      </CardContent>
    </Card>
  )
}

export function SubscriptionPage() {
  const subscription = useSubscription()
  const [cancelOpen, setCancelOpen] = useState(false)

  if (subscription.loading) {
    return (
      <div className="space-y-8" aria-label="Cargando suscripción">
        <div className="space-y-2"><Skeleton className="h-9 w-48" /><Skeleton className="h-5 w-72" /></div>
        <Skeleton className="h-[34rem] w-full rounded-[2rem]" />
      </div>
    )
  }

  const status = subscription.status
  const isStarting = subscription.operation === "subscribe"
  const isCancelling = subscription.operation === "cancel"
  const showOffer = !!status && (
    status.viewState === "never_subscribed" ||
    status.viewState === "checkout_pending" ||
    resubscribeStates.has(status.viewState)
  )

  return (
    <div className="space-y-7">
      <header>
        <h1 className="bg-gradient-to-r from-emerald-600 to-orange-500 bg-clip-text text-3xl font-bold text-transparent">Suscripción</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          {showOffer ? "Todo lo que necesitás para gestionar mejor tu comercio." : "Consultá y administrá los datos de tu plan."}
        </p>
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

      {status && subscription.config && showOffer ? (
        <SubscriptionOffer
          status={status}
          config={subscription.config}
          payerEmail={subscription.payerEmail}
          ownerEmail={subscription.ownerEmail}
          isStarting={isStarting}
          onEmailChange={subscription.setPayerEmail}
          onSubscribe={() => void subscription.startSubscription()}
          onContinueCheckout={subscription.continueCheckout}
        />
      ) : null}

      {status && subscription.config && !showOffer ? (
        <SubscriptionDetails
          status={status}
          config={subscription.config}
          isCancelling={isCancelling}
          onCancel={() => setCancelOpen(true)}
        />
      ) : null}

      <CancellationDialog open={cancelOpen} submitting={isCancelling} onOpenChange={setCancelOpen} onConfirm={subscription.cancelSubscription} />
    </div>
  )
}
