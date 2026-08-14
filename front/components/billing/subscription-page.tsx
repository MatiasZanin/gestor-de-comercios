"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient } from "@/lib/api/client"
import { getBillingCopy, getPublicBillingConfig } from "@/lib/api/public"
import { authService } from "@/lib/auth/cognito"
import { useAuth } from "@/lib/hooks/use-auth"
import type { BillingStatusResponse, PublicBillingConfig } from "@/lib/types/api"
import { ArrowRight, BadgeCheck, CreditCard, Loader2, RefreshCw, ShieldCheck, Store, Sparkles, AlertTriangle, Clock3 } from "lucide-react"

function formatDate(value?: string) {
  return value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date(value)) : "Sin fecha"
}

function isDateOpen(value?: string) {
  return !!value && new Date(value).getTime() >= Date.now()
}

function getStatusLabel(status?: BillingStatusResponse["status"] | null) {
  switch (status) {
    case "trial":
      return "Prueba activa"
    case "active":
      return "Suscripción activa"
    case "past_due":
      return "Pago pendiente"
    case "cancelled":
      return "Suscripción cancelada"
    case "pending_subscription":
      return "Pendiente de suscripción"
    default:
      return "Sin suscripción"
  }
}

function getStatusTone(status?: BillingStatusResponse["status"] | null) {
  switch (status) {
    case "trial":
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-900"
    case "past_due":
      return "border-amber-200 bg-amber-50 text-amber-900"
    case "cancelled":
    case "pending_subscription":
    default:
      return "border-slate-200 bg-slate-100 text-slate-800"
  }
}

function getStatusCopy(status: BillingStatusResponse | null) {
  if (!status) {
    return {
      title: "Todavía no hay una suscripción activa",
      description: "Podés iniciar el alta o continuar el proceso si quedó pendiente.",
      helper: "Usá el mismo email con el que administrás tu cuenta de Mercado Pago.",
      accessLabel: "Sin acceso",
    }
  }

  const isGraceOpen = status.status === "past_due" && isDateOpen(status.graceUntil)
  const isCoverageOpen = status.status === "cancelled" && isDateOpen(status.currentPeriodEndsAt)

  if (status.status === "trial") {
    return {
      title: "Tu prueba está activa",
      description: "El acceso está habilitado mientras dure el período de prueba.",
      helper: "Si querés pasar al plan pago, podés hacerlo desde esta misma pantalla.",
      accessLabel: "Acceso habilitado",
    }
  }

  if (status.status === "active") {
    return {
      title: "Tu suscripción está al día",
      description: "El acceso al sistema está habilitado y tu comercio sigue activo.",
      helper: "Podés revisar el estado, ir al sistema o cancelar la suscripción cuando quieras.",
      accessLabel: "Acceso habilitado",
    }
  }

  if (status.status === "past_due") {
    return {
      title: isGraceOpen ? "Hubo un problema con el último cobro" : "Tu último cobro quedó pendiente",
      description: isGraceOpen
        ? "El acceso todavía está habilitado por el período de gracia."
        : "El acceso puede estar limitado hasta que vuelvas a suscribirte.",
      helper: "Podés volver a suscribirte ahora mismo sin perder tiempo.",
      accessLabel: isGraceOpen ? "Acceso habilitado" : "Sin acceso",
    }
  }

  if (status.status === "cancelled") {
    return {
      title: isCoverageOpen ? "La suscripción fue cancelada" : "La suscripción ya no está vigente",
      description: isCoverageOpen
        ? "El acceso sigue disponible hasta que venza el período cubierto."
        : "Necesitás volver a suscribirte para recuperar el acceso.",
      helper: "Podés reactivar el servicio desde esta misma pantalla.",
      accessLabel: isCoverageOpen ? "Acceso habilitado" : "Sin acceso",
    }
  }

  if (status.status === "pending_subscription") {
    return {
      title: "El alta quedó pendiente",
      description: status.checkoutUrl
        ? "Podés continuar el proceso de autorización en Mercado Pago."
        : "Podés iniciar la prueba o completar la suscripción desde aquí.",
      helper: status.trialConsumed
        ? "Como la prueba ya fue usada, la reactivación se hace con cobro."
        : "Mientras la cuenta está pendiente, todavía podés iniciar la prueba.",
      accessLabel: "Sin acceso",
    }
  }

  return {
    title: "No pudimos identificar el estado de la suscripción",
    description: "Podés revisar la información y volver a intentar la actualización.",
    helper: "Si el problema continúa, refrescá la página desde el botón de actualizar estado.",
    accessLabel: "Sin acceso",
  }
}

function getPrimaryAction(status: BillingStatusResponse | null) {
  if (!status) {
    return { label: "Iniciar prueba gratuita", isCheckout: false }
  }

  if (status.checkoutUrl && status.status === "pending_subscription") {
    return { label: "Continuar autorización", isCheckout: true }
  }

  if (status.status === "past_due" || status.status === "cancelled") {
    return { label: "Volver a suscribirme", isCheckout: false }
  }

  if (status.status === "pending_subscription") {
    return {
      label: status.trialConsumed ? "Volver a suscribirme" : "Iniciar prueba gratuita",
      isCheckout: false,
    }
  }

  return { label: "Volver a suscribirme", isCheckout: false }
}

export function SubscriptionPage() {
  const { isAuthenticated, loading: authLoading, logout } = useAuth()
  const router = useRouter()
  const [status, setStatus] = useState<BillingStatusResponse | null>(null)
  const [config, setConfig] = useState<PublicBillingConfig | null>(null)
  const [payerEmail, setPayerEmail] = useState("")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (options: { forceRefresh?: boolean } = {}) => {
    try {
      if (options.forceRefresh) {
        authService.markBillingRefresh()
      }
      const [billingStatus, billingConfig] = await Promise.all([
        apiClient.getBillingStatus({ forceRefresh: options.forceRefresh }),
        getPublicBillingConfig(),
      ])
      authService.setBillingStatus(billingStatus)
      setStatus(billingStatus)
      setConfig(billingConfig)
      setPayerEmail(billingStatus?.billingPayerEmail ?? "")
      setError(null)
      if (billingStatus?.status === "trial" || billingStatus?.status === "active") {
        await authService.forceRefreshToken()
      }
    } catch (err: any) {
      setError(err?.message || "No se pudo consultar el estado de la suscripción")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login?next=/dashboard/suscripcion")
      return
    }
    if (!authLoading && isAuthenticated) {
      void load({ forceRefresh: true })
    }
  }, [authLoading, isAuthenticated, load, router])

  const refreshStatus = async () => {
    setLoading(true)
    await load({ forceRefresh: true })
  }

  const subscribe = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const response = await apiClient.createSubscription(payerEmail)
      window.location.assign(response.checkoutUrl)
    } catch (err: any) {
      setError(err?.message || "No se pudo iniciar la suscripción")
      setSubmitting(false)
    }
  }

  const cancel = async () => {
    setSubmitting(true)
    try {
      await apiClient.cancelSubscription()
      await load({ forceRefresh: true })
    } catch (err: any) {
      setError(err?.message || "No se pudo cancelar la suscripción")
    } finally {
      setSubmitting(false)
    }
  }

  const continueCheckout = () => {
    if (status?.checkoutUrl) {
      window.location.assign(status.checkoutUrl)
    }
  }

  const viewCopy = useMemo(() => getStatusCopy(status), [status])
  const primaryAction = useMemo(() => getPrimaryAction(status), [status])
  const mainButtonLabel =
    status?.status === "trial" || status?.status === "active"
      ? "Ir al sistema"
      : primaryAction.label
  const canAccess = !!status && (
    status.status === "trial" ||
    status.status === "active" ||
    (status.status === "past_due" && isDateOpen(status.graceUntil)) ||
    (status.status === "cancelled" && isDateOpen(status.currentPeriodEndsAt))
  )

  if (authLoading || loading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.2),_transparent_38%),linear-gradient(135deg,_#f8fafc_0%,_#fff7ed_100%)]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  const summaryItems = [
    { label: "Prueba", value: formatDate(status?.trialEndsAt), show: !!status?.trialEndsAt },
    { label: "Período vigente", value: formatDate(status?.currentPeriodEndsAt), show: !!status?.currentPeriodEndsAt },
    { label: "Gracia", value: formatDate(status?.graceUntil), show: !!status?.graceUntil },
  ].filter((item) => item.show)

  const showReSubscribe = status?.status === "past_due" || status?.status === "cancelled"
  const isPendingCheckout = status?.status === "pending_subscription" && !!status?.checkoutUrl
  const cardTitle = status?.status === "trial" || status?.status === "active"
    ? "Administrar suscripción"
    : isPendingCheckout
      ? "Continuar autorización"
      : status?.status === "pending_subscription"
        ? status?.trialConsumed
          ? "Volver a suscribirme"
          : "Iniciar prueba gratuita"
        : showReSubscribe || !status
          ? "Volver a suscribirme"
          : "Administrar suscripción"
  const cardDescription = isPendingCheckout
    ? "Seguí en Mercado Pago para completar la suscripción."
    : showReSubscribe
      ? "Podés reactivar el servicio desde esta pantalla."
      : !status
        ? "Completá el alta para empezar a usar el sistema."
        : "Gestioná tu suscripción sin salir del panel."

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.12),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#fff7ed_100%)] px-4 py-8 md:px-6 md:py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-sm font-medium text-emerald-900 shadow-sm">
              <Sparkles className="h-4 w-4" />
              Cuenta y facturación
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
              {status?.merchantName ?? "Tu comercio"}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
              Revisá el estado de tu suscripción, actualizá los datos de Mercado Pago y volvé al sistema cuando esté habilitado.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={refreshStatus} disabled={submitting}>
              <RefreshCw className="h-4 w-4" />
              Actualizar estado
            </Button>
            <Button variant="outline" onClick={() => { logout(); router.push("/login") }}>
              Cerrar sesión
            </Button>
          </div>
        </header>

        {error ? (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
          <Card className="overflow-hidden border-0 bg-slate-950 text-white shadow-2xl shadow-slate-950/20">
            <CardHeader className="relative space-y-4 border-b border-white/10 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_38%),linear-gradient(135deg,_rgba(15,23,42,1)_0%,_rgba(2,6,23,1)_100%)]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-inset ring-emerald-400/20">
                  <Store className="h-7 w-7 text-emerald-300" />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge className={viewCopy.accessLabel === "Acceso habilitado" ? "border-emerald-400/20 bg-emerald-400/15 text-emerald-100" : "border-white/10 bg-white/10 text-white"}>
                    {viewCopy.accessLabel}
                  </Badge>
                  <Badge variant="outline" className={getStatusTone(status?.status)}>
                    {getStatusLabel(status?.status)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3">
                <CardTitle className="text-2xl text-white md:text-3xl">{viewCopy.title}</CardTitle>
                <CardDescription className="max-w-2xl text-slate-300">
                  {viewCopy.description}
                </CardDescription>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                <div className="flex items-center gap-2 font-medium text-white">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  Pagos seguros con Mercado Pago
                </div>
                <p className="mt-2 leading-6">
                  {config ? getBillingCopy(config) : "Cargando condiciones del plan..."}
                </p>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 py-6">
              <div className="grid gap-3 sm:grid-cols-3">
                {summaryItems.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
                    <div className="mt-2 text-sm font-medium text-white">{item.value}</div>
                  </div>
                ))}
                {!summaryItems.length ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300 sm:col-span-3">
                    No hay fechas vigentes para mostrar.
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start gap-3">
                  <BadgeCheck className="mt-0.5 h-5 w-5 text-emerald-300" />
                  <div>
                    <p className="font-medium text-white">Estado actual</p>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{viewCopy.helper}</p>
                  </div>
                </div>
              </div>

              {canAccess ? (
                <Button onClick={() => router.push("/dashboard")} className="w-full bg-emerald-500 text-slate-950 hover:bg-emerald-400">
                  Entrar al sistema
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-slate-200 bg-white/90 shadow-xl shadow-slate-900/5 backdrop-blur">
              <CardHeader className="space-y-3">
                <CardTitle className="text-xl text-slate-950">{cardTitle}</CardTitle>
                <CardDescription className="text-slate-600">{cardDescription}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-5">
                {isPendingCheckout && status?.checkoutUrl ? (
                  <Button size="lg" className="w-full bg-slate-950 text-white hover:bg-slate-800" onClick={continueCheckout}>
                    <CreditCard className="h-4 w-4" />
                    Continuar en Mercado Pago
                  </Button>
                ) : (
                  <>
                    {(status?.status === "pending_subscription" || showReSubscribe || !status) ? (
                      <div className="space-y-2">
                        <Label htmlFor="payerEmail">Email de Mercado Pago</Label>
                        <Input
                          id="payerEmail"
                          type="email"
                          value={payerEmail}
                          onChange={(event) => setPayerEmail(event.target.value)}
                          placeholder="tu-email@ejemplo.com"
                        />
                        <p className="text-xs leading-5 text-slate-500">
                          El correo puede ser distinto al que usás para ingresar al sistema.
                        </p>
                      </div>
                    ) : null}

                    {(status?.status === "trial" || status?.status === "active") && !showReSubscribe ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                        <div className="flex items-center gap-2 font-medium">
                          <ShieldCheck className="h-4 w-4" />
                          Tu acceso está habilitado
                        </div>
                        <p className="mt-1 leading-6">
                          Podés entrar al sistema, revisar tu cuenta o cancelar la suscripción si lo necesitás.
                        </p>
                      </div>
                    ) : null}

                    <Button
                      size="lg"
                      className="w-full bg-slate-950 text-white hover:bg-slate-800"
                      disabled={submitting || (!payerEmail && (status?.status === "pending_subscription" || showReSubscribe || !status))}
                      onClick={status?.status === "trial" || status?.status === "active" ? () => router.push("/dashboard") : subscribe}
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      {mainButtonLabel}
                    </Button>

                    {canAccess && status?.status !== "past_due" && status?.status !== "cancelled" ? (
                      <Button variant="outline" className="w-full" disabled={submitting} onClick={cancel}>
                        Cancelar suscripción
                      </Button>
                    ) : null}
                  </>
                )}

                {status?.status === "past_due" || status?.status === "cancelled" ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <div className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      {status.status === "past_due" ? "Podés volver a suscribirte ahora" : "Podés reactivar tu acceso"}
                    </div>
                    <p className="mt-1 leading-6">
                      {status.status === "past_due"
                        ? "Aunque todavía esté vigente la gracia, la reactivación queda disponible desde este botón."
                        : "Aunque todavía quede período cubierto, la reactivación también está disponible ahora mismo."}
                    </p>
                  </div>
                ) : null}

                {status?.status === "trial" ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <div className="flex items-center gap-2 font-medium">
                      <Clock3 className="h-4 w-4 text-slate-500" />
                      El período de prueba termina el {formatDate(status.trialEndsAt)}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white/80 shadow-lg shadow-slate-900/5">
              <CardHeader>
                <CardTitle className="text-lg text-slate-950">Información útil</CardTitle>
                <CardDescription>Resumen rápido de lo que está pasando con tu cuenta.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <p>El cobro se procesa en Mercado Pago y no guardamos datos de tarjeta.</p>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                  <RefreshCw className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <p>Podés actualizar el estado manualmente si hiciste un cambio reciente.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
