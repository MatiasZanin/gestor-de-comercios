"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/hooks/use-auth"
import { Loader2 } from "lucide-react"
import { authenticatedHome } from "@/lib/auth/account-access"

export default function HomePage() {
  const { isAuthenticated, loading, accountStatus, commerceId, role } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        router.replace(authenticatedHome({ accountStatus, commerceId, role }))
      } else {
        router.replace("/login")
      }
    }
  }, [accountStatus, commerceId, isAuthenticated, loading, role, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-orange-50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
        <p className="text-gray-600">Cargando...</p>
      </div>
    </div>
  )
}
