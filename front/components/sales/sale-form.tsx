"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Minus, X } from "lucide-react"
import { apiClient } from "@/lib/api/client"
import type { Product, CreateSaleRequest, SaleItem } from "@/lib/types/api"

interface SaleFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function SaleForm({ onSuccess, onCancel }: SaleFormProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedItems, setSelectedItems] = useState<SaleItem[]>([])
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      const response = await apiClient.listProducts({ isActive: true })
      setProducts(response.items)
    } catch (error) {
      console.error("Error loading products:", error)
    }
  }

  const addItem = (product: Product) => {
    const existingItem = selectedItems.find((item) => item.code === product.code)

    if (existingItem) {
      setSelectedItems((items) =>
        items.map((item) => (item.code === product.code ? { ...item, qty: item.qty + product.qtyStep } : item)),
      )
    } else {
      const newItem: SaleItem = {
        code: product.code,
        name: product.name,
        qty: product.qtyStep,
        priceBuy: product.priceBuy || 0,
        priceSale: product.priceSale,
      }
      setSelectedItems((items) => [...items, newItem])
    }
  }

  const updateItemQty = (code: string, qty: number) => {
    if (qty <= 0) {
      removeItem(code)
      return
    }

    setSelectedItems((items) => items.map((item) => (item.code === code ? { ...item, qty } : item)))
  }

  const removeItem = (code: string) => {
    setSelectedItems((items) => items.filter((item) => item.code !== code))
  }

  const calculateTotal = () => {
    return selectedItems.reduce((total, item) => total + item.qty * item.priceSale, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedItems.length === 0) {
      setError("Debe agregar al menos un producto")
      return
    }

    setLoading(true)
    setError("")

    try {
      const saleData: CreateSaleRequest = {
        items: selectedItems,
        notes: notes.trim() || undefined,
      }

      await apiClient.createSale(saleData)
      onSuccess()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error al registrar venta")
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.code.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(amount)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader>
          <CardTitle>Nueva Venta</CardTitle>
        </CardHeader>
        <CardContent className="overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Selección de productos */}
              <div>
                <Label>Seleccionar Productos</Label>
                <div className="mt-2">
                  <Input
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mb-4"
                  />
                  <div className="border rounded-lg h-[300px] max-h-[300px] overflow-y-auto">
                    {filteredProducts.map((product) => (
                      <div key={product.code} className="p-3 border-b last:border-b-0 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium">{product.name}</h4>
                            <div className="text-sm text-gray-600">
                              <span>{product.code}</span>
                              <span className="mx-2">•</span>
                              <span>Stock: {product.stock}</span>
                              <span className="mx-2">•</span>
                              <span>{formatCurrency(product.priceSale)}</span>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => addItem(product)}
                            disabled={product.stock <= 0}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Items seleccionados */}
              <div>
                <Label>Items de la Venta</Label>
                <div className="mt-2 border rounded-lg p-4 min-h-64">
                  {selectedItems.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No hay productos seleccionados</p>
                  ) : (
                    <div className="space-y-3 max-h-[320px] h-[320px] ">
                      <div className="max-h-[260px] h-[260px] overflow-y-auto ">
                        {selectedItems.map((item) => (
                          <div key={item.code} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <h4 className="font-medium">{item.name}</h4>
                              <p className="text-sm text-gray-600">{item.code}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => updateItemQty(item.code, item.qty - 1)}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-12 text-center">{item.qty}</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => updateItemQty(item.code, item.qty + 1)}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                              <span className="w-20 text-right">{formatCurrency(item.qty * item.priceSale)}</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => removeItem(item.code)}
                                className="text-red-600"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t pt-3 mt-4">
                        <div className="flex justify-between items-center text-lg font-bold">
                          <span>Total:</span>
                          <span>{formatCurrency(calculateTotal())}</span>
                        </div>
                      </div>
                    </div>
                  )}



                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Comentarios adicionales sobre la venta..."
              />
            </div>

            {error && <div className="text-red-600 text-sm">{error}</div>}

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading || selectedItems.length === 0}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {loading ? "Registrando..." : "Registrar Venta"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
