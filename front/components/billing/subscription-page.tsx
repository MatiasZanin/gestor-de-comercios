"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient } from "@/lib/api/client"
import { getBillingCopy, getPublicBillingConfig } from "@/lib/api/public"
import { authService } from "@/lib/auth/cognito"
import { useAuth } from "@/lib/hooks/use-auth"
import type { BillingStatusResponse, PublicBillingConfig } from "@/lib/types/api"
import { ArrowRight, CreditCard, Loader2, LogOut, RefreshCw, ShieldCheck, Store } from "lucide-react"

function dateLabel(value?: string) {
  return value ? new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date(value)) : "-"
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

  const load = async () => {
    try {
      const [value, billingConfig] = await Promise.all([apiClient.getBillingStatus(), getPublicBillingConfig()])
      setStatus(value)
      setConfig(billingConfig)
      setPayerEmail(value.billingPayerEmail ?? "")
      setError(null)
      if (value.status === "trial" || value.status === "active") {
        await authService.forceRefreshToken()
      }
    } catch (err: any) {
      setError(err?.message || "No se pudo consultar la suscripción")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login?next=/suscripcion")
      return
    }
    if (!authLoading && isAuthenticated) void load()
  }, [authLoading, isAuthenticated, router])

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
      await load()
    } catch (err: any) {
      setError(err?.message || "No se pudo cancelar la suscripción")
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading || !isAuthenticated) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>

  const now = Date.now()
  const enabled = status?.status === "trial" || status?.status === "active" ||
    (status?.status === "past_due" && !!status.graceUntil && new Date(status.graceUntil).getTime() >= now) ||
    (status?.status === "cancelled" && !!status.currentPeriodEndsAt && new Date(status.currentPeriodEndsAt).getTime() >= now)
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.2),_transparent_38%),linear-gradient(135deg,_#f8fafc_0%,_#fff7ed_100%)] px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Cuenta y facturación</p><h1 className="mt-2 text-4xl font-semibold text-slate-950">{status?.merchantName ?? "Tu comercio"}</h1></div>
          <Button variant="outline" onClick={() => { logout(); router.push("/login") }}><LogOut />Cerrar sesión</Button>
        </header>
        {error ? <Alert className="border-red-200 bg-red-50"><AlertDescription className="text-red-700">{error}</AlertDescription></Alert> : null}
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-0 bg-slate-950 text-white shadow-2xl">
            <CardHeader><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500"><Store /></div><CardTitle className="text-2xl">Estado: {status?.status ?? "desconocido"}</CardTitle><CardDescription className="text-slate-300">El acceso comercial se valida en el backend.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Info label="Fin del trial" value={dateLabel(status?.trialEndsAt)} />
              <Info label="Período vigente" value={dateLabel(status?.currentPeriodEndsAt)} />
              <Info label="Gracia hasta" value={dateLabel(status?.graceUntil)} />
              <Info label="Último pago" value={status?.lastPaymentStatus ?? "-"} />
              {enabled ? <Button onClick={() => router.push("/dashboard")} className="mt-3 bg-emerald-500 text-slate-950 hover:bg-emerald-400">Ir al sistema<ArrowRight /></Button> : null}
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white/90 shadow-xl">
            <CardHeader><CardTitle>{status?.checkoutUrl ? "Continuar autorización" : status?.trialConsumed ? "Volver a suscribirme" : "Iniciar prueba gratuita"}</CardTitle><CardDescription>{status?.trialConsumed ? "La reactivación comienza con cobro, sin un segundo trial." : config ? getBillingCopy(config) : "Consultando las condiciones del plan..."}</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><div className="flex items-center gap-2 font-medium"><ShieldCheck />Checkout protegido por Mercado Pago</div><p className="mt-1">El email puede ser distinto al que usás para entrar al sistema. La tarjeta se carga únicamente en Mercado Pago.</p></div>
              {status?.checkoutUrl ? <Button size="lg" className="w-full bg-slate-950 text-white" onClick={() => window.location.assign(status.checkoutUrl!)}><RefreshCw />Continuar en Mercado Pago</Button> : (
                <><div className="space-y-2"><Label htmlFor="payerEmail">Email de tu cuenta de Mercado Pago</Label><Input id="payerEmail" type="email" value={payerEmail} onChange={(event) => setPayerEmail(event.target.value)} placeholder="tu-email-mercadopago@example.com" /></div><Button size="lg" className="w-full bg-slate-950 text-white" disabled={submitting || !payerEmail} onClick={subscribe}>{submitting ? <Loader2 className="animate-spin" /> : <CreditCard />}{status?.trialConsumed ? "Volver a suscribirme" : "Iniciar prueba gratuita"}</Button></>
              )}
              {enabled ? <Button variant="outline" className="w-full" disabled={submitting} onClick={cancel}>Cancelar suscripción</Button> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 rounded-xl bg-white/10 px-3 py-2"><span className="text-slate-400">{label}</span><span className="text-right font-medium">{value}</span></div>
}
