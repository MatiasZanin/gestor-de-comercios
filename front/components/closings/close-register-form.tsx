"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { apiClient } from "@/lib/api/client"
import { useAuth } from "@/lib/hooks/use-auth"
import type { CreateCashCloseRequest, CashClose } from "@/lib/types/api"

interface CloseRegisterFormProps {
    onSuccess?: (closure: CashClose) => void
}

export function CloseRegisterForm({ onSuccess }: CloseRegisterFormProps) {
    const { user } = useAuth()
    const isAdmin = user?.role === "admin"
    const [declaredCash, setDeclaredCash] = useState("")
    const [expenses, setExpenses] = useState("")
    const [initialFund, setInitialFund] = useState("")
    const [notes, setNotes] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState(false)
    const [lastClosure, setLastClosure] = useState<CashClose | null>(null)

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
        }).format(amount)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setSuccess(false)

        const declaredCashNum = parseFloat(declaredCash.replace(",", "."))
        const expensesNum = parseFloat(expenses.replace(",", ".")) || 0
        const initialFundNum = parseFloat(initialFund.replace(",", ".")) || 0

        if (isNaN(declaredCashNum) || declaredCashNum < 0) {
            setError("Ingresá un monto válido para el efectivo contado")
            return
        }

        setLoading(true)

        try {
            const data: CreateCashCloseRequest = {
                declaredCash: declaredCashNum,
                expenses: expensesNum,
                initialFund: initialFundNum,
                notes: notes.trim() || undefined,
            }

            const closure = await apiClient.createClosure(data)
            setLastClosure(closure)
            setSuccess(true)

            // Reset form
            setDeclaredCash("")
            setExpenses("")
            setInitialFund("")
            setNotes("")

            if (onSuccess) {
                onSuccess(closure)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al cerrar la caja")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-xl">Cerrar Caja</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="declaredCash">Efectivo Contado *</Label>
                            <Input
                                id="declaredCash"
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={declaredCash}
                                onChange={(e) => setDeclaredCash(e.target.value)}
                                disabled={loading}
                            />
                            <p className="text-xs text-gray-500">
                                Cantidad física de efectivo en la caja
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="expenses">Gastos</Label>
                            <Input
                                id="expenses"
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={expenses}
                                onChange={(e) => setExpenses(e.target.value)}
                                disabled={loading}
                            />
                            <p className="text-xs text-gray-500">
                                Gastos retirados de la caja
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="initialFund">Fondo Inicial</Label>
                            <Input
                                id="initialFund"
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={initialFund}
                                onChange={(e) => setInitialFund(e.target.value)}
                                disabled={loading}
                            />
                            <p className="text-xs text-gray-500">
                                Fondo inicial del día
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notas (opcional)</Label>
                        <Textarea
                            id="notes"
                            placeholder="Comentarios adicionales sobre el cierre..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            disabled={loading}
                        />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                            <XCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {success && lastClosure && (
                        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg space-y-3">
                            <div className="flex items-center gap-2 text-emerald-700">
                                <CheckCircle className="w-5 h-5" />
                                <span className="font-medium">¡Caja cerrada correctamente!</span>
                            </div>
                            {isAdmin ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                    <div>
                                        <p className="text-gray-500">Efectivo Sistema</p>
                                        <p className="font-semibold">{formatCurrency(lastClosure.systemTotalCash ?? 0)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Tarjeta Sistema</p>
                                        <p className="font-semibold">{formatCurrency(lastClosure.systemTotalCard ?? 0)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Transferencia Sistema</p>
                                        <p className="font-semibold">{formatCurrency(lastClosure.systemTotalTransfer ?? 0)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Diferencia</p>
                                        <p className={`font-semibold ${(lastClosure.difference ?? 0) === 0 ? 'text-emerald-600' : (lastClosure.difference ?? 0) > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                            {formatCurrency(lastClosure.difference ?? 0)}
                                            {(lastClosure.difference ?? 0) > 0 ? ' (sobrante)' : (lastClosure.difference ?? 0) < 0 ? ' (faltante)' : ''}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                    <div>
                                        <p className="text-gray-500">Efectivo Contado</p>
                                        <p className="font-semibold">{formatCurrency(lastClosure.declaredCash)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Gastos</p>
                                        <p className="font-semibold">{formatCurrency(lastClosure.expenses)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Fondo Inicial</p>
                                        <p className="font-semibold">{formatCurrency(lastClosure.initialFund)}</p>
                                    </div>
                                    {lastClosure.notes && (
                                        <div className="col-span-2 md:col-span-3">
                                            <p className="text-gray-500">Notas</p>
                                            <p className="font-semibold">{lastClosure.notes}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            disabled={loading || !declaredCash}
                            className="bg-orange-600 hover:bg-orange-700 min-w-[150px]"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Cerrando...
                                </>
                            ) : (
                                "Cerrar Caja"
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
