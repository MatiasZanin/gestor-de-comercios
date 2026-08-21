"use client"

import type React from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authenticatedHome } from "@/lib/auth/account-access"
import { useAuth } from "@/lib/hooks/use-auth"
import { ArrowRight, Loader2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { GysLogo } from "../shared/gys-logo"
import { LoginCarouselPanel } from "./login-carousel-panel"

export function LoginForm() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const { login, completeNewPassword, loading, error, requiresNewPassword, isAuthenticated, accountStatus, commerceId, role, isCommerceOwner } =
    useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(authenticatedHome({ accountStatus, commerceId, role, isCommerceOwner }))
    }
  }, [accountStatus, commerceId, isAuthenticated, isCommerceOwner, loading, role, router])

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
    <main className="flex flex-col min-h-svh items-center justify-center overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(0,154,97,0.10),_transparent_35%),linear-gradient(135deg,_#f8fafc_0%,_#f7fbf9_55%,_#f8fafc_100%)] p-4 sm:p-6 lg:p-8">
      <div className="grid w-full max-w-[1180px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_70px_-24px_rgba(15,23,42,0.28)] lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="flex min-h-[620px] flex-col justify-center rounded-none border-0 bg-white px-2 py-8 shadow-none sm:px-8 lg:min-h-[680px] lg:px-10 xl:px-14">
          <CardHeader className="space-y-9 pb-7 text-left">
            <div className="flex items-center gap-3" aria-label="Gestor de Comercios">
              <Image
                src="/logo.png"
                alt=""
                width={44}
                height={44}
                priority
                className="size-11 rounded-xl object-cover shadow-sm ring-1 ring-slate-200"
              />
              <span className="text-base font-semibold tracking-tight text-slate-900">Gestor de Comercios</span>
            </div>

            <div>
              <CardTitle className="text-3xl font-semibold tracking-tight text-slate-950">Ingresar al sistema</CardTitle>
              <CardDescription className="mt-2 text-sm leading-6 text-slate-600">
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
              <div className="text-center text-sm">
                <Link href="/restablecer-contrasena" className="font-medium text-emerald-700 hover:text-emerald-800">
                  Olvidé mi contraseña
                </Link>
              </div>
            </form>
          )}
          </CardContent>
        </Card>

        <LoginCarouselPanel />
      </div>
      <footer className="mt-6 text-center text-sm text-slate-600">
        <span>© 2026 <GysLogo></GysLogo>. Todos los derechos reservados.</span>
      </footer>
    </main>
  )
}
