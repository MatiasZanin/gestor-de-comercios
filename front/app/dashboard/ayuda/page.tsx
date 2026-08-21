import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { SupportChannels } from "@/components/support/support-channels";
import { SupportRequestForm } from "@/components/support/support-request-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Headphones } from "lucide-react";

export default function HelpPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900 sm:text-3xl">
            <Headphones
              className="h-7 w-7 text-emerald-600"
              aria-hidden="true"
            />
            Necesito ayuda
          </h1>
          <p className="mt-2 text-sm text-gray-600 sm:text-base">
            Contanos qué pasó y nuestro equipo te ayudará a resolverlo.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Card className="border-0 bg-white/90 shadow-lg">
            <CardHeader>
              <CardTitle>Formulario de soporte</CardTitle>
              <CardDescription>
                Completá los datos para que podamos entender el inconveniente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SupportRequestForm />
            </CardContent>
          </Card>

          <Card className="border-0 bg-white/90 shadow-lg">
            <CardHeader>
              <CardTitle>Canales de Ayuda</CardTitle>
              <CardDescription>
                También podés comunicarte directamente por alguno de estos
                medios.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SupportChannels />
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
