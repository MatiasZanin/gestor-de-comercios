"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/hooks/use-auth"
import { cn } from "@/lib/utils"
import { Banknote, BarChart3, ClipboardList, LogOut, Menu, Package, ShoppingCart, Tag, User, Users, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { hasApplicationAccess } from "@/lib/auth/account-access"

const fullNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { name: "Productos", href: "/dashboard/productos", icon: Package },
  { name: "Ventas", href: "/dashboard/ventas", icon: ShoppingCart },
  { name: "Ofertas", href: "/dashboard/ofertas", icon: Tag },
  { name: "Cierres", href: "/dashboard/cierres", icon: Banknote },
  { name: "Reportes", href: "/dashboard/reportes", icon: BarChart3 },
  { name: "Auditoría", href: "/dashboard/auditoria", icon: ClipboardList },
  { name: "Gestor de usuarios", href: "/dashboard/usuarios", icon: Users, adminOnly: true },
  { name: "Suscripción", href: "/dashboard/suscripcion", icon: User },
]

const limitedNavigation = [{ name: "Suscripción", href: "/dashboard/suscripcion", icon: User }]

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { user, accountStatus, commerceId, role, billingStatus, billingStatusLoaded, logout } = useAuth()

  const canAccessApp = hasApplicationAccess({ accountStatus, commerceId, role }, billingStatus, billingStatusLoaded)
  const canManageSubscription = billingStatus?.canManageSubscription === true
  const navigation = canAccessApp
    ? fullNavigation.filter((item) => {
        if (item.href === "/dashboard/suscripcion" && !canManageSubscription) return false
        return !("adminOnly" in item && item.adminOnly) || role === "admin"
      })
    : canManageSubscription ? limitedNavigation : []

  const handleLogout = () => {
    logout()
    window.location.href = "/login"
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={isOpen}
        className="fixed top-4 right-4 z-50 md:hidden bg-white shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsOpen(false)} />}

      <div
        className={cn(
          "fixed left-0 top-0 z-40 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
                <img src="/logo.png" alt="Logo" className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900">Sistema de Ventas</h1>
                <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.username}</p>
                <p className="text-xs text-gray-500">Comercio: {user?.commerceId}</p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
