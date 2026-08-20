"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { useAuth } from "@/lib/hooks/use-auth"
import { hasApplicationAccess } from "@/lib/auth/account-access"

export default function RestrictedAccessPage() {
  const router = useRouter()
  const { isAuthenticated, loading, logout, accountStatus, commerceId, role, billingStatus, billingStatusLoaded } = useAuth()

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login")
    if (!loading && isAuthenticated && billingStatusLoaded) {
      if (hasApplicationAccess({ accountStatus, commerceId, role }, billingStatus, true)) router.replace("/dashboard")
      else if (billingStatus?.canManageSubscription) router.replace("/dashboard/suscripcion")
    }
  }, [accountStatus, billingStatus, billingStatusLoaded, commerceId, isAuthenticated, loading, role, router])

  if (loading || !isAuthenticated) return null

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-lg border-0 bg-white/90 text-center shadow-lg">
        <CardHeader className="items-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
            <ShieldAlert className="h-7 w-7 text-amber-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Acceso restringido</h1>
          <CardDescription>
            La suscripción del comercio requiere atención. Contactá a la persona que creó el comercio para regularizarla.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => { logout(); router.replace("/login") }}>
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
