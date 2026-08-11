"use client"

import { useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PublicBillingConfig } from "@/lib/types/api"
import { createPublicRegistration, getBillingCopy } from "@/lib/api/public"
import { ArrowRight, Loader2, ShieldCheck, Sparkles } from "lucide-react"

const signupSchema = z.object({
  firstName: z.string().trim().min(2, "Ingresá tu nombre"),
  lastName: z.string().trim().min(2, "Ingresá tu apellido"),
  email: z.string().trim().email("Ingresá un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  merchantName: z.string().trim().min(2, "Ingresá el nombre del comercio"),
  acceptTerms: z.boolean().refine((value) => value, {
    message: "Debés aceptar los términos y condiciones",
  }),
})

type SignupValues = z.infer<typeof signupSchema>

interface TrialSignupFormProps {
  config: PublicBillingConfig
}

export function TrialSignupForm({ config }: TrialSignupFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const billingCopy = useMemo(() => getBillingCopy(config), [config])
  const priceLabel = useMemo(
    () =>
      new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: config.currencyId || "ARS",
        minimumFractionDigits: 0,
      }).format(config.monthlyAmount || 0),
    [config.currencyId, config.monthlyAmount],
  )

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      merchantName: "",
      acceptTerms: false,
    },
  })

  const onSubmit = async (values: SignupValues) => {
    setSubmitting(true)
    setError(null)

    try {
      const response = await createPublicRegistration(values)
      if (typeof window !== "undefined") {
        window.localStorage.setItem("pendingRegistrationId", response.registrationId)
        window.localStorage.setItem("pendingRegistrationEmail", response.email)
      }
      window.location.assign(response.checkoutUrl)
    } catch (err: any) {
      setError(err?.message || "No se pudo completar el registro")
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="flex flex-col justify-center gap-6">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-sm font-medium text-emerald-900 shadow-sm backdrop-blur">
          <Sparkles className="h-4 w-4" />
          {billingCopy}
        </div>
        <div className="space-y-4">
          <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Probá el sistema un mes gratis y dejá la suscripción corriendo sola.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Creás tu comercio, te redirigimos al checkout de Mercado Pago y recién entonces la cuenta queda
            habilitada. Si no completás la autorización, no se activa nada.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            "Alta pública sin cuenta previa",
            "Trial activado por webhook confirmado",
            `Luego ${priceLabel} por mes`,
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/70 bg-white/70 p-4 text-sm text-slate-700 shadow-sm backdrop-blur"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <Card className="border-slate-200/80 bg-white/90 shadow-2xl shadow-emerald-950/5 backdrop-blur">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl text-slate-950">Crear cuenta y probar gratis</CardTitle>
          <CardDescription className="text-slate-600">
            Completá tus datos y vas a ir directo a la autorización de Mercado Pago.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
            {error ? (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombre</Label>
                <Input id="firstName" autoComplete="given-name" {...form.register("firstName")} />
                {form.formState.errors.firstName ? (
                  <p className="text-sm text-red-600">{form.formState.errors.firstName.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellido</Label>
                <Input id="lastName" autoComplete="family-name" {...form.register("lastName")} />
                {form.formState.errors.lastName ? (
                  <p className="text-sm text-red-600">{form.formState.errors.lastName.message}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
              {form.formState.errors.email ? (
                <p className="text-sm text-red-600">{form.formState.errors.email.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="merchantName">Nombre del comercio</Label>
              <Input id="merchantName" autoComplete="organization" {...form.register("merchantName")} />
              {form.formState.errors.merchantName ? (
                <p className="text-sm text-red-600">{form.formState.errors.merchantName.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
              {form.formState.errors.password ? (
                <p className="text-sm text-red-600">{form.formState.errors.password.message}</p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-start gap-3">
                <Controller
                  name="acceptTerms"
                  control={form.control}
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                      id="acceptTerms"
                    />
                  )}
                />
                <div className="space-y-1">
                  <Label htmlFor="acceptTerms" className="font-medium text-slate-900">
                    Acepto los términos y condiciones
                  </Label>
                  <p className="text-sm text-slate-600">
                    Confirmás que la suscripción será recurrente y que Mercado Pago puede intentar los cobros mensuales
                    después del trial.
                  </p>
                  {form.formState.errors.acceptTerms ? (
                    <p className="text-sm text-red-600">{form.formState.errors.acceptTerms.message}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4" />
                {billingCopy}
              </div>
              <p className="mt-1 text-emerald-900/80">
                La confirmación real de la suscripción la hace el backend cuando Mercado Pago responde por webhook.
              </p>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={submitting || form.formState.isSubmitting}
              className="w-full bg-slate-950 text-white hover:bg-slate-800"
            >
              {submitting || form.formState.isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirigiendo a Mercado Pago...
                </>
              ) : (
                <>
                  Crear cuenta y autorizar suscripción
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
