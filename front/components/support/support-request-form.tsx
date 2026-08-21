"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api/client";
import {
  SUPPORT_PROBLEM_TYPES,
  SUPPORT_PROBLEM_TYPE_LABELS,
  supportRequestSchema,
  type SupportRequestFormValues,
} from "@/lib/support/support-request";

const emptyForm: Partial<SupportRequestFormValues> = {
  title: "",
  phone: "",
  saleTicketNumber: "",
  productCode: "",
  description: "",
};

export function SupportRequestForm() {
  const [error, setError] = useState("");
  const [successOpen, setSuccessOpen] = useState(false);
  const form = useForm<SupportRequestFormValues>({
    resolver: zodResolver(supportRequestSchema),
    defaultValues: emptyForm,
  });
  const problemType = form.watch("problemType");

  const onSubmit = async (values: SupportRequestFormValues) => {
    setError("");
    try {
      await apiClient.createSupportRequest({
        ...values,
        saleTicketNumber:
          values.problemType === "SALES" ? values.saleTicketNumber : undefined,
        productCode:
          values.problemType === "PRODUCTS" ? values.productCode : undefined,
      });
      form.reset(emptyForm);
      setSuccessOpen(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "No pudimos enviar la solicitud. Intentá nuevamente.",
      );
    }
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-5"
          noValidate
        >
          {error ? (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">
                {error}
              </AlertDescription>
            </Alert>
          ) : null}

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Título</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ej.: No puedo registrar una venta"
                    maxLength={120}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="problemType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de problema</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná una opción" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SUPPORT_PROBLEM_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {SUPPORT_PROBLEM_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {problemType === "SALES" ? (
            <FormField
              control={form.control}
              name="saleTicketNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Número de ticket de la venta{" "}
                    <span className="font-normal text-gray-500">
                      (opcional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ingresá el número de ticket"
                      maxLength={100}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          {problemType === "PRODUCTS" ? (
            <FormField
              control={form.control}
              name="productCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Código del producto{" "}
                    <span className="font-normal text-gray-500">
                      (opcional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ingresá el código del producto"
                      maxLength={100}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Número de teléfono{" "}
                  <span className="font-normal text-gray-500">(opcional)</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    inputMode="tel"
                    placeholder="Ej.: +54 11 1234-5678"
                    maxLength={30}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción del problema</FormLabel>
                <FormControl>
                  <Textarea
                    rows={7}
                    placeholder="Contanos qué ocurrió y qué estabas intentando hacer."
                    maxLength={5000}
                    className="resize-y"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Describí el problema lo más detalladamente posible para que
                  podamos ayudarte.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
          >
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar solicitud
              </>
            )}
          </Button>
        </form>
      </Form>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent>
          <DialogHeader className="items-center text-center sm:text-center">
            <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
            </span>
            <DialogTitle>Solicitud enviada</DialogTitle>
            <DialogDescription>
              Recibimos tu consulta correctamente. Pronto nos estaremos
              contactando con vos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button
              onClick={() => setSuccessOpen(false)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
