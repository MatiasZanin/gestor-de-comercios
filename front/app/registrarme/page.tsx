"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import type { PublicBillingConfig } from "@/lib/types/api";
import { getPublicBillingConfig } from "@/lib/api/public";
import { TrialSignupForm } from "@/components/auth/trial-signup-form";
import { LoginCarouselPanel } from "@/components/auth/login-carousel-panel";
import { GysLogo } from "@/components/shared/gys-logo";
import { authenticatedHome } from "@/lib/auth/account-access";

export default function RegistrarmePage() {
  const {
    isAuthenticated,
    loading,
    accountStatus,
    commerceId,
    role,
    isCommerceOwner,
  } = useAuth();
  const router = useRouter();
  const [config, setConfig] = useState<PublicBillingConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace(
        authenticatedHome({ accountStatus, commerceId, role, isCommerceOwner }),
      );
    }
  }, [
    accountStatus,
    commerceId,
    isAuthenticated,
    isCommerceOwner,
    loading,
    role,
    router,
  ]);

  useEffect(() => {
    let mounted = true;
    setConfigLoading(true);

    getPublicBillingConfig()
      .then((value) => {
        if (!mounted) return;
        setConfig(value);
        setError(null);
      })
      .catch((err: any) => {
        if (!mounted) return;
        setError(err?.message || "No se pudo cargar la configuración de alta");
      })
      .finally(() => {
        if (!mounted) return;
        setConfigLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading || isAuthenticated || configLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(0,154,97,0.10),_transparent_35%),linear-gradient(135deg,_#f8fafc_0%,_#f7fbf9_55%,_#f8fafc_100%)] px-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 size-8 animate-spin text-[#009A61]" />
          <p className="text-sm text-slate-600">Preparando tu registro...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(0,154,97,0.10),_transparent_35%),linear-gradient(135deg,_#f8fafc_0%,_#f7fbf9_55%,_#f8fafc_100%)] p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-[1180px]">
        {error ? (
          <Alert className="mb-6 w-full border-red-200 bg-red-50">
            <AlertDescription className="text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        ) : null}
        {config ? (
          <div className="grid w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_70px_-24px_rgba(15,23,42,0.28)] lg:grid-cols-[0.9fr_1.1fr]">
            <div className="order-2 lg:order-1">
              <TrialSignupForm config={config} />
            </div>
            <div className="order-1 lg:order-2">
              <LoginCarouselPanel compact />
            </div>
          </div>
        ) : null}
      </div>
      <footer className="mt-6 text-center text-sm text-slate-600">
        <span>
          © 2026 <GysLogo />. Todos los derechos reservados.
        </span>
      </footer>
    </main>
  );
}
