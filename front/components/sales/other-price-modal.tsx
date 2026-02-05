import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface OtherPriceModalProps {
    onClose: () => void
    onConfirm: (price: number) => void
}

export function OtherPriceModal({ onClose, onConfirm }: OtherPriceModalProps) {
    const [price, setPrice] = useState("")
    const [error, setError] = useState("")

    const handleConfirm = () => {
        const value = parseFloat(price.replace(",", "."))
        if (isNaN(value) || value <= 0) {
            setError("Ingresá un precio válido mayor a 0")
            return
        }
        onConfirm(value)
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6">
                <h3 className="text-lg font-semibold mb-4">Precio para "Otros"</h3>
                <Label htmlFor="otherPrice">Ingresá el precio</Label>
                <Input
                    id="otherPrice"
                    type="text"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => {
                        setPrice(e.target.value)
                        setError("")
                    }}
                    placeholder="0,00"
                    className="mt-1"
                />
                {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
                <div className="flex justify-end gap-2 mt-6">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="button" className="bg-orange-600 hover:bg-orange-700" onClick={handleConfirm}>
                        Agregar
                    </Button>
                </div>
            </div>
        </div>
    )
}