import { Button } from "@/components/ui/button"

interface SuccessModalProps {
    onClose: () => void
}

export function SuccessModal({ onClose }: SuccessModalProps) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70]">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6 text-center">
                <h3 className="text-lg font-semibold mb-2">¡Venta creada!</h3>
                <p className="text-sm text-gray-600">La venta se registró con éxito.</p>
                <p className="text-xs text-gray-500 mt-1">Se cerrará automáticamente en 5 segundos…</p>
                <div className="flex justify-center gap-2 mt-4">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cerrar ahora
                    </Button>
                </div>
            </div>
        </div>
    )
}