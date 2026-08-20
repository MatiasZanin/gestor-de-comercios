"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api/client"
import type { ScaleBarcodeConfig } from "@/lib/types/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ScaleBarcodeConfigModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ScaleBarcodeConfigModal({ open, onOpenChange }: ScaleBarcodeConfigModalProps) {
  const [valueType, setValueType] = useState<"weight" | "price">("weight")
  const [unit, setUnit] = useState<"kg" | "g">("kg")
  const [decimals, setDecimals] = useState(3)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    setError("")
    apiClient.getScaleBarcodeConfig()
      .then(({ scaleBarcodeConfig }) => {
        if (!active) return
        setValueType(scaleBarcodeConfig.valueType)
        setDecimals(scaleBarcodeConfig.decimals)
        if (scaleBarcodeConfig.valueType === "weight") setUnit(scaleBarcodeConfig.unit)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "No se pudo cargar la configuración")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [open])

  const handleSave = async () => {
    setSaving(true)
    setError("")
    const config: ScaleBarcodeConfig = valueType === "weight"
      ? { valueType, unit, decimals }
      : { valueType, decimals }
    try {
      await apiClient.updateScaleBarcodeConfig(config)
      toast.success("Configuración de balanza guardada")
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la configuración")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar balanza</DialogTitle>
          <DialogDescription>
            Indicá cómo está formado el valor de cinco dígitos de las etiquetas EAN-13.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-sm text-gray-500">Cargando configuración...</div>
        ) : (
          <div className="space-y-4">
            {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <div className="space-y-2">
              <Label htmlFor="scale-value-type">Valor codificado</Label>
              <Select value={valueType} onValueChange={(value) => setValueType(value as "weight" | "price")}>
                <SelectTrigger id="scale-value-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weight">Peso</SelectItem>
                  <SelectItem value="price">Precio total</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {valueType === "weight" && (
              <div className="space-y-2">
                <Label htmlFor="scale-unit">Unidad utilizada por la balanza</Label>
                <Select value={unit} onValueChange={(value) => setUnit(value as "kg" | "g")}>
                  <SelectTrigger id="scale-unit"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Kilogramos (kg)</SelectItem>
                    <SelectItem value="g">Gramos (g)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="scale-decimals">
                {valueType === "weight" ? "Decimales del peso" : "Decimales del precio"}
              </Label>
              <Select value={String(decimals)} onValueChange={(value) => setDecimals(Number(value))}>
                <SelectTrigger id="scale-decimals"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5].map((value) => (
                    <SelectItem key={value} value={String(value)}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Ejemplo: 00750 con {decimals} decimales se interpreta como {750 / 10 ** decimals}.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={handleSave} disabled={loading || saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
