"use client"

import { Button } from "@/components/ui/button"
import { PartyPopper } from "lucide-react"

interface SuccessModalProps {
    onClose: () => void
}

export function SuccessModal({ onClose }: SuccessModalProps) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header verde con gradiente */}
                <div className="bg-gradient-to-br from-emerald-500 to-green-600 px-6 pt-8 pb-6 text-center relative overflow-hidden">
                    {/* Círculos decorativos de fondo */}
                    <div className="absolute top-[-20px] left-[-20px] w-24 h-24 rounded-full bg-white/10" />
                    <div className="absolute bottom-[-10px] right-[-10px] w-16 h-16 rounded-full bg-white/10" />
                    <div className="absolute top-4 right-6 w-8 h-8 rounded-full bg-white/10" />

                    {/* Ícono principal */}
                    <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm mb-4 ring-4 ring-white/30">
                        <PartyPopper className="w-10 h-10 text-white" strokeWidth={2} />
                    </div>

                    <h3 className="text-2xl font-extrabold text-white tracking-tight">
                        ¡Venta creada!
                    </h3>
                    <p className="text-emerald-100 text-sm mt-1 font-medium">
                        La venta se registró con éxito
                    </p>
                </div>

                {/* Footer */}
                <div className="px-6 py-5 bg-gray-50 text-center space-y-3">
                    <p className="text-xs text-gray-400">
                        Se cerrará automáticamente en 5 segundos…
                    </p>
                    <Button
                        type="button"
                        onClick={onClose}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11 rounded-lg transition-all hover:shadow-lg"
                    >
                        ¡Listo!
                    </Button>
                </div>
            </div>
        </div>
    )
}