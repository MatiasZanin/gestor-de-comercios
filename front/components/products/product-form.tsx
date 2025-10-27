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
    stock: product?.stock || 0,
    isActive: product?.isActive ?? true,
  })
  const [priceBuyInput, setPriceBuyInput] = useState(
    product?.priceBuy ? product.priceBuy.toString() : ""
  )
  const [priceSaleInput, setPriceSaleInput] = useState(
    product?.priceSale ? product.priceSale.toString() : ""
  )
  const [stockInput, setStockInput] = useState(
    product?.stock ? product.stock.toString() : ""
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // --- NUEVA FUNCIÓN ---
  // Genera un código aleatorio con el formato INT-XXXX-XXXX
  const generateSKU = () => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let randomPart = ""
    for (let i = 0; i < 8; i++) {
      randomPart += alphabet.charAt(Math.floor(Math.random() * alphabet.length))
    }
    // Formatea como INT-XXXX-XXXX
    return `INT-${randomPart.substring(0, 4)}-${randomPart.substring(4, 8)}`
  }

  // --- NUEVA FUNCIÓN ---
  // Manejador para el botón de generar código
  const handleGenerateCode = () => {
    const newCode = generateSKU()
    setFormData({ ...formData, code: newCode })
  }
  // --------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Normalizar a 2 decimales antes de enviar
    if (priceBuyInput !== "" && !priceBuyInput.endsWith(".")) {
      const n = Number.parseFloat(priceBuyInput)
      if (!Number.isNaN(n)) setPriceBuyInput(n.toFixed(2))
    }
    if (priceSaleInput !== "" && !priceSaleInput.endsWith(".")) {
      const n = Number.parseFloat(priceSaleInput)
      if (!Number.isNaN(n)) setPriceSaleInput(n.toFixed(2))
    }
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
          stock: formData.stock,
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
          stock: formData.stock,
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
            {/* --- BLOQUE DE CÓDIGO MODIFICADO --- */}
            {!product && (
              <div className="mt-2">
                <Label className="mb-2" htmlFor="code">
                  Código (SKU, EAN, etc.) *
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() }) // Opcional: forzar mayúsculas
                    }
                    placeholder="Ej: MART-01"
                    required
                  />
                  <Button
                    type="button" // Importante: previene el submit del formulario
                    variant="outline"
                    onClick={handleGenerateCode}
                    className="whitespace-nowrap" // Evita que el texto se parta
                  >
                    Generar
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Ingresa un código único (SKU, EAN) o genera uno automático.
                </p>
              </div>
            )}
            {/* --- FIN DEL BLOQUE MODIFICADO --- */}

            <div className="mt-2">
              <Label className="mb-2" htmlFor="name">
                Nombre *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="mt-2">
                <Label className="mb-2" htmlFor="priceBuy">
                  Precio Compra *
                </Label>
                <Input
                  id="priceBuy"
                  type="text"
                  value={priceBuyInput}
                  onChange={(e) => {
                    const value = e.target.value
                    // Solo permitir números, punto decimal y vacío - hasta 2 decimales
                    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
                      setPriceBuyInput(value)
                      // Parsear solo cuando el valor es numérico estable (no "." ni termina en ".")
                      if (value !== "" && value !== "." && !value.endsWith(".")) {
                        const n = Number.parseFloat(value)
                        if (!Number.isNaN(n)) {
                          setFormData({ ...formData, priceBuy: n })
                        }
                      }
                    }
                  }}
                  onBlur={(e) => {
                    let value = e.target.value
                    // Si termina en ".", quita el punto suelto
                    if (value.endsWith(".")) value = value.slice(0, -1)
                    if (value === "") {
                      setPriceBuyInput("")
                      setFormData({ ...formData, priceBuy: 0 })
                    } else {
                      const n = Number.parseFloat(value)
                      if (Number.isNaN(n) || n === 0) {
                        setPriceBuyInput("")
                        setFormData({ ...formData, priceBuy: 0 })
                      } else {
                        setPriceBuyInput(n.toFixed(2))
                        setFormData({ ...formData, priceBuy: n })
                      }
                    }
                  }}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="mt-2">
                <Label className="mb-2" htmlFor="priceSale">
                  Precio Venta *
                </Label>
                <Input
                  id="priceSale"
                  type="text"
                  value={priceSaleInput}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
                      setPriceSaleInput(value)
                      if (value !== "" && value !== "." && !value.endsWith(".")) {
                        const n = Number.parseFloat(value)
                        if (!Number.isNaN(n)) {
                          setFormData({ ...formData, priceSale: n })
                        }
                      }
                    }
                  }}
                  onBlur={(e) => {
                    let value = e.target.value
                    if (value.endsWith(".")) value = value.slice(0, -1)
                    if (value === "") {
                      setPriceSaleInput("")
                      setFormData({ ...formData, priceSale: 0 })
                    } else {
                      const n = Number.parseFloat(value)
                      if (Number.isNaN(n) || n === 0) {
                        setPriceSaleInput("")
                        setFormData({ ...formData, priceSale: 0 })
                      } else {
                        setPriceSaleInput(n.toFixed(2))
                        setFormData({ ...formData, priceSale: n })
                      }
                    }
                  }}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="mt-2">
                <Label className="mb-2" htmlFor="uom">
                  Unidad de Medida *
                </Label>
                <Input
                  id="uom"
                  value={formData.uom}
                  onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                  placeholder="ej: unidad, kg"
                  required
                />
              </div>
              <div className="mt-2">
                <Label className="mb-2" htmlFor="stock">
                  Stock *
                </Label>
                <Input
                  id="stock"
                  type="text"
                  value={stockInput}
                  onChange={(e) => {
                    const value = e.target.value
                    // Solo permitir dígitos y vacío (enteros)
                    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
                      setStockInput(value)
                      // Actualizar formData solo cuando hay un número (no vacío)
                      if (value !== "") {
                        const n = Number.parseFloat(value)
                        if (!Number.isNaN(n)) {
                          setFormData({ ...formData, stock: n })
                        }
                      }
                    }
                  }}
                  onBlur={(e) => {
                    let value = e.target.value
                    if (value.endsWith(".")) value = value.slice(0, -1)
                    if (value === "") {
                      setStockInput("")
                      setFormData({ ...formData, stock: 0 })
                    } else {
                      const n = Number.parseFloat(value)
                      if (Number.isNaN(n) || n === 0) {
                        setStockInput("")
                        setFormData({ ...formData, stock: 0 })
                      } else {
                        setStockInput(n.toFixed(2))
                        setFormData({ ...formData, stock: n })
                      }
                    }
                  }}
                  placeholder="0"
                  required
                />
              </div>
            </div>

            <div className="mt-2">
              <Label className="mb-2" htmlFor="notes">
                Notas
              </Label>
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
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
              <Label className="mb-2" htmlFor="isActive">
                Producto activo
              </Label>
            </div>

            {error && <div className="text-red-600 text-sm">{error}</div>}

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}