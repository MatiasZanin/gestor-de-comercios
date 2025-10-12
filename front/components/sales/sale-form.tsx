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
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [showOtherModal, setShowOtherModal] = useState(false)
  const [otherPrice, setOtherPrice] = useState<string>("")
  const [otherPriceError, setOtherPriceError] = useState("")
  const [showSuccess, setShowSuccess] = useState(false)
  // Estado para inputs de cantidad de cada item
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    if (!showSuccess) return
    const id = setTimeout(() => {
      setShowSuccess(false)
      onSuccess()
    }, 2000)
    return () => clearTimeout(id)
  }, [showSuccess, onSuccess])

  const loadProducts = async () => {
    setLoadingProducts(true)
    try {
      const response = await apiClient.listProducts({ isActive: true })
      setProducts(response.items)
    } catch (error) {
      console.error("Error loading products:", error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const openOtherModal = () => {
    setOtherPrice("")
    setOtherPriceError("")
    setShowOtherModal(true)
  }

  const addOtherItem = (price: number) => {
    const newItem: SaleItem = {
      code: "-1",
      name: "Otros",
      qty: 1,
      priceBuy: 0,
      priceSale: price,
      uom: "un",
    }
    setSelectedItems((items) => [...items, newItem])
    setQtyInputs((prev) => ({ ...prev, "-1": "1.00" }))
  }

  const confirmOther = () => {
    const value = parseFloat(otherPrice.replace(",", "."))
    if (isNaN(value) || value <= 0) {
      setOtherPriceError("Ingresá un precio válido mayor a 0")
      return
    }
    addOtherItem(value)
    setShowOtherModal(false)
  }

  const addItem = (product: Product) => {
    const existingItem = selectedItems.find((item) => item.code === product.code)
    if (existingItem) {
      setSelectedItems((items) =>
        items.map((item) => (item.code === product.code ? { ...item, qty: item.qty + 1 } : item)),
      )
      setQtyInputs((prev) => {
        const currentQty = existingItem.qty + 1
        return { ...prev, [product.code]: currentQty.toFixed(2) }
      })
    } else {
      const newItem: SaleItem = {
        code: product.code,
        name: product.name,
        qty: 1,
        priceBuy: product.priceBuy || 0,
        priceSale: product.priceSale,
        uom: product.uom,
      }
      setSelectedItems((items) => [...items, newItem])
      setQtyInputs((prev) => ({ ...prev, [product.code]: "1.00" }))
    }
  }

  const updateItemQty = (code: string, qty: number) => {
    if (isNaN(qty)) return
    const safeQty = qty < 0 ? 0 : qty
    setSelectedItems((items) => items.map((item) => (item.code === code ? { ...item, qty: safeQty } : item)))
  }

  const removeItem = (code: string) => {
    setSelectedItems((items) => items.filter((item) => item.code !== code))
    setQtyInputs((prev) => {
      const newInputs = { ...prev }
      delete newInputs[code]
      return newInputs
    })
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
      // Refrescar productos y limpiar items/inputs al finalizar la venta
      await loadProducts()
      setSelectedItems([])
      setQtyInputs({})
      setNotes("")
      setSearchTerm("")
      setShowSuccess(true)
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

  // Detecta EAN-13 de balanza (peso variable) y devuelve { plu, qty }
  const parseVariableWeightEAN13 = (raw: string) => {
    const digits = (raw || "").replace(/\D/g, "")
    if (digits.length !== 13) return null
    if (digits[0] !== "2") return null
    // Formato típico: 2 + 5 (PLU) + 5 (peso/precio) + 1 (check)
    const plu = digits.slice(1, 6) // 5 dígitos de código de producto
    const weightPart = digits.slice(6, 11) // 5 dígitos de peso/precio
    const wNum = Number.parseInt(weightPart, 10)
    if (Number.isNaN(wNum)) return null
    // Por defecto interpretamos como KG con 3 decimales (xxxxx => xx.xxx kg)
    // Si tu balanza codifica distinto (p.ej., /100), ajustar aquí.
    let qty = wNum / 1000
    return { plu, qty }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
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
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();

                      // --- EAN-13 de balanza (peso variable) ---
                      const parsedScale = parseVariableWeightEAN13(searchTerm)
                      if (parsedScale) {
                        const { plu, qty } = parsedScale
                        // Buscar por código exacto (permitiendo cero-padding en catálogo si aplica)
                        const candidate = products.find(p => {
                          const code = (p.code || "")
                          return code === plu || code.padStart(5, "0") === plu
                        })

                        if (candidate) {
                          // No agregar "Otros" ni ítems sin stock (si se controla stock)
                          if (candidate.code !== "-1" && !(typeof candidate.stock === "number" && candidate.stock <= 0)) {
                            const existingItem = selectedItems.find(it => it.code === candidate.code)
                            if (existingItem) {
                              const newQty = existingItem.qty + qty
                              updateItemQty(candidate.code, newQty)
                              setQtyInputs(prev => ({ ...prev, [candidate.code]: newQty.toFixed(2) }))
                            } else {
                              addItem(candidate)
                              // addItem agrega 1 por defecto; lo ajustamos al qty leído
                              const finalQty = qty
                              updateItemQty(candidate.code, finalQty)
                              setQtyInputs(prev => ({ ...prev, [candidate.code]: finalQty.toFixed(2) }))
                            }
                            // Limpiar búsqueda tras escaneo
                            setSearchTerm("")
                            return
                          }
                        }
                        // Si no se encontró, continúa con la lógica existente
                      }

                      // Nada que agregar si no hay resultados
                      if (!filteredProducts || filteredProducts.length === 0) return;

                      // 1) Si hay un solo producto => agregarlo
                      if (filteredProducts.length === 1) {
                        const onlyOne = filteredProducts[0];
                        if (onlyOne.code === "-1") {
                          openOtherModal();
                          return;
                        }
                        if (typeof onlyOne.stock === "number" && onlyOne.stock <= 0) return;
                        addItem(onlyOne);
                        return;
                      }

                      // 2) Si hay más de uno => intentar coincidencia exacta por código
                      const term = (searchTerm || "").trim().toLowerCase();
                      let candidate = filteredProducts.find(p => (p.code || "").toLowerCase() === term);

                      // 3) Si no hay coincidencia exacta => tomar el primero de la lista
                      if (!candidate) {
                        candidate = filteredProducts[0];
                      }

                      // Manejo de "Otros" (code -1)
                      if (candidate.code === "-1") {
                        openOtherModal();
                        return;
                      }

                      // Respetar stock si está definido: solo agregar si hay stock
                      if (typeof candidate.stock === "number" && candidate.stock <= 0) {
                        // Intentar un fallback al primer producto con stock > 0
                        const withStock = filteredProducts.find(p => typeof p.stock === "number" ? p.stock > 0 : true);
                        if (withStock) {
                          if (withStock.code === "-1") {
                            openOtherModal();
                            return;
                          }
                          addItem(withStock);
                        }
                        return;
                      }

                      addItem(candidate);
                    }}
                    className="mb-4"
                  />
                  <div className="border rounded-lg h-[300px] max-h-[300px] overflow-y-scroll" style={{ scrollbarGutter: "stable" }}>
                    {loadingProducts ? (
                      <div className="flex items-center justify-center h-full">
                        <span className="text-gray-500 text-center w-full">Cargando productos...</span>
                      </div>
                    ) : (
                      <>
                        {filteredProducts.map((product) => (
                          <div key={product.code} className="p-3 border-b last:border-b-0 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium">{product.name}</h4>
                                <div className="text-sm text-gray-600">
                                  <span>{product.code}</span>
                                  <span className="mx-2">•</span>
                                  <span>Stock: {product.stock} {product.uom}</span>
                                  <span className="mx-2">•</span>
                                  <span>{formatCurrency(product.priceSale)}</span>
                                </div>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  if (product.code === "-1") {
                                    openOtherModal()
                                    return
                                  } else {
                                    addItem(product)
                                  }
                                }}
                                disabled={product.stock <= 0}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
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
                      <div className="max-h-[260px] h-[260px] overflow-y-scroll" style={{ scrollbarGutter: "stable" }}>
                        {selectedItems.map((item) => (
                          <div key={item.code} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <h4 className="font-medium">{item.name}</h4>
                              <p className="text-sm text-gray-600">{item.code}</p>
                            </div>
                            {(() => {
                              const productRef = products.find((p) => p.code === item.code)
                              const uom = productRef?.uom || ""
                              const qtyInput = qtyInputs[item.code] ?? item.qty.toString()
                              return (
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const newQty = Math.max(0, item.qty - 1)
                                      updateItemQty(item.code, newQty)
                                      setQtyInputs((prev) => ({ ...prev, [item.code]: newQty.toFixed(2) }))
                                    }}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </Button>

                                  {/* Input editable de cantidad: solo dígitos y punto decimal */}
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={qtyInput}
                                    onChange={(e) => {
                                      const value = e.target.value
                                      // Solo permitir números, punto decimal y vacío - hasta 2 decimales
                                      if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
                                        setQtyInputs((prev) => ({ ...prev, [item.code]: value }))
                                        // Parsear solo cuando el valor es numérico estable
                                        if (value !== "" && value !== "." && !value.endsWith(".")) {
                                          const n = Number.parseFloat(value)
                                          if (!Number.isNaN(n)) {
                                            updateItemQty(item.code, n)
                                          }
                                        }
                                      }
                                    }}
                                    onBlur={(e) => {
                                      let value = e.target.value
                                      // Si termina en ".", quita el punto suelto
                                      if (value.endsWith(".")) value = value.slice(0, -1)
                                      if (value === "") {
                                        setQtyInputs((prev) => ({ ...prev, [item.code]: "" }))
                                        updateItemQty(item.code, 0)
                                      } else {
                                        const n = Number.parseFloat(value)
                                        if (Number.isNaN(n) || n === 0) {
                                          setQtyInputs((prev) => ({ ...prev, [item.code]: "" }))
                                          updateItemQty(item.code, 0)
                                        } else {
                                          setQtyInputs((prev) => ({ ...prev, [item.code]: n.toFixed(2) }))
                                          updateItemQty(item.code, n)
                                        }
                                      }
                                    }}
                                    className="w-20 text-center"
                                  />

                                  {/* UOM al lado de la cantidad */}
                                  <span className="w-10 text-center text-gray-600">{uom}</span>

                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const newQty = item.qty + 1
                                      updateItemQty(item.code, newQty)
                                      setQtyInputs((prev) => ({ ...prev, [item.code]: newQty.toFixed(2) }))
                                    }}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>

                                  <span className="w-24 text-right">{formatCurrency(item.qty * item.priceSale)}</span>
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
                              )
                            })()}
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
          {/* Modal para ingresar precio de "Otros" */}
          {showOtherModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6">
                <h3 className="text-lg font-semibold mb-4">Precio para "Otros"</h3>
                <Label htmlFor="otherPrice">Ingresá el precio</Label>
                <Input
                  id="otherPrice"
                  type="text"
                  inputMode="decimal"
                  value={otherPrice}
                  onChange={(e) => {
                    setOtherPrice(e.target.value)
                    setOtherPriceError("")
                  }}
                  placeholder="0,00"
                  className="mt-1"
                />
                {otherPriceError && (
                  <p className="text-red-600 text-sm mt-2">{otherPriceError}</p>
                )}
                <div className="flex justify-end gap-2 mt-6">
                  <Button type="button" variant="outline" onClick={() => setShowOtherModal(false)}>
                    Cancelar
                  </Button>
                  <Button type="button" className="bg-orange-600 hover:bg-orange-700" onClick={confirmOther}>
                    Agregar
                  </Button>
                </div>
              </div>
            </div>
          )}
          {loading && (
            <div className="fixed inset-0 bg-white/50 flex items-center justify-center z-50">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
            </div>
          )}
          {showSuccess && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70]">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6 text-center">
                <h3 className="text-lg font-semibold mb-2">¡Venta creada!</h3>
                <p className="text-sm text-gray-600">La venta se registró con éxito.</p>
                <p className="text-xs text-gray-500 mt-1">Se cerrará automáticamente en 2 segundos…</p>
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowSuccess(false)
                      onSuccess()
                    }}
                  >
                    Cerrar ahora
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
