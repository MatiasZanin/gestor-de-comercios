"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { apiClient } from "@/lib/api/client"
import { authService, sessionEvents } from "@/lib/auth/cognito"
import { LoginModal } from "@/components/auth/login-modal"

interface ApiProviderProps {
    children: React.ReactNode
}

export function ApiProvider({ children }: ApiProviderProps) {
    const router = useRouter()
    const [isSessionExpired, setIsSessionExpired] = useState(false)

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

    const handleLoginSuccess = useCallback(() => {
        setIsSessionExpired(false)
    }, [])

    const handleExit = useCallback(() => {
        setIsSessionExpired(false)
        router.push("/login")
    }, [router])

    return (
        <>
            {children}
            <LoginModal
                open={isSessionExpired}
                onSuccess={handleLoginSuccess}
                onExit={handleExit}
            />
        </>
    )
}
