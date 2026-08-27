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
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  changePendingRegistrationEmail,
  confirmRecoveredRegistration,
  confirmRegistrationEmail,
  recoverPendingRegistration,
  resendRegistrationCode,
} from "@/lib/api/public";
import {
  clearPendingRegistrationNavigation,
  loadPendingRegistrationNavigation,
  markAutomaticResendStarted,
} from "@/lib/auth/pending-registration";
import {
  CheckCircle2,
  Loader2,
  MailCheck,
  Pencil,
  RotateCw,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

export function ConfirmAccountForm() {
  const [registrationId, setRegistrationId] = useState<string | undefined>();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"identify" | "otp">("identify");
  const [editing, setEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const router = useRouter();

  useEffect(() => {
    const navigation = loadPendingRegistrationNavigation();
    if (!navigation) return;
    setRegistrationId(navigation.registrationId);
    setEmail(navigation.email);
    setNewEmail(navigation.email);
    setMode("otp");
    setCooldown(60);
    if (
      navigation.source === "login" &&
      markAutomaticResendStarted(navigation.attemptId)
    ) {
      setLoading(true);
      recoverPendingRegistration(navigation.email)
        .then((result) => {
          setMessage(result.message);
          setCooldown(result.cooldownSeconds);
        })
        .catch(() =>
          setMessage(
            "Si existe un alta pendiente, enviaremos un código nuevo.",
          ),
        )
        .finally(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    titleRef.current?.focus();
  }, [mode]);

  const identify = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Ingresá un email válido");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await recoverPendingRegistration(email);
      setMessage(result.message);
      setCooldown(result.cooldownSeconds);
      setMode("otp");
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo procesar la solicitud",
      );
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    setError(null);
    try {
      const result = registrationId
        ? await resendRegistrationCode(registrationId)
        : await recoverPendingRegistration(email);
      setMessage(result.message);
      setCooldown(result.cooldownSeconds);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo reenviar el código",
      );
    } finally {
      setLoading(false);
    }
  };

  const confirm = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Ingresá el código de 6 dígitos");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = registrationId
        ? await confirmRegistrationEmail(registrationId, code)
        : await confirmRecoveredRegistration(email, code);
      setSuccess(true);
      clearPendingRegistrationNavigation();
      window.setTimeout(() => router.replace(result.loginUrl), 700);
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "El código es incorrecto o venció",
      );
    } finally {
      setLoading(false);
    }
  };

  const changeEmail = async (event: FormEvent) => {
    event.preventDefault();
    if (!registrationId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await changePendingRegistrationEmail(
        registrationId,
        newEmail,
        passwordRequired ? password : undefined,
      );
      if (result.passwordRequired) {
        setPasswordRequired(true);
        setMessage(result.message ?? null);
        return;
      }
      setEmail(result.email ?? newEmail.trim().toLowerCase());
      setCode("");
      setPassword("");
      setPasswordRequired(false);
      setEditing(false);
      setCooldown(result.cooldownSeconds ?? 60);
      setMessage("Actualizamos el email y enviamos un código nuevo.");
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : "No se pudo cambiar el email",
      );
    } finally {
      setLoading(false);
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
            Paso 3 de 3
          </p>
          <Progress value={100} className="mb-5 h-2" aria-label="Paso 3 de 3" />
          <CardTitle
            ref={titleRef}
            tabIndex={-1}
            className="text-3xl font-semibold tracking-tight text-slate-950 outline-none"
          >
            Verificá tu email
          </CardTitle>
          <CardDescription className="mt-2 text-sm leading-6 text-slate-600">
            {mode === "identify" ? (
              "Ingresá el email con el que te registraste para retomar la confirmación."
            ) : (
              <>
                Enviamos un código a{" "}
                <strong className="font-medium text-slate-800">{email}</strong>.
              </>
            )}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div aria-live="polite">
          {error ? (
            <Alert className="mb-5 border-red-200 bg-red-50" role="alert">
              <AlertDescription className="text-red-700">
                {error}
              </AlertDescription>
            </Alert>
          ) : null}
          {message ? (
            <Alert className="mb-5 border-emerald-200 bg-emerald-50">
              <AlertDescription className="text-emerald-800">
                {message}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
        {success ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto size-14 text-emerald-600" />
            <p className="font-medium text-slate-900">
              Cuenta confirmada. Ya podés ingresar.
            </p>
            <Loader2 className="mx-auto size-5 animate-spin text-emerald-600" />
          </div>
        ) : mode === "identify" ? (
          <form onSubmit={identify} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="recoveryEmail">Email</Label>
              <Input
                id="recoveryEmail"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full bg-[#009A61] text-white hover:bg-[#007a4d]"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MailCheck className="size-4" />
              )}
              Enviar código
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/login">Volver a Login</Link>
            </Button>
          </form>
        ) : editing ? (
          <form onSubmit={changeEmail} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="newEmail">Email correcto</Label>
              <Input
                id="newEmail"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                required
              />
            </div>
            {passwordRequired ? (
              <div className="space-y-2">
                <Label htmlFor="changeEmailPassword">Contraseña</Label>
                <Input
                  id="changeEmailPassword"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <p className="text-sm text-slate-500">
                  Cognito requiere recrear únicamente la identidad no
                  confirmada. La contraseña no se guarda.
                </p>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setPasswordRequired(false);
                  setPassword("");
                }}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#009A61] text-white hover:bg-[#007a4d]"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Pencil className="size-4" />
                )}
                Actualizar y reenviar
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={confirm} className="space-y-5" noValidate>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-600">¿El email no es correcto?</span>
              {registrationId ? (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-emerald-700"
                  onClick={() => {
                    setNewEmail(email);
                    setEditing(true);
                    setCode("");
                  }}
                >
                  <Pencil className="size-3.5" />
                  Editar
                </Button>
              ) : (
                <Link
                  href="/registrarme"
                  className="font-medium text-emerald-700"
                >
                  Reiniciar el alta
                </Link>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmationCode">Código de verificación</Label>
              <InputOTP
                id="confirmationCode"
                maxLength={6}
                pattern="[0-9]*"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(value) => setCode(value.replace(/\D/g, ""))}
                disabled={loading}
                containerClassName="justify-center"
              >
                <InputOTPGroup>
                  {Array.from({ length: 6 }, (_, index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className="h-12 w-11 text-lg"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Alert className="border-amber-200 bg-amber-50">
              <AlertDescription className="text-amber-900">
                El correo puede tardar unos minutos. Revisá también Spam o
                Correo no deseado.
              </AlertDescription>
            </Alert>
            <Button
              type="submit"
              disabled={loading || code.length !== 6}
              className="h-12 w-full bg-[#009A61] text-white hover:bg-[#007a4d]"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MailCheck className="size-4" />
              )}
              Confirmar cuenta
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={loading || cooldown > 0}
              onClick={resend}
              className="w-full text-emerald-700"
            >
              <RotateCw className="size-4" />
              {cooldown > 0 ? `Reenviar en ${cooldown}s` : "Reenviar código"}
            </Button>
            <Button asChild variant="link" className="w-full text-slate-600">
              <Link href="/login">Volver a Login</Link>
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
