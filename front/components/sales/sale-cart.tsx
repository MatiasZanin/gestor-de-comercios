import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Plus, Minus, X, RotateCcw, Tag } from "lucide-react"
import { formatCurrency } from "@/lib/utils/sales-utils"
import type { SaleItem } from "@/lib/types/api"

interface SaleCartProps {
    items: SaleItem[]
    qtyInputs: Record<string, string>
    onUpdateQty: (code: string, qty: number) => void
    onUpdateQtyInput: (code: string, val: string) => void
    onRemove: (code: string) => void
    onToggleReturn: (code: string) => void
    total: number
}

export function SaleCart({ items, qtyInputs, onUpdateQty, onUpdateQtyInput, onRemove, onToggleReturn, total }: SaleCartProps) {

    const handleInputChange = (code: string, value: string) => {
        if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
            onUpdateQtyInput(code, value)
            if (value !== "" && value !== "." && !value.endsWith(".")) {
                const n = Number.parseFloat(value)
                if (!Number.isNaN(n)) onUpdateQty(code, n)
            }
        }
    }

    const handleInputBlur = (code: string, currentValue: string) => {
        let value = currentValue
        if (value.endsWith(".")) value = value.slice(0, -1)

        if (value === "") {
            onUpdateQtyInput(code, "")
            onUpdateQty(code, 0)
        } else {
            const n = Number.parseFloat(value)
            if (Number.isNaN(n) || n === 0) {
                onUpdateQtyInput(code, "")
                onUpdateQty(code, 0)
            } else {
                onUpdateQtyInput(code, n.toFixed(2))
                onUpdateQty(code, n)
            }
        }
    }

    return (
        <div className="flex flex-col h-full">
            <Label className="shrink-0">Items de la Venta</Label>

            {/* Container principal del carrito */}
            <div className="mt-2 border rounded-lg flex flex-col flex-1 min-h-0 bg-gray-50/50 overflow-hidden">
                {items.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-gray-400 text-center">No hay productos seleccionados</p>
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        {/* Lista Scrollable */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0" style={{ scrollbarGutter: "stable" }}>
                            {items.map((item) => {
                                const isReturn = item.qty < 0
                                const absQty = Math.abs(item.qty)
                                const qtyInput = qtyInputs[item.code] ?? absQty.toFixed(2)
                                return (
                                    <div
                                        key={item.code}
                                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-2 sm:p-3 rounded-lg shadow-sm border transition-colors gap-2 ${isReturn
                                            ? "bg-red-50 border-red-200"
                                            : "bg-white border-gray-200"
                                            }`}
                                    >
                                        <div className="flex-1 min-w-0 mr-0 sm:mr-2">
                                            <div className="flex items-center gap-2">
                                                <h4 className={`font-medium truncate text-sm ${isReturn ? "text-red-600" : ""}`}>{item.name}</h4>
                                                {isReturn && (
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-red-500 bg-red-100 px-1.5 py-0.5 rounded shrink-0">
                                                        Devolución
                                                    </span>
                                                )}
                                                {item.discountApplied && item.discountApplied > 0 && (
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-0.5">
                                                        <Tag className="w-2.5 h-2.5" />
                                                        {item.offerName || 'Oferta'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center text-xs text-gray-500 gap-2">
                                                <span className="truncate max-w-[100px]">{item.code.replace(/__RET$/, '')}</span>
                                                {item.brand && <span className="truncate max-w-[100px] hidden sm:inline">• {item.brand}</span>}
                                                {item.discountApplied && item.discountApplied > 0 && item.originalPrice && (
                                                    <span className="text-emerald-600">
                                                        <span className="line-through text-gray-400 mr-1">{formatCurrency(item.originalPrice)}</span>
                                                        {formatCurrency(item.priceSale - item.discountApplied)}/u
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                                            {/* Toggle return mode */}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        size="icon"
                                                        variant={isReturn ? "default" : "outline"}
                                                        className={`h-7 w-7 ${isReturn ? "bg-red-500 hover:bg-red-600 text-white" : "hover:bg-red-50 hover:text-red-600 hover:border-red-300"}`}
                                                        onClick={() => onToggleReturn(item.code)}
                                                    >
                                                        <RotateCcw className="w-3 h-3" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    {isReturn ? "Quitar devolución" : "Marcar como devolución"}
                                                </TooltipContent>
                                            </Tooltip>

                                            <Button
                                                type="button" size="icon" variant="outline" className="h-7 w-7"
                                                onClick={() => {
                                                    const newAbsQty = Math.max(0, absQty - 1)
                                                    onUpdateQty(item.code, newAbsQty)
                                                    onUpdateQtyInput(item.code, newAbsQty.toFixed(2))
                                                }}
                                            >
                                                <Minus className="w-3 h-3" />
                                            </Button>

                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                value={qtyInput}
                                                onChange={(e) => handleInputChange(item.code, e.target.value)}
                                                onBlur={(e) => handleInputBlur(item.code, e.target.value)}
                                                className="w-16 h-8 text-center text-sm px-1"
                                            />

                                            <Button
                                                type="button" size="icon" variant="outline" className="h-7 w-7"
                                                onClick={() => {
                                                    const newAbsQty = absQty + 1
                                                    onUpdateQty(item.code, newAbsQty)
                                                    onUpdateQtyInput(item.code, newAbsQty.toFixed(2))
                                                }}
                                            >
                                                <Plus className="w-3 h-3" />
                                            </Button>

                                            <div className={`w-20 text-right font-medium text-sm mx-1 ${isReturn ? "text-red-600" : ""}`}>
                                                {formatCurrency(item.qty * (item.discountApplied ? item.priceSale - item.discountApplied : item.priceSale))}
                                            </div>

                                            <Button
                                                type="button" size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => onRemove(item.code)}
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Total fijo al fondo del container de items */}
                        <div className="p-3 sm:p-4 bg-white border-t mt-auto shadow-sm z-10">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">Subtotal Items: {items.length}</span>
                                <div className={`text-xl font-bold ${total < 0 ? "text-red-600" : "text-gray-900"}`}>
                                    Total: {formatCurrency(total)}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}