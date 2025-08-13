"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { apiClient } from "@/lib/api/client"
import type { Product, CreateProductRequest, UpdateProductRequest } from "@/lib/types/api"

interface ProductFormProps {
  product?: Product | null
  onSuccess: () => void
  onCancel: () => void
}

export function ProductForm({ product, onSuccess, onCancel }: ProductFormProps) {
  const [formData, setFormData] = useState({
    code: product?.code || "",
    name: product?.name || "",
    priceBuy: product?.priceBuy || 0,
    priceSale: product?.priceSale || 0,
    notes: product?.notes || "",
    uom: product?.uom || "",
    qtyStep: product?.qtyStep || 1,
    isActive: product?.isActive ?? true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      if (product) {
        // Actualizar producto existente
        const updateData: UpdateProductRequest = {
          name: formData.name,
          priceBuy: formData.priceBuy,
          priceSale: formData.priceSale,
          notes: formData.notes,
          uom: formData.uom,
          qtyStep: formData.qtyStep,
          isActive: formData.isActive,
        }
        await apiClient.updateProduct(product.code, updateData)
      } else {
        // Crear nuevo producto
        const createData: CreateProductRequest = {
          code: formData.code,
          name: formData.name,
          priceBuy: formData.priceBuy,
          priceSale: formData.priceSale,
          notes: formData.notes,
          uom: formData.uom,
          qtyStep: formData.qtyStep,
          isActive: formData.isActive,
        }
        await apiClient.createProduct(createData)
      }
      onSuccess()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error al guardar producto")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{product ? "Editar Producto" : "Nuevo Producto"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!product && (
              <div>
                <Label htmlFor="code">Código *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                />
              </div>
            )}

            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priceBuy">Precio Compra *</Label>
                <Input
                  id="priceBuy"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.priceBuy}
                  onChange={(e) => setFormData({ ...formData, priceBuy: Number.parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="priceSale">Precio Venta *</Label>
                <Input
                  id="priceSale"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.priceSale}
                  onChange={(e) => setFormData({ ...formData, priceSale: Number.parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="uom">Unidad de Medida *</Label>
                <Input
                  id="uom"
                  value={formData.uom}
                  onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                  placeholder="ej: unidad, kg"
                  required
                />
              </div>
              <div>
                <Label htmlFor="qtyStep">Múltiplo Venta *</Label>
                <Input
                  id="qtyStep"
                  type="number"
                  min="1"
                  value={formData.qtyStep}
                  onChange={(e) => setFormData({ ...formData, qtyStep: Number.parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Producto activo</Label>
            </div>

            {error && <div className="text-red-600 text-sm">{error}</div>}

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
                {loading ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
