"use client"

import type React from "react"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/hooks/use-auth"
import { ArrowRight, Loader2, Store } from "lucide-react"
import { authenticatedHome } from "@/lib/auth/account-access"

export function LoginForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const { login, completeNewPassword, loading, error, requiresNewPassword, isAuthenticated, accountStatus, commerceId, role } =
    useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(authenticatedHome({ accountStatus, commerceId, role }))
    }
  }, [accountStatus, commerceId, isAuthenticated, loading, role, router])

  const validatePassword = (pass: string): boolean => {
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
      const nextAuth = await login({ username, password })
      const destination = authenticatedHome(nextAuth)
      router.replace(destination)
    } catch {
      // El estado de error se muestra inline.
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
      const nextAuth = await completeNewPassword(newPassword)
      router.replace(authenticatedHome(nextAuth))
    } catch {
      // Error inline.
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_45%),linear-gradient(180deg,_#f8fafc_0%,_#fff7ed_100%)] p-4">
      <Card className="w-full max-w-md border-0 bg-white/90 shadow-2xl backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg">
            <Store className="h-8 w-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-semibold text-slate-950">Ingresar al sistema</CardTitle>
            <CardDescription className="mt-2 text-slate-600">
              Accedé con tu usuario o creá una cuenta nueva gratis.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {requiresNewPassword ? (
            <form onSubmit={handleNewPasswordSubmit} className="space-y-4">
              <Alert className="border-amber-200 bg-amber-50">
                <AlertDescription className="text-amber-900">
                  Por seguridad, tenés que cambiar la contraseña temporal antes de continuar.
                </AlertDescription>
              </Alert>

              {error ? (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              ) : null}

              {passwordError ? (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{passwordError}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="newPassword">Nueva contraseña</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full bg-slate-950 text-white hover:bg-slate-800">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Actualizando contraseña...
                  </>
                ) : (
                  "Cambiar contraseña"
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error ? (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="username">Usuario o email</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="tu@email.com"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full bg-slate-950 text-white hover:bg-slate-800">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  <>
                    Iniciar sesión
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>¿No tenés cuenta?</span>
                <Link href="/registrarme" className="font-medium text-emerald-700 hover:text-emerald-800">
                  Crear cuenta gratis
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
