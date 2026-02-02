"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { CloseRegisterForm } from "@/components/closings/close-register-form"
import { ClosureHistoryTable } from "@/components/closings/closure-history-table"
import { useAuth } from "@/lib/hooks/use-auth"

export default function ClosuresPage() {
    const { user } = useAuth()
    const [refreshTrigger, setRefreshTrigger] = useState(0)

    const isAdmin = user?.role === "admin"

    const handleClosureSuccess = () => {
        // Trigger refresh of history table
        setRefreshTrigger((prev) => prev + 1)
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                        Cierre de Caja
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600">
                        Registra el cierre de caja y consulta el historial
                    </p>
                </div>

                <CloseRegisterForm onSuccess={handleClosureSuccess} />

                {isAdmin && (
                    <ClosureHistoryTable refreshTrigger={refreshTrigger} />
                )}
            </div>
        </DashboardLayout>
    )
}
