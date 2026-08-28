"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { apiClient } from "@/lib/api/client"
import { getPublicBillingConfig } from "@/lib/api/public"
import { authService } from "@/lib/auth/cognito"
import { cancellationReasonSchema, mercadoPagoEmailSchema } from "@/lib/billing/subscription-validation"
import { useAuth } from "@/lib/hooks/use-auth"
import type { BillingStatusResponse, PublicBillingConfig } from "@/lib/types/api"

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useSubscription() {
  const router = useRouter()
  const { isAuthenticated, loading: authLoading, user } = useAuth()
  const ownerEmail = user?.email ?? ""
  const [status, setStatus] = useState<BillingStatusResponse | null>(null)
  const [config, setConfig] = useState<PublicBillingConfig | null>(null)
  const [payerEmail, setPayerEmailState] = useState("")
  const [loading, setLoading] = useState(true)
  const [operation, setOperation] = useState<"subscribe" | "cancel" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const operationLock = useRef(false)
  const subscribeKey = useRef<string | null>(null)
  const cancelKey = useRef<string | null>(null)

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    try {
      const [nextStatus, nextConfig] = await Promise.all([
        apiClient.getBillingStatus({ forceRefresh }),
        getPublicBillingConfig(),
      ])
      authService.setBillingStatus(nextStatus)
      setStatus(nextStatus)
      setConfig(nextConfig)
      setPayerEmailState(nextStatus.billingPayerEmail ?? ownerEmail)
      setError(null)
      if (!nextStatus.canManageSubscription) {
        router.replace("/acceso-restringido")
      }
    } catch (loadError) {
      setError(messageFrom(loadError, "No se pudo consultar la suscripción"))
    } finally {
      setLoading(false)
    }
  }, [ownerEmail, router])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login?next=/dashboard/suscripcion")
      return
    }
    if (!authLoading && isAuthenticated) void load(true)
  }, [authLoading, isAuthenticated, load, router])

  const setPayerEmail = (value: string) => {
    subscribeKey.current = null
    setPayerEmailState(value)
  }

  const startSubscription = async (): Promise<void> => {
    if (operationLock.current) return
    const parsed = mercadoPagoEmailSchema.safeParse(payerEmail)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Ingresá un email válido")
      return
    }
    operationLock.current = true
    setOperation("subscribe")
    setError(null)
    subscribeKey.current ??= crypto.randomUUID()
    try {
      const response = await apiClient.createSubscription(parsed.data, subscribeKey.current)
      window.location.assign(response.checkoutUrl)
    } catch (submitError) {
      setError(messageFrom(submitError, "No se pudo iniciar la suscripción"))
      setOperation(null)
      operationLock.current = false
    }
  }

  const cancelSubscription = async (reasonInput: string): Promise<boolean> => {
    if (operationLock.current) return false
    const parsed = cancellationReasonSchema.safeParse(reasonInput)
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Ingresá un motivo")

    operationLock.current = true
    setOperation("cancel")
    setError(null)
    cancelKey.current ??= crypto.randomUUID()
    try {
      const response = await apiClient.cancelSubscription(parsed.data, cancelKey.current)
      setStatus(response.billing)
      authService.setBillingStatus(response.billing)
      await authService.forceRefreshToken()
      authService.setBillingStatus(response.billing)
      cancelKey.current = null
      toast.success("Suscripción cancelada", {
        description: response.notificationStatus === "queued" || response.notificationStatus === "sent"
          ? "Recibimos tus comentarios."
          : "La baja se completó; el envío de tus comentarios quedó pendiente.",
      })
      return true
    } catch (cancelError) {
      const message = messageFrom(cancelError, "No se pudo cancelar la suscripción")
      setError(message)
      toast.error(message)
      return false
    } finally {
      setOperation(null)
      operationLock.current = false
    }
  }

  const continueCheckout = () => {
    if (status?.checkoutUrl) window.location.assign(status.checkoutUrl)
  }

  return {
    status,
    config,
    ownerEmail,
    payerEmail,
    setPayerEmail,
    loading: authLoading || loading,
    operation,
    error,
    refresh: () => load(true),
    startSubscription,
    cancelSubscription,
    continueCheckout,
  }
}
