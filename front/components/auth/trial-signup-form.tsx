"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { createPublicRegistration, getBillingCopy } from "@/lib/api/public";
import { savePendingRegistrationNavigation } from "@/lib/auth/pending-registration";
import type { PublicBillingConfig } from "@/lib/types/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cloneElement, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

const passwordRules = [
  { label: "8 caracteres", test: (value: string) => value.length >= 8 },
  { label: "una mayúscula", test: (value: string) => /[A-Z]/.test(value) },
  { label: "una minúscula", test: (value: string) => /[a-z]/.test(value) },
  { label: "un número", test: (value: string) => /\d/.test(value) },
  {
    label: "un carácter especial",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
];

function normalizeArgentinePhone(value: string): string | null {
  const raw = value.trim();
  const parsed = parsePhoneNumberFromString(
    raw.startsWith("+") ? raw : `+54${raw.replace(/\D/g, "")}`,
  );
  return parsed?.isValid() ? parsed.number : null;
}

const signupSchema = z.object({
  firstName: z.string().trim().min(2, "Ingresá tu nombre"),
  lastName: z.string().trim().min(2, "Ingresá tu apellido"),
  phoneNumber: z
    .string()
    .refine(
      (value) => Boolean(normalizeArgentinePhone(value)),
      "Ingresá un teléfono argentino válido",
    ),
  email: z.string().trim().email("Ingresá un email válido"),
  password: z
    .string()
    .refine(
      (value) => passwordRules.every((rule) => rule.test(value)),
      "La contraseña no cumple todos los requisitos",
    ),
  merchantName: z.string().trim().min(2, "Ingresá el nombre del comercio"),
  acceptTerms: z
    .boolean()
    .refine(Boolean, "Debés aceptar los términos y condiciones"),
});

type SignupValues = z.infer<typeof signupSchema>;

export function TrialSignupForm({ config }: { config: PublicBillingConfig }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  const billingCopy = useMemo(() => getBillingCopy(config), [config]);
  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    mode: "onChange",
    shouldUnregister: false,
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      email: "",
      password: "",
      merchantName: "",
      acceptTerms: false,
    },
  });
  const password = useWatch({ control: form.control, name: "password" });

  useEffect(() => {
    titleRef.current?.focus();
  }, [step]);

  const continueToAccess = async () => {
    setError(null);
    const valid = await form.trigger(
      ["merchantName", "firstName", "lastName", "phoneNumber"],
      { shouldFocus: true },
    );
    if (valid) setStep(2);
  };

  const onSubmit = async (values: SignupValues) => {
    if (step !== 2) return;
    const phoneNumber = normalizeArgentinePhone(values.phoneNumber);
    if (!phoneNumber) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await createPublicRegistration({
        ...values,
        phoneNumber,
      });
      savePendingRegistrationNavigation({
        registrationId: response.registrationId,
        email: response.email,
        source: "signup",
        attemptId: crypto.randomUUID(),
      });
      router.push("/confirmar-cuenta");
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo crear la cuenta",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="flex min-h-[680px] flex-col justify-center rounded-none border-0 bg-white px-2 py-8 shadow-none sm:px-8 lg:px-10 xl:px-14">
      <CardHeader className="space-y-7 pb-6 text-left">
        <div
          className="flex items-center gap-3"
          aria-label="Gestor de Comercios"
        >
          <Image
            src="/logo.png"
            alt=""
            width={44}
            height={44}
            priority
            className="size-11 rounded-xl object-cover shadow-sm ring-1 ring-slate-200"
          />
          <span className="font-[Crimson] text-2xl font-semibold tracking-tight text-slate-900 text-title">
            Gestor <span className="text-title-blue">de</span> Comercios
          </span>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-emerald-700">
            Paso {step} de 3
          </p>
          <Progress
            value={(step / 3) * 100}
            className="mb-5 h-2"
            aria-label={`Paso ${step} de 3`}
          />
          <CardTitle
            ref={titleRef}
            tabIndex={-1}
            className="text-3xl font-semibold tracking-tight text-slate-950 outline-none"
          >
            {step === 1 ? "Vos y tu comercio" : "Datos de acceso"}
          </CardTitle>
          <CardDescription className="mt-2 text-sm leading-6 text-slate-600">
            {step === 1
              ? `Creá tu cuenta y probá Gestor de Comercios gratis durante ${config.trialDays} días.`
              : "Elegí los datos con los que vas a ingresar al sistema."}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        {error ? (
          <Alert className="mb-5 border-red-200 bg-red-50" role="alert">
            <AlertDescription className="text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        ) : null}
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          {step === 1 ? (
            <div key="identity-step" className="space-y-5">
              <Field
                id="merchantName"
                label="Nombre del comercio"
                error={form.formState.errors.merchantName?.message}
              >
                <Input
                  id="merchantName"
                  autoComplete="organization"
                  placeholder="Ej.: Almacén Los Amigos"
                  {...form.register("merchantName")}
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="firstName"
                  label="Nombre"
                  error={form.formState.errors.firstName?.message}
                >
                  <Input
                    id="firstName"
                    autoComplete="given-name"
                    {...form.register("firstName")}
                  />
                </Field>
                <Field
                  id="lastName"
                  label="Apellido"
                  error={form.formState.errors.lastName?.message}
                >
                  <Input
                    id="lastName"
                    autoComplete="family-name"
                    {...form.register("lastName")}
                  />
                </Field>
              </div>
              <Field
                id="phoneNumber"
                label="Número de teléfono"
                error={form.formState.errors.phoneNumber?.message}
                hint="Usamos +54 (Argentina). No enviaremos códigos por SMS."
              >
                <div className="flex h-11 overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-emerald-600/30">
                  <span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
                    +54
                  </span>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="11 2345-6789"
                    className="h-full rounded-none border-0 shadow-none focus-visible:ring-0"
                    {...form.register("phoneNumber")}
                  />
                </div>
              </Field>
              <Button
                type="button"
                size="lg"
                onClick={continueToAccess}
                className="h-12 w-full bg-[#009A61] text-white hover:bg-[#007a4d]"
              >
                Continuar <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : (
            <div key="access-step" className="space-y-5">
              <Field
                id="email"
                label="Email"
                error={form.formState.errors.email?.message}
              >
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="tu@email.com"
                  {...form.register("email")}
                />
              </Field>
              <Field
                id="password"
                label="Contraseña"
                error={form.formState.errors.password?.message}
              >
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="pr-11"
                    {...form.register("password")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 size-9"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={
                      showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                </div>
              </Field>
              <ul
                className="grid gap-1.5 text-sm sm:grid-cols-2"
                aria-label="Requisitos de contraseña"
              >
                {passwordRules.map((rule) => {
                  const met = rule.test(password);
                  return (
                    <li
                      key={rule.label}
                      className={
                        met
                          ? "flex items-center gap-2 text-emerald-700"
                          : "flex items-center gap-2 text-slate-500"
                      }
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
              <div>
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <Controller
                    name="acceptTerms"
                    control={form.control}
                    render={({ field }) => (
                      <Checkbox
                        id="acceptTerms"
                        checked={field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true)
                        }
                        aria-invalid={Boolean(
                          form.formState.errors.acceptTerms,
                        )}
                        aria-describedby={
                          form.formState.errors.acceptTerms
                            ? "acceptTerms-error"
                            : "acceptTerms-description"
                        }
                        className="mt-0.5"
                      />
                    )}
                  />
                  <div>
                    <Label htmlFor="acceptTerms" className="leading-5">
                      Acepto los términos y condiciones
                    </Label>
                    <p
                      id="acceptTerms-description"
                      className="mt-1 text-sm leading-5 text-slate-600"
                    >
                      {billingCopy}
                    </p>
                  </div>
                </div>
                {form.formState.errors.acceptTerms ? (
                  <p
                    id="acceptTerms-error"
                    className="mt-2 text-sm text-red-600"
                  >
                    {form.formState.errors.acceptTerms.message}
                  </p>
                ) : null}
              </div>
              <div className="flex items-start gap-2.5 text-sm leading-5 text-slate-600">
                <ShieldCheck
                  className="mt-0.5 size-4 shrink-0 text-[#009A61]"
                  aria-hidden="true"
                />
                <span>
                  Los datos de pago se ingresan únicamente en Mercado Pago. No
                  almacenamos datos de tarjeta.
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={submitting}
                  onClick={() => setStep(1)}
                  className="h-12"
                >
                  <ArrowLeft className="size-4" /> Volver
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  className="h-12 bg-[#009A61] text-white hover:bg-[#007a4d]"
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowRight className="size-4" />
                  )}
                  Crear cuenta y continuar
                </Button>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactElement<{
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }>;
}) {
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, {
        "aria-invalid": Boolean(error),
        "aria-describedby": descriptionId,
      })}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {!error && hint ? (
        <p id={`${id}-hint`} className="text-sm text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
