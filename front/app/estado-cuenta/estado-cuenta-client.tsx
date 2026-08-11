"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/lib/hooks/use-auth"
import type { PublicBillingConfig, RegistrationStatusResponse } from "@/lib/types/api"
import { getPublicBillingConfig, getPublicRegistrationStatus } from "@/lib/api/public"
import { AccountStatusCard } from "@/components/billing/account-status-card"

export function EstadoCuentaClient() {
  const { isAuthenticated, loading, accountStatus, user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [registrationId, setRegistrationId] = useState<string | null>(searchParams.get("registrationId"))
  const [status, setStatus] = useState<RegistrationStatusResponse | null>(null)
  const [config, setConfig] = useState<PublicBillingConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingState, setLoadingState] = useState(true)

  const shouldRedirectToDashboard = useMemo(
    () => isAuthenticated && accountStatus && accountStatus !== "pending_subscription",
    [accountStatus, isAuthenticated],
  )

  useEffect(() => {
    if (!loading && shouldRedirectToDashboard) {
      router.replace("/dashboard")
    }
  }, [loading, router, shouldRedirectToDashboard])

  useEffect(() => {
    if (registrationId) {
      return
    }
    if (user?.registrationId) {
      setRegistrationId(user.registrationId)
      return
    }
    const stored = localStorageFallback("pendingRegistrationId")
    if (stored) {
      setRegistrationId(stored)
    }
  }, [registrationId, user?.registrationId])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const [billingConfig, registrationStatus] = await Promise.all([
          getPublicBillingConfig(),
          registrationId ? getPublicRegistrationStatus(registrationId) : Promise.resolve(null),
        ])
        if (!mounted) return
        setConfig(billingConfig)
        setStatus(registrationStatus)
        setError(null)
      } catch (err: any) {
        if (!mounted) return
        setError(err?.message || "No se pudo cargar el estado de la cuenta")
      } finally {
        if (!mounted) return
        setLoadingState(false)
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [registrationId])

  useEffect(() => {
    if (!registrationId) return

    const interval = setInterval(async () => {
      try {
        const nextStatus = await getPublicRegistrationStatus(registrationId)
        setStatus(nextStatus)
        setError(null)
      } catch {
        // silencioso, la UI mantiene el último estado
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [registrationId])

  const handleRetry = () => {
    if (status?.checkoutUrl) {
      window.location.assign(status.checkoutUrl)
      return
    }
    if (registrationId) {
      window.location.reload()
    }
  }

  const handleContinue = () => {
    if (isAuthenticated && accountStatus && accountStatus !== "pending_subscription") {
      router.push("/dashboard")
      return
    }
    router.push("/login")
  }

  if (loadingState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_45%),linear-gradient(180deg,_#f8fafc_0%,_#fff7ed_100%)]">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-slate-600">Consultando el estado de la cuenta...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_45%),linear-gradient(180deg,_#f8fafc_0%,_#fff7ed_100%)] px-4 py-10">
      <div className="mx-auto max-w-4xl">
        {error ? (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        ) : null}

        <AccountStatusCard
          status={status}
          config={config}
          onRetry={status?.checkoutUrl ? handleRetry : undefined}
          onContinue={handleContinue}
        />

        {!registrationId ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm text-slate-600 shadow-sm backdrop-blur">
            No encontramos un alta en curso. Si ya tenés una cuenta, entrá por login.
            <div className="mt-3">
              <Button variant="outline" onClick={() => router.push("/login")}>
                Ir al login
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}

function localStorageFallback(key: string): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(key)
}
