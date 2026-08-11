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
import {
  confirmRegistrationEmail,
  createPublicRegistration,
  getBillingCopy,
  resendRegistrationCode,
} from "@/lib/api/public"
import { ArrowRight, Loader2, MailCheck, ShieldCheck, Sparkles } from "lucide-react"

const signupSchema = z.object({
  firstName: z.string().trim().min(2, "Ingresá tu nombre"),
  lastName: z.string().trim().min(2, "Ingresá tu apellido"),
  email: z.string().trim().email("Ingresá un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  merchantName: z.string().trim().min(2, "Ingresá el nombre del comercio"),
  acceptTerms: z.boolean().refine(Boolean, "Debés aceptar los términos y condiciones"),
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
    defaultValues: { firstName: "", lastName: "", email: "", password: "", merchantName: "", acceptTerms: false },
  })

  const onSubmit = async (values: SignupValues) => {
    setSubmitting(true)
    setError(null)
    try {
      const response = await createPublicRegistration(values)
      localStorage.setItem("pendingRegistrationId", response.registrationId)
      setRegistrationId(response.registrationId)
      setMaskedEmail(response.maskedEmail)
      if (response.status !== "email_verification_pending") {
        window.location.assign("/login?next=/suscripcion")
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
    <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="flex flex-col justify-center gap-6">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-sm font-medium text-emerald-900 shadow-sm">
          <Sparkles className="h-4 w-4" />
          {billingCopy}
        </div>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Tu comercio, listo para trabajar. La suscripción empieza cuando vos decidís.
        </h1>
        <p className="max-w-2xl text-lg leading-7 text-slate-600">
          Verificamos tu email, creamos el comercio y después elegís la suscripción desde una pantalla segura.
          Los datos de pago se ingresan únicamente en Mercado Pago.
        </p>
      </div>

      <Card className="border-slate-200/80 bg-white/90 shadow-2xl shadow-emerald-950/5">
        <CardHeader>
          <CardTitle className="text-2xl">{registrationId ? "Verificá tu email" : "Crear cuenta"}</CardTitle>
          <CardDescription>
            {registrationId ? `Ingresá el código que enviamos a ${maskedEmail}.` : "El email será tu usuario para iniciar sesión."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? <Alert className="mb-4 border-red-200 bg-red-50"><AlertDescription className="text-red-700">{error}</AlertDescription></Alert> : null}
          {message ? <Alert className="mb-4 border-emerald-200 bg-emerald-50"><AlertDescription className="text-emerald-800">{message}</AlertDescription></Alert> : null}

          {registrationId ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <MailCheck className="mb-2 h-5 w-5" />
                La cuenta ya fue creada. Solo falta comprobar que el email te pertenece.
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmationCode">Código de verificación</Label>
                <Input id="confirmationCode" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} className="text-center text-2xl tracking-[0.4em]" />
              </div>
              <Button type="button" size="lg" disabled={submitting} onClick={verifyCode} className="w-full bg-slate-950 text-white hover:bg-slate-800">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
                Confirmar email
              </Button>
              <Button type="button" variant="ghost" disabled={submitting} onClick={resend} className="w-full">Reenviar código</Button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" error={form.formState.errors.firstName?.message}><Input id="firstName" autoComplete="given-name" {...form.register("firstName")} /></Field>
                <Field label="Apellido" error={form.formState.errors.lastName?.message}><Input id="lastName" autoComplete="family-name" {...form.register("lastName")} /></Field>
              </div>
              <Field label="Email" error={form.formState.errors.email?.message}><Input id="email" type="email" autoComplete="email" {...form.register("email")} /></Field>
              <Field label="Nombre del comercio" error={form.formState.errors.merchantName?.message}><Input id="merchantName" autoComplete="organization" {...form.register("merchantName")} /></Field>
              <Field label="Contraseña" error={form.formState.errors.password?.message}><Input id="password" type="password" autoComplete="new-password" {...form.register("password")} /></Field>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <Controller name="acceptTerms" control={form.control} render={({ field }) => <Checkbox id="acceptTerms" checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />} />
                  <div><Label htmlFor="acceptTerms">Acepto los términos y condiciones</Label><p className="mt-1 text-sm text-slate-600">{billingCopy}</p></div>
                </div>
                {form.formState.errors.acceptTerms ? <p className="mt-2 text-sm text-red-600">{form.formState.errors.acceptTerms.message}</p> : null}
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"><ShieldCheck className="h-4 w-4" />No almacenamos datos de tarjeta.</div>
              <Button type="submit" size="lg" disabled={submitting || form.formState.isSubmitting} className="w-full bg-slate-950 text-white hover:bg-slate-800">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Crear cuenta
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}{error ? <p className="text-sm text-red-600">{error}</p> : null}</div>
}
