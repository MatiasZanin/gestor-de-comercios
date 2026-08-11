import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { EstadoCuentaClient } from "./estado-cuenta-client"

export default function EstadoCuentaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_45%),linear-gradient(180deg,_#f8fafc_0%,_#fff7ed_100%)]">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-slate-600">Consultando el estado de la cuenta...</p>
          </div>
        </div>
      }
    >
      <EstadoCuentaClient />
    </Suspense>
  )
}
