import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus } from "lucide-react"
import { formatCurrency } from "@/lib/utils/sales-utils"
import type { Product } from "@/lib/types/api"

interface ProductListProps {
    searchTerm: string
    onSearchChange: (val: string) => void
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
    loading: boolean
    products: Product[]
    onAdd: (p: Product) => void
    onOpenOther: () => void
}

export function ProductList({
    searchTerm,
    onSearchChange,
    onKeyDown,
    loading,
    products,
    onAdd,
    onOpenOther
}: ProductListProps) {
    return (
        <div className="flex flex-col h-full">
            <Label className="shrink-0">Seleccionar Productos</Label>
            <div className="mt-2 flex flex-col flex-1 min-h-0">
                <Input
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    className="mb-4 shrink-0"
                />
                {/* CAMBIO: border flex-1 min-h-0 para ocupar todo el resto */}
                <div className="border rounded-lg flex-1 overflow-y-auto min-h-0 bg-white" style={{ scrollbarGutter: "stable" }}>
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <span className="text-gray-500 text-center w-full">Cargando productos...</span>
                        </div>
                    ) : (
                        <>
                            {products.map((product) => (
                                <div key={product.code} className="p-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 pr-4">
                                            <h4 className="font-medium text-sm lg:text-base">
                                                {product.name}
                                                {product.brand && <span className="mx-2 text-gray-400">|</span>}
                                                <span className="text-gray-500 font-normal">{product.brand}</span>
                                            </h4>
                                            <div className="text-xs lg:text-sm text-gray-500 mt-1">
                                                <span className="font-mono bg-gray-100 px-1 rounded">{product.code}</span>
                                                <span className="mx-2">•</span>
                                                <span>Stock: {product.stock} {product.uom}</span>
                                                <span className="mx-2">•</span>
                                                <span className="font-semibold text-gray-700">{formatCurrency(product.priceSale)}</span>
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => {
                                                if (product.code === "-1") {
                                                    onOpenOther()
                                                } else {
                                                    onAdd(product)
                                                }
                                            }}
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}