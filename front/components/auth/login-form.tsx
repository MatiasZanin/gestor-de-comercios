"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/lib/hooks/use-auth"
import { Loader2, Store } from "lucide-react"

export function LoginForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const { login, completeNewPassword, loading, error, requiresNewPassword } = useAuth()
  const router = useRouter()

  useEffect(() => {
    setUsername("Matias");
    setPassword("Pass_2025");
  }, [])

  const validatePassword = (pass: string): boolean => {
    // Validar requisitos mínimos de Cognito
    if (pass.length < 8) {
      setPasswordError("La contraseña debe tener al menos 8 caracteres")
      return false
    }
    if (!/[A-Z]/.test(pass)) {
      setPasswordError("La contraseña debe contener al menos una mayúscula")
      return false
    }
    if (!/[a-z]/.test(pass)) {
      setPasswordError("La contraseña debe contener al menos una minúscula")
      return false
    }
    if (!/[0-9]/.test(pass)) {
      setPasswordError("La contraseña debe contener al menos un número")
      return false
    }
    if (!/[^A-Za-z0-9]/.test(pass)) {
      setPasswordError("La contraseña debe contener al menos un carácter especial")
      return false
    }
    setPasswordError("")
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await login({ username, password })
      router.push("/dashboard")
    } catch (err) {
      // Error is handled by useAuth hook
      // Si requiresNewPassword es true, el formulario mostrará los campos de cambio de contraseña
    }
  }

  const handleNewPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError("")

    if (!validatePassword(newPassword)) {
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden")
      return
    }

    try {
      await completeNewPassword(newPassword)
      router.push("/dashboard")
    } catch (err) {
      // Error is handled by useAuth hook
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-orange-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Store className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-gray-900">Sistema de Ventas</CardTitle>
            <CardDescription className="text-gray-600 mt-2">Ingresa tus credenciales para acceder</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {requiresNewPassword ? (
            // Formulario de cambio de contraseña
            <form onSubmit={handleNewPasswordSubmit} className="space-y-4">
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertDescription className="text-yellow-800">
                  Por seguridad, debes cambiar tu contraseña temporal antes de continuar.
                </AlertDescription>
              </Alert>

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              )}

              {passwordError && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{passwordError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-gray-700 font-medium">
                  Nueva Contraseña
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                />
                <p className="text-xs text-gray-500">
                  Mínimo 8 caracteres, debe incluir mayúsculas, minúsculas, números y caracteres especiales
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">
                  Confirmar Nueva Contraseña
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium py-2.5 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando contraseña...
                  </>
                ) : (
                  "Cambiar Contraseña"
                )}
              </Button>
            </form>
          ) : (
            // Formulario de login normal
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-700 font-medium">
                  Usuario
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="nombre_usuario"
                  required
                  className="border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">
                  Contraseña
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="border-gray-200 focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium py-2.5 shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
