"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  confirmRegistrationEmail,
  createPublicRegistration,
  getBillingCopy,
  resendRegistrationCode,
} from "@/lib/api/public"
import type { PublicBillingConfig } from "@/lib/types/api"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, Loader2, MailCheck, ShieldCheck } from "lucide-react"
import Image from "next/image"
import { cloneElement, useMemo, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { GysLogo } from "../shared/gys-logo"

const signupSchema = z.object({
  firstName: z.string().trim().min(2, "Ingresá tu nombre"),
  lastName: z.string().trim().min(2, "Ingresá tu apellido"),
  email: z.string().trim().email("Ingresá un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  confirmPassword: z.string().min(1, "Confirmá tu contraseña"),
  merchantName: z.string().trim().min(2, "Ingresá el nombre del comercio"),
  acceptTerms: z.boolean().refine(Boolean, "Debés aceptar los términos y condiciones"),
}).refine((values) => values.password === values.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
})

type SignupValues = z.infer<typeof signupSchema>

export function TrialSignupForm({ config }: { config: PublicBillingConfig }) {
  const [registrationId, setRegistrationId] = useState<string | null>(null)
  const [maskedEmail, setMaskedEmail] = useState("")
  const [code, setCode] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const billingCopy = useMemo(() => getBillingCopy(config), [config])
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", confirmPassword: "", merchantName: "", acceptTerms: false },
  })

  const onSubmit = async (values: SignupValues) => {
    setSubmitting(true)
    setError(null)
    try {
      const { confirmPassword: _, ...registration } = values
      const response = await createPublicRegistration(registration)
      localStorage.setItem("pendingRegistrationId", response.registrationId)
      setRegistrationId(response.registrationId)
      setMaskedEmail(response.maskedEmail)
      if (response.status !== "email_verification_pending") {
        window.location.assign("/login?next=/dashboard/suscripcion")
      }
    } catch (err: any) {
      setError(err?.message || "No se pudo crear la cuenta")
    } finally {
      setSubmitting(false)
    }
  }

  const verifyCode = async () => {
    if (!registrationId || !/^\d{6}$/.test(code)) {
      setError("Ingresá el código de 6 dígitos")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const response = await confirmRegistrationEmail(registrationId, code)
      window.location.assign(response.loginUrl)
    } catch (err: any) {
      setError(err?.message || "No se pudo confirmar el email")
    } finally {
      setSubmitting(false)
    }
  }

  const resend = async () => {
    if (!registrationId) return
    setSubmitting(true)
    setError(null)
    try {
      await resendRegistrationCode(registrationId)
      setMessage("Te enviamos un código nuevo.")
    } catch (err: any) {
      setError(err?.message || "No se pudo reenviar el código")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-[760px] gap-0 overflow-hidden rounded-3xl border-slate-200/80 bg-white py-0 shadow-[0_24px_70px_-24px_rgba(15,23,42,0.24)]">
      <CardHeader className="gap-0 px-5 pb-7 pt-7 text-center sm:px-10 sm:pb-8 sm:pt-9 md:px-14">
        <div className="mx-auto flex items-center gap-3" aria-label="Gestor de Comercios">
          <Image src="/logo.png" alt="" width={44} height={44} priority className="size-11 rounded-xl object-cover shadow-sm ring-1 ring-slate-200" />
          <span className="font-[Crimson] text-2xl font-semibold tracking-tight text-slate-900 text-title">
            Gestor <span className="text-title-blue">de</span> Comercios
          </span>
        </div>

        {registrationId ? (
          <div className="mt-8">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Verificá tu email</h1>
            <CardDescription className="mx-auto mt-3 max-w-md text-base leading-6 text-slate-600">
              Ingresá el código de 6 dígitos que enviamos a <strong className="font-medium text-slate-800">{maskedEmail}</strong>.
            </CardDescription>
          </div>
        ) : (
          <>
            <div className="mt-8">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-[34px]" data-clarity-unmask="true">
                Empezá a gestionar tu comercio
              </h1>
              <CardDescription className="mx-auto mt-3 max-w-lg text-base leading-6 text-slate-600">
                Creá tu cuenta y probá Gestor de Comercios gratis durante {config.trialDays} días.
              </CardDescription>
            </div>
            {/* <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-[#007a4d]">
              <span className="flex size-5 items-center justify-center rounded-full bg-[#009A61] text-white">
                <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
              </span>
              {config.trialDays} días gratis
            </div> */}
          </>
        )}
      </CardHeader>

      <CardContent className="border-t border-slate-100 px-5 pb-7 pt-7 sm:px-10 sm:pb-9 sm:pt-8 md:px-14">
        <div aria-live="polite">
          {error ? <Alert className="mb-5 border-red-200 bg-red-50"><AlertDescription className="text-red-700">{error}</AlertDescription></Alert> : null}
          {message ? <Alert className="mb-5 border-emerald-200 bg-emerald-50"><AlertDescription className="text-emerald-800">{message}</AlertDescription></Alert> : null}
        </div>

        {registrationId ? (
          <div className="mx-auto max-w-lg space-y-5">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
              <MailCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p>La cuenta ya fue creada. Solo falta comprobar que el email te pertenece.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmationCode">Código de verificación</Label>
              <Input id="confirmationCode" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="h-12 rounded-lg text-center text-2xl tracking-[0.4em]" />
            </div>
            <Button type="button" size="lg" disabled={submitting} onClick={verifyCode} className="h-12 w-full rounded-lg bg-[#009A61] text-white hover:bg-[#007a4d]">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <MailCheck className="size-4" />}
              Confirmar email
            </Button>
            <Button type="button" variant="ghost" disabled={submitting} onClick={resend} className="h-11 w-full text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">Reenviar código</Button>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="firstName" label="Nombre" error={form.formState.errors.firstName?.message}><Input id="firstName" autoComplete="given-name" {...form.register("firstName")} /></Field>
              <Field id="lastName" label="Apellido" error={form.formState.errors.lastName?.message}><Input id="lastName" autoComplete="family-name" {...form.register("lastName")} /></Field>
            </div>
            <Field id="email" label="Email" error={form.formState.errors.email?.message}><Input id="email" type="email" autoComplete="email" placeholder="tu@email.com" data-clarity-unmask="true" {...form.register("email")} /></Field>
            <Field id="merchantName" label="Nombre del comercio" error={form.formState.errors.merchantName?.message}><Input id="merchantName" autoComplete="organization" placeholder="Ej.: Almacén Los Amigos" {...form.register("merchantName")} /></Field>
            <Field id="password" label="Contraseña" error={form.formState.errors.password?.message} hint="Usá al menos 8 caracteres."><Input id="password" type="password" autoComplete="new-password" placeholder="••••••••" {...form.register("password")} /></Field>
            <Field id="confirmPassword" label="Confirmar contraseña" error={form.formState.errors.confirmPassword?.message}><Input id="confirmPassword" type="password" autoComplete="new-password" placeholder="••••••••" {...form.register("confirmPassword")} /></Field>

            <div>
              <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <Controller name="acceptTerms" control={form.control} render={({ field }) => (
                  <Checkbox id="acceptTerms" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} aria-invalid={Boolean(form.formState.errors.acceptTerms)} aria-describedby={form.formState.errors.acceptTerms ? "acceptTerms-error" : "acceptTerms-description"} className="mt-0.5" />
                )} />
                <div>
                  <Label htmlFor="acceptTerms" className="leading-5">Acepto los términos y condiciones</Label>
                  <p id="acceptTerms-description" className="mt-1 text-sm leading-5 text-slate-600">{billingCopy}</p>
                </div>
              </div>
              {form.formState.errors.acceptTerms ? <p id="acceptTerms-error" className="mt-2 text-sm text-red-600">{form.formState.errors.acceptTerms.message}</p> : null}
            </div>

            <div className="flex items-start gap-2.5 text-sm leading-5 text-slate-600">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#009A61]" aria-hidden="true" />
              <span>Los datos de pago se ingresan únicamente en Mercado Pago. No almacenamos datos de tarjeta.</span>
            </div>
            <Button type="submit" size="lg" disabled={submitting || form.formState.isSubmitting} className="h-12 w-full rounded-lg bg-[#009A61] text-base text-white shadow-sm hover:bg-[#007a4d]" data-clarity-unmask="true">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              Crear cuenta gratis
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="flex justify-center text-center text-sm text-slate-600">
        <span>© 2026 <GysLogo></GysLogo>. Todos los derechos reservados.</span>
      </CardFooter>
    </Card>
  )
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactElement<React.ComponentProps<typeof Input>> }) {
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, {
        "aria-invalid": Boolean(error),
        "aria-describedby": descriptionId,
        className: "h-11 rounded-lg border-slate-300 bg-white px-3.5",
      })}
      {error ? <p id={`${id}-error`} className="text-sm text-red-600">{error}</p> : null}
      {!error && hint ? <p id={`${id}-hint`} className="text-sm text-slate-500">{hint}</p> : null}
    </div>
  )
}
