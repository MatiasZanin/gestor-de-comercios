"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/hooks/use-auth"
import { Sidebar } from "./sidebar"
import { Loader2 } from "lucide-react"
import { hasApplicationAccess } from "@/lib/auth/account-access"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isAuthenticated, loading, accountStatus, commerceId, role, refreshBillingStatus } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login")
    }
    if (!loading && isAuthenticated && !hasApplicationAccess({ accountStatus, commerceId, role })) {
      router.replace("/suscripcion")
    }
  }, [accountStatus, commerceId, isAuthenticated, loading, role, router])

  useEffect(() => {
    if (!loading && isAuthenticated) {
      void refreshBillingStatus().catch((error) => {
        console.warn("No se pudo actualizar el estado de suscripción al abrir el dashboard", error)
      })
    }
  }, [isAuthenticated, loading, refreshBillingStatus])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (!isAuthenticated || !hasApplicationAccess({ accountStatus, commerceId, role })) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="md:ml-64">
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
