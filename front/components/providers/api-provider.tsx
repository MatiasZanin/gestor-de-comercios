"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { apiClient } from "@/lib/api/client"
import { authService, sessionEvents } from "@/lib/auth/cognito"
import { LoginModal } from "@/components/auth/login-modal"
import { SubscriptionRequiredModal } from "@/components/billing/subscription-required-modal"
import { getPublicBillingConfig } from "@/lib/api/public"
import type { BillingStatusResponse, PublicBillingConfig } from "@/lib/types/api"

interface ApiProviderProps {
    children: React.ReactNode
}

export function ApiProvider({ children }: ApiProviderProps) {
    const router = useRouter()
    const [isSessionExpired, setIsSessionExpired] = useState(false)
    const [isSubscriptionRequired, setIsSubscriptionRequired] = useState(false)
    const [subscriptionLoading, setSubscriptionLoading] = useState(false)
    const [billingStatus, setBillingStatus] = useState<BillingStatusResponse | null>(null)
    const [billingConfig, setBillingConfig] = useState<PublicBillingConfig | null>(null)
    const subscriptionRequestInFlight = useRef(false)

    // Escuchar el evento session-expired emitido por AuthService
    useEffect(() => {
        const handleSessionExpired = () => {
            setIsSessionExpired(true)
        }

        sessionEvents.addEventListener("session-expired", handleSessionExpired)
        return () => {
            sessionEvents.removeEventListener("session-expired", handleSessionExpired)
        }
    }, [])

    useEffect(() => {
        // Configurar el callback para manejar errores 401
        // Retorna true si la re-autenticación fue exitosa, false si el usuario eligió salir
        apiClient.setOnUnauthorized(async () => {
            const refreshed = await authService.handleTokenExpired()
            if (!refreshed) {
                router.push("/login")
            }
            return refreshed
        })
    }, [router])

    const handleSubscriptionRequired = useCallback(() => {
        setIsSubscriptionRequired(true)
        setBillingStatus(authService.getBillingStatus())
        setBillingConfig(null)

        if (subscriptionRequestInFlight.current) return
        subscriptionRequestInFlight.current = true
        setSubscriptionLoading(true)

        void Promise.allSettled([
            apiClient.getBillingStatus({ forceRefresh: true }),
            getPublicBillingConfig(),
        ]).then(([statusResult, configResult]) => {
            if (statusResult.status === "fulfilled") {
                authService.setBillingStatus(statusResult.value)
                setBillingStatus(statusResult.value)
            }
            if (configResult.status === "fulfilled") {
                setBillingConfig(configResult.value)
            }
        }).finally(() => {
            subscriptionRequestInFlight.current = false
            setSubscriptionLoading(false)
        })
    }, [])

    useEffect(() => {
        apiClient.setOnSubscriptionRequired(handleSubscriptionRequired)
        return () => apiClient.setOnSubscriptionRequired(undefined)
    }, [handleSubscriptionRequired])

    const handleLoginSuccess = useCallback(() => {
        setIsSessionExpired(false)
    }, [])

    const handleExit = useCallback(() => {
        setIsSessionExpired(false)
        router.push("/login")
    }, [router])

    const handleManageSubscription = useCallback(() => {
        setIsSubscriptionRequired(false)
        router.push("/suscripcion")
    }, [router])

    return (
        <>
            {children}
            <LoginModal
                open={isSessionExpired}
                onSuccess={handleLoginSuccess}
                onExit={handleExit}
            />
            <SubscriptionRequiredModal
                open={isSubscriptionRequired}
                loading={subscriptionLoading}
                status={billingStatus}
                config={billingConfig}
                fallbackOwner={authService.getAuthState().isCommerceOwner}
                onOpenChange={setIsSubscriptionRequired}
                onManageSubscription={handleManageSubscription}
            />
        </>
    )
}
