"use client"

import { useEffect } from "react"
import { authService } from "@/lib/auth/cognito"
import { useAuth } from "@/lib/hooks/use-auth"

const BILLING_REFRESH_INTERVAL_MS = 4 * 60 * 60 * 1000
const BILLING_REFRESH_DEBOUNCE_MS = 60_000

export function AuthRefreshProvider() {
  const { isAuthenticated, loading, refreshBillingStatus } = useAuth()

  useEffect(() => {
    if (loading || !isAuthenticated) {
      return
    }

    const maybeRefresh = async () => {
      const lastRefresh = authService.getLastBillingRefreshAt()
      if (lastRefresh > 0 && Date.now() - lastRefresh < BILLING_REFRESH_DEBOUNCE_MS) {
        return
      }

      try {
        await refreshBillingStatus({ forceRefresh: true })
      } catch (error) {
        console.warn("No se pudo actualizar el estado de suscripción", error)
      }
    }

    void maybeRefresh()
    const timer = window.setInterval(() => {
      void refreshBillingStatus({ forceRefresh: true }).catch((error) => {
        console.warn("No se pudo actualizar el estado de suscripción en segundo plano", error)
      })
    }, BILLING_REFRESH_INTERVAL_MS)

    return () => {
      window.clearInterval(timer)
    }
  }, [isAuthenticated, loading, refreshBillingStatus])

  return null
}
