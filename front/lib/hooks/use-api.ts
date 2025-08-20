"use client"

import { useRouter } from "next/navigation"
import { useCallback } from "react"
import { useAuth } from "./use-auth"

export function useApi() {
  const router = useRouter()
  const { logout } = useAuth()

  const handleApiError = useCallback((error: any) => {
    // Si el error indica un 401 o token expirado
    if (error.message?.includes("401") || 
        error.message?.includes("Unauthorized") || 
        error.message?.includes("Token expired") ||
        error.message?.includes("Sesión expirada")) {
      
      // Logout y redirección
      logout()
      router.push("/login")
      return true // Indica que se manejó el error de autenticación
    }
    return false // No se manejó el error
  }, [router, logout])

  return {
    handleApiError,
  }
}
