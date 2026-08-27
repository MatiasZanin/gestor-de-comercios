import { ConfirmAccountForm } from "@/components/auth/confirm-account-form";
import { LoginCarouselPanel } from "@/components/auth/login-carousel-panel";
import { GysLogo } from "@/components/shared/gys-logo";

export default function ConfirmarCuentaPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(0,154,97,0.10),_transparent_35%),linear-gradient(135deg,_#f8fafc_0%,_#f7fbf9_55%,_#f8fafc_100%)] p-4 sm:p-6 lg:p-8">
      <div className="grid w-full max-w-[1180px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_70px_-24px_rgba(15,23,42,0.28)] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="order-2 lg:order-1">
          <ConfirmAccountForm />
        </div>
        <div className="order-1 lg:order-2">
          <LoginCarouselPanel compact />
        </div>
      </div>
      <footer className="mt-6 text-center text-sm text-slate-600">
        <span>
          © 2026 <GysLogo />. Todos los derechos reservados.
        </span>
      </footer>
    </main>
  );
}
