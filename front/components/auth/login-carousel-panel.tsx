"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, MessageCircleQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import { loginCarouselItems } from "./login-carousel-items";

const WHATSAPP_HELP_URL = "https://wa.me/541133593078";

export function LoginCarouselPanel({ compact = false }: { compact?: boolean }) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  const updateCurrent = useCallback((carouselApi: CarouselApi) => {
    if (carouselApi) setCurrent(carouselApi.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!api) return;

    updateCurrent(api);
    api.on("select", updateCurrent);
    api.on("reInit", updateCurrent);

    return () => {
      api.off("select", updateCurrent);
      api.off("reInit", updateCurrent);
    };
  }, [api, updateCurrent]);

  return (
    <aside
      className={cn(
        "relative overflow-hidden bg-[linear-gradient(145deg,#00a86b_0%,#009a61_48%,#007a4d_100%)] text-white",
        compact
          ? "flex min-h-[250px] flex-col lg:min-h-[680px]"
          : "hidden min-h-[680px] lg:flex lg:flex-col",
      )}
    >
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/8 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-emerald-950/15 blur-3xl" />

      <div
        className={cn(
          "relative z-10 justify-end px-8 pt-8",
          compact ? "hidden lg:flex" : "flex",
        )}
      >
        <a
          href={WHATSAPP_HELP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/18 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          <MessageCircleQuestion className="size-4" aria-hidden="true" />
          Necesito ayuda
        </a>
      </div>

      <Carousel
        setApi={setApi}
        opts={{ loop: true, align: "center" }}
        className={cn(
          "relative z-10 flex flex-1 flex-col justify-center",
          compact
            ? "px-5 py-5 sm:px-8 lg:px-12 lg:pb-8 lg:pt-4"
            : "px-12 pb-8 pt-4",
        )}
        aria-label="Beneficios de Gestor de Comercios"
      >
        <CarouselContent className="ml-0">
          {loginCarouselItems.map((item) => (
            <CarouselItem key={item.path} className="pl-0">
              <div className="mx-auto flex max-w-[520px] flex-col items-center text-center">
                <div
                  className={cn(
                    "relative aspect-[16/10] w-full",
                    compact
                      ? "mb-2 max-w-[190px] lg:mb-7 lg:max-w-none"
                      : "mb-7",
                  )}
                >
                  <Image
                    src={item.path}
                    alt=""
                    fill
                    priority={item.path === loginCarouselItems[0].path}
                    sizes="(min-width: 1024px) 45vw, 0px"
                    className="object-contain"
                  />
                </div>
                <h2
                  className={cn(
                    "font-semibold tracking-tight",
                    compact
                      ? "text-lg lg:text-2xl xl:text-[28px]"
                      : "text-2xl xl:text-[28px]",
                  )}
                >
                  {item.title}
                </h2>
                <p
                  className={cn(
                    "max-w-md text-emerald-50/85",
                    compact
                      ? "mt-1 text-xs leading-5 lg:mt-3 lg:text-sm lg:leading-6 xl:text-base"
                      : "mt-3 text-sm leading-6 xl:text-base",
                  )}
                >
                  {item.desc}
                </p>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        <div
          className={cn(
            "flex items-center justify-center gap-4",
            compact ? "mt-3 lg:mt-7" : "mt-7",
          )}
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => api?.scrollPrev()}
            className="size-9 rounded-full border border-white/15 text-white hover:bg-white/15 hover:text-white"
            aria-label="Ver beneficio anterior"
          >
            <ArrowLeft className="size-4" />
          </Button>

          <div
            className="flex items-center gap-2"
            aria-label={`Diapositiva ${current + 1} de ${loginCarouselItems.length}`}
          >
            {loginCarouselItems.map((item, index) => (
              <button
                key={item.path}
                type="button"
                onClick={() => api?.scrollTo(index)}
                className={cn(
                  "h-2 rounded-full bg-white/35 transition-[width,background-color] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                  index === current ? "w-6 bg-white" : "w-2 hover:bg-white/65",
                )}
                aria-label={`Ir a la diapositiva ${index + 1}`}
                aria-current={index === current ? "true" : undefined}
              />
            ))}
          </div>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => api?.scrollNext()}
            className="size-9 rounded-full border border-white/15 text-white hover:bg-white/15 hover:text-white"
            aria-label="Ver beneficio siguiente"
          >
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </Carousel>
    </aside>
  );
}
