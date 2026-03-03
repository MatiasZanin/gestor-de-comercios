"use client"

import type React from "react"
import { useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { authService } from "@/lib/auth/cognito"
import { Loader2, ShieldAlert, LogOut } from "lucide-react"

interface LoginModalProps {
    open: boolean
    onSuccess: () => void
    onExit: () => void
}

export function LoginModal({ open, onSuccess, onExit }: LoginModalProps) {
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    if (!open || typeof document === "undefined") return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            await authService.login({ username, password })
            // Login exitoso, resolver la re-autenticación pendiente
            authService.resolveReauth()
            setUsername("")
            setPassword("")
            onSuccess()
        } catch (err: any) {
            const msg = err.message || "Error al iniciar sesión"
            setError(msg)
        } finally {
            setLoading(false)
        }
    }

    const handleExit = () => {
        authService.rejectReauth()
        authService.logout()
        onExit()
    }

    return createPortal(
        <div
            style={{ zIndex: 99999 }}
            className="fixed inset-0 flex items-center justify-center"
        >
            {/* Overlay con blur */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Card del modal */}
            <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl border-0 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header con ícono */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <ShieldAlert className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">
                                Sesión Expirada
                            </h2>
                            <p className="text-sm text-white/80">
                                Ingresá tus credenciales para continuar
                            </p>
                        </div>
                    </div>
                </div>

                {/* Formulario */}
                <div className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <Alert className="border-red-200 bg-red-50">
                                <AlertDescription className="text-red-700">
                                    {error}
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="reauth-username" className="text-gray-700 font-medium">
                                Usuario
                            </Label>
                            <Input
                                id="reauth-username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="nombre_usuario"
                                required
                                autoFocus
                                className="border-gray-200 focus:border-amber-500 focus:ring-amber-500"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="reauth-password" className="text-gray-700 font-medium">
                                Contraseña
                            </Label>
                            <Input
                                id="reauth-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="border-gray-200 focus:border-amber-500 focus:ring-amber-500"
                            />
                        </div>

                        <div className="flex flex-col gap-2 pt-2">
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium py-2.5 shadow-lg hover:shadow-xl transition-all duration-200"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Reautenticando...
                                    </>
                                ) : (
                                    "Continuar sesión"
                                )}
                            </Button>

                            <Button
                                type="button"
                                variant="ghost"
                                onClick={handleExit}
                                disabled={loading}
                                className="w-full text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                Salir
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    )
}
