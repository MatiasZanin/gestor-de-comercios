"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { apiClient } from "@/lib/api/client"
import { authService } from "@/lib/auth/cognito"

interface ApiProviderProps {
    children: React.ReactNode
}

export function ApiProvider({ children }: ApiProviderProps) {
    const router = useRouter()

    useEffect(() => {
        // Configurar el callback para manejar errores 401 (se ejecuta solo si el refresh en el client falló)
        apiClient.setOnUnauthorized(async () => {
            const refreshed = await authService.handleTokenExpired()
            if (!refreshed) {
                router.push("/login")
            }
        })
    }, [router])

    return <>{children}</>
}
