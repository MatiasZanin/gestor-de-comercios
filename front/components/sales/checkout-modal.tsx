import ReactSelect from "react-select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/types/api"
import { formatCurrency } from "@/lib/utils/sales-utils"

interface CheckoutModalProps {
    total: number
    paymentMethod: PaymentMethod
    notes: string
    loading: boolean
    onPaymentMethodChange: (method: PaymentMethod) => void
    onNotesChange: (notes: string) => void
    onConfirm: (e: React.FormEvent) => void
    onClose: () => void
}

export function CheckoutModal({
    total,
    paymentMethod,
    notes,
    loading,
    onPaymentMethodChange,
    onNotesChange,
    onConfirm,
    onClose,
}: CheckoutModalProps) {
    return (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center sm:p-4 z-[65]">
            <div className="bg-white rounded-none sm:rounded-lg shadow-xl w-full sm:max-w-md h-full sm:h-auto overflow-y-auto flex flex-col">
                <div className="p-6 border-b bg-gray-50">
                    <h3 className="text-xl font-bold text-center">
                        {total > 0 ? "Finalizar Venta" : total === 0 ? "Confirmar Cambio" : "Emitir Reembolso"}
                    </h3>
                    <div className="mt-4 text-center">
                        <span className="text-sm text-gray-500 uppercase tracking-wide">
                            {total > 0 ? "Total a Cobrar" : total === 0 ? "Saldo del Cambio" : "Total a Reembolsar"}
                        </span>
                        <div className={`text-4xl font-black ${total > 0 ? "text-orange-600" : total === 0 ? "text-gray-600" : "text-red-600"}`}>
                            {formatCurrency(Math.abs(total))}
                        </div>
                    </div>
                </div>

                <form onSubmit={onConfirm} className="p-4 sm:p-6 space-y-4 flex-1">
                    <div>
                        <Label htmlFor="paymentMethod">Método de Pago</Label>
                        <ReactSelect
                            id="paymentMethod"
                            value={{ value: paymentMethod, label: PAYMENT_METHOD_LABELS[paymentMethod] }}
                            onChange={(option) => option && onPaymentMethodChange(option.value as PaymentMethod)}
                            options={(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => ({
                                value: method,
                                label: PAYMENT_METHOD_LABELS[method],
                            }))}
                            isSearchable={false}
                            unstyled={true}

                            classNames={{
                                control: ({ isFocused }) =>
                                    `flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${isFocused ? "ring-1 ring-ring border-primary" : "hover:border-primary/50"
                                    }`,
                                menu: () =>
                                    "relative z-50 mt-1.5 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80",
                                option: ({ isFocused, isSelected }) =>
                                    `relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none transition-colors ${isSelected
                                        ? "bg-orange-600 text-white font-medium" // Tu color primario
                                        : isFocused
                                            ? "bg-accent text-accent-foreground"   // Gris suave al pasar mouse
                                            : "text-popover-foreground"
                                    }`,
                                placeholder: () => "text-muted-foreground",
                                singleValue: () => "text-foreground",
                                input: () => "text-foreground",
                                indicatorSeparator: () => "hidden", // Borra la linea divisoria fea
                                dropdownIndicator: () => "text-muted-foreground opacity-50 hover:opacity-100",
                                valueContainer: () => "gap-1",
                            }}
                        />
                    </div>

                    <div>
                        <Label htmlFor="notes">Notas de la venta</Label>
                        <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => onNotesChange(e.target.value)}
                            rows={2}
                            placeholder="Ej: Entregar por la tarde..."
                            className="mt-2"
                        />
                    </div>

                    <div className="flex flex-col gap-2 pt-4" style={{ paddingBottom: 'max(0rem, env(safe-area-inset-bottom))' }}>
                        <Button
                            type="submit"
                            disabled={loading}
                            className={`w-full h-12 text-lg font-bold ${total < 0
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-orange-600 hover:bg-orange-700"
                                }`}
                        >
                            {loading
                                ? "Procesando..."
                                : total > 0
                                    ? "Confirmar Venta"
                                    : total === 0
                                        ? "Confirmar Cambio"
                                        : "Confirmar Reembolso"}
                        </Button>
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                            Volver al carrito
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}