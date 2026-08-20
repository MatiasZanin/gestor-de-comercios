"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cancellationReasonSchema } from "@/lib/billing/subscription-validation"

interface CancellationDialogProps {
  open: boolean
  submitting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => Promise<boolean>
}

export function CancellationDialog({ open, submitting, onOpenChange, onConfirm }: CancellationDialogProps) {
  const [reason, setReason] = useState("")
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setReason("")
      setValidationError(null)
    }
  }, [open])

  const submit = async () => {
    const parsed = cancellationReasonSchema.safeParse(reason)
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Ingresá un motivo")
      return
    }
    setValidationError(null)
    try {
      if (await onConfirm(parsed.data)) onOpenChange(false)
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Ingresá un motivo válido")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg" aria-describedby="cancellation-description">
        <DialogHeader>
          <DialogTitle>¡Contanos por qué te vas!</DialogTitle>
          <DialogDescription id="cancellation-description">
            Tus comentarios nos ayudan a mejorar Gestión & Stock.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancellation-reason">Motivo</Label>
          <Textarea
            id="cancellation-reason"
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={1000}
            rows={5}
            aria-invalid={!!validationError}
            aria-describedby={validationError ? "cancellation-error" : "cancellation-counter"}
            placeholder="Contanos brevemente qué podríamos mejorar"
          />
          <div className="flex justify-between gap-4 text-xs">
            <span id="cancellation-error" className="text-red-600">{validationError}</span>
            <span id="cancellation-counter" className="ml-auto text-gray-500">{reason.length}/1000</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>Volver</Button>
          <Button variant="destructive" disabled={submitting} onClick={() => void submit()}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Cancelar suscripción
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
