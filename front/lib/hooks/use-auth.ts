"use client"

import { authService } from "@/lib/auth/cognito"
import type { AuthState, LoginCredentials } from "@/lib/types/auth"
import { useEffect, useState } from "react"

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(authService.getAuthState())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setAuthState(authService.getAuthState())
    console.log("🚀 ~ useAuth ~ authService.getAuthState():", authService.getAuthState())
  }, [])

  const login = async (credentials: LoginCredentials) => {
    setLoading(true)
    setError(null)

    try {
      const newAuthState = await authService.login(credentials)
      setAuthState(newAuthState)
      return newAuthState
    } catch (err: any) {
      const errorMessage = err.message || "Error al iniciar sesión"
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    authService.logout()
    setAuthState(authService.getAuthState())
  }

  return {
    ...authState,
    loading,
    error,
    login,
    logout,
  }
}
