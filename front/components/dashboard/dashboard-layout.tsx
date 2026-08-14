"use client"

import type React from "react"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/lib/hooks/use-auth"
import { Sidebar } from "./sidebar"
import { Loader2 } from "lucide-react"
import { hasApplicationAccess } from "@/lib/auth/account-access"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isAuthenticated, loading, accountStatus, commerceId, role, billingStatus, billingStatusLoaded } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isSubscriptionRoute = pathname === "/dashboard/suscripcion"

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login")
    }
    if (!loading && isAuthenticated && !hasApplicationAccess({ accountStatus, commerceId, role }, billingStatus, billingStatusLoaded) && !isSubscriptionRoute) {
      router.replace("/dashboard/suscripcion")
    }
  }, [accountStatus, billingStatus, billingStatusLoaded, commerceId, isAuthenticated, isSubscriptionRoute, loading, role, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (!isAuthenticated) {
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
