"use client"

import { CreditCard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatBillingPrice } from "@/lib/billing/subscription-presentation"
import type { BillingStatusResponse, PublicBillingConfig } from "@/lib/types/api"

interface SubscriptionRequiredModalProps {
  open: boolean
  loading: boolean
  status: BillingStatusResponse | null
  config: PublicBillingConfig | null
  fallbackOwner: boolean | null
  onOpenChange: (open: boolean) => void
  onManageSubscription: () => void
}

export function SubscriptionRequiredModal({
  open,
  loading,
  status,
  config,
  fallbackOwner,
  onOpenChange,
  onManageSubscription,
}: SubscriptionRequiredModalProps) {
  const isOwner = status?.canManageSubscription ?? fallbackOwner
  const hasDetails = !!status && !!config
  const trialEligible = status?.trialEligible === true
  const price = config ? formatBillingPrice(config) : null

  let title = "Suscripción requerida"
  let description = "La suscripción es necesaria para realizar esta operación. No pudimos consultar sus condiciones vigentes."
  let actionLabel = isOwner === true ? "Ir a Suscripción" : null

  if (hasDetails && isOwner === true && trialEligible) {
    title = "Activá tu período de prueba"
    description = `Para continuar, debés iniciar el período de prueba. ${config.trialDays} días gratis; después, ${price} por mes.`
    actionLabel = "Activar promoción"
  } else if (hasDetails && isOwner === true) {
    title = "Reactivá tu suscripción"
    description = `Para continuar, necesitás reactivar la suscripción. El valor vigente es ${price} por mes.`
    actionLabel = "Reactivar suscripción"
  } else if (hasDetails && isOwner === false && trialEligible) {
    description = `Para continuar, el propietario del comercio debe iniciar el período de prueba de ${config.trialDays} días gratis. Después, el valor vigente es ${price} por mes.`
  } else if (hasDetails && isOwner === false) {
    description = `Para continuar, el propietario del comercio debe reactivar la suscripción. El valor vigente es ${price} por mes.`
  } else if (isOwner === false) {
    description = "Para continuar, pedile al propietario del comercio que active o reactive la suscripción."
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[101] sm:max-w-md"
        overlayClassName="z-[100]"
        aria-describedby="subscription-required-description"
      >
        {loading ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Consultando suscripción</DialogTitle>
              <DialogDescription id="subscription-required-description">
                Consultando las condiciones vigentes de la suscripción.
              </DialogDescription>
            </DialogHeader>
            <div className="flex min-h-32 flex-col items-center justify-center gap-3 text-center" aria-label="Consultando suscripción">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
              <p className="text-sm text-gray-600">Consultando las condiciones vigentes…</p>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription id="subscription-required-description" className="leading-6">
                {description}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              {actionLabel ? (
                <>
                  <Button variant="outline" onClick={() => onOpenChange(false)}>Ahora no</Button>
                  <Button onClick={onManageSubscription} className="bg-emerald-600 hover:bg-emerald-700">
                    <CreditCard className="h-4 w-4" />
                    {actionLabel}
                  </Button>
                </>
              ) : (
                <Button onClick={() => onOpenChange(false)}>Entendido</Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
