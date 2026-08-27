"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Store } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { authService } from "@/lib/auth/cognito";

export default function ResetPasswordPage() {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const requestCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await authService.requestPasswordReset(username);
      setCodeSent(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo enviar el código",
      );
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      setError(
        "La contraseña debe tener 8 caracteres e incluir mayúscula, minúscula, número y símbolo",
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      await authService.confirmPasswordReset(username, code, password);
      setComplete(true);
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "No se pudo actualizar la contraseña",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_45%),linear-gradient(180deg,_#f8fafc_0%,_#fff7ed_100%)] p-4">
      <Card className="w-full max-w-md border-0 bg-white/90 shadow-2xl backdrop-blur">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600">
            <Store className="h-7 w-7 text-white" />
          </div>
          <CardTitle>Restablecer contraseña</CardTitle>
          <CardDescription>
            Usá tu email y el código enviado por Cognito.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {complete ? (
            <div className="space-y-5 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
              <p className="text-gray-700">
                La contraseña se actualizó correctamente.
              </p>
              <Button asChild className="w-full">
                <Link href="/login">Volver al acceso</Link>
              </Button>
            </div>
          ) : (
            <form
              onSubmit={codeSent ? confirmReset : requestCode}
              className="space-y-4"
            >
              {error ? (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">
                    {error}
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="reset-username">Email</Label>
                <Input
                  id="reset-username"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  readOnly={codeSent}
                  required
                />
              </div>
              {codeSent ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="reset-code">Código</Label>
                    <Input
                      id="reset-code"
                      inputMode="numeric"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reset-password">Nueva contraseña</Label>
                    <Input
                      id="reset-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reset-confirm">Confirmar contraseña</Label>
                    <Input
                      id="reset-confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      required
                    />
                  </div>
                </>
              ) : null}
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {codeSent ? "Cambiar contraseña" : "Enviar código"}
              </Button>
              {codeSent ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setCodeSent(false)}
                >
                  Cambiar email
                </Button>
              ) : null}
              <div className="text-center text-sm">
                <Link href="/login" className="text-emerald-700">
                  Volver al acceso
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
