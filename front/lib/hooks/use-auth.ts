"use client"

import { authService } from "@/lib/auth/cognito"
import type { AuthState, LoginCredentials } from "@/lib/types/auth"
import { useEffect, useState } from "react"

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(authService.getAuthState())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requiresNewPassword, setRequiresNewPassword] = useState(false)

  useEffect(() => {
    // setAuthState(authService.getAuthState())
  }, [])

  const login = async (credentials: LoginCredentials) => {
    setLoading(true)
    setError(null)
    setRequiresNewPassword(false)

    try {
      const newAuthState = await authService.login(credentials)
      setAuthState(newAuthState)
      return newAuthState
    } catch (err: any) {
      if (err.code === "NewPasswordRequired" || err.name === "NewPasswordRequired") {
        setRequiresNewPassword(true)
        setError("Debes cambiar tu contraseña temporal")
        throw err
      }
      
      const errorMessage = err.message || "Error al iniciar sesión"
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const completeNewPassword = async (newPassword: string) => {
    setLoading(true)
    setError(null)

    try {
      const newAuthState = await authService.completeNewPassword(newPassword)
      setAuthState(newAuthState)
      setRequiresNewPassword(false)
      return newAuthState
    } catch (err: any) {
      const errorMessage = err.message || "Error al cambiar la contraseña"
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    authService.logout()
    setAuthState(authService.getAuthState())
    setRequiresNewPassword(false)
  }

  return {
    ...authState,
    loading,
    error,
    requiresNewPassword,
    login,
    logout,
    completeNewPassword,
  }
}
