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
        // Configurar el callback para manejar errores 401
        apiClient.setOnUnauthorized(() => {
            authService.handleTokenExpired()
            router.push("/login")
        })
    }, [router])

    return <>{children}</>
}
