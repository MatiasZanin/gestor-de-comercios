"use client"

import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { HelpCircle } from "lucide-react"
import { apiClient } from "@/lib/api/client"
import type { Product, CreateProductRequest, UpdateProductRequest } from "@/lib/types/api"
import CreatableSelect from "react-select/creatable"
import ReactSelect from "react-select"

const scrollbarStyles = {
  scrollbarWidth: 'thin',
  scrollbarColor: '#cbd5e1 #f1f1f1'
} as React.CSSProperties;

const UOM_OPTIONS = [
  { value: "u", label: "Unidad (u)" },
  { value: "g", label: "Gramo (g)" },
  { value: "kg", label: "Kilogramo (kg)" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "l", label: "Litro (l)" },
  { value: "mm", label: "Milímetro (mm)" },
  { value: "cm", label: "Centímetro (cm)" },
  { value: "m", label: "Metro (m)" },
]

interface ProductFormProps {
  product?: Product | null
  products?: Product[]
  onSuccess: () => void
  onCancel: () => void
}

interface CategoryOption {
  value: string
  label: string
}

interface BrandOption {
  value: string
  label: string
}

export function ProductForm({ product, products = [], onSuccess, onCancel }: ProductFormProps) {
  const [formData, setFormData] = useState({
    code: product?.code || "",
    name: product?.name || "",
    priceBuy: product?.priceBuy || 0,
    priceSale: product?.priceSale || 0,
    notes: product?.notes || "",
    uom: product?.uom || "",
    stock: product?.stock || 0,
    minStock: product?.minStock || 0,
    isActive: product?.isActive ?? true,
    category: product?.category || "",
    brand: product?.brand || "",
  })

  const [priceBuyInput, setPriceBuyInput] = useState(product?.priceBuy ? product.priceBuy.toString() : "")
  const [priceSaleInput, setPriceSaleInput] = useState(product?.priceSale ? product.priceSale.toString() : "")
  const [stockInput, setStockInput] = useState(product?.stock ? product.stock.toString() : "")
  const [minStockInput, setMinStockInput] = useState(product?.minStock ? product.minStock.toString() : "")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showUomHelp, setShowUomHelp] = useState(false)
  const [showCodeHelp, setShowCodeHelp] = useState(false)
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const metadata = await apiClient.getMetadata()
        const options = (metadata.categories || []).map((cat: string) => ({
          value: cat,
          label: cat,
        }))
        setCategoryOptions(options)
      } catch (err) {
        console.error("Error loading categories:", err)
      } finally {
        setLoadingCategories(false)
      }
    }
    loadCategories()
  }, [])

  const brandOptions: BrandOption[] = useMemo(() => {
    const uniqueBrands = [...new Set(products.map(p => p.brand).filter(Boolean))] as string[]
    return uniqueBrands.map(brand => ({ value: brand, label: brand }))
  }, [products])

  const generateSKU = () => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let randomPart = ""
    for (let i = 0; i < 8; i++) {
      randomPart += alphabet.charAt(Math.floor(Math.random() * alphabet.length))
    }
    return `INT-${randomPart.substring(0, 4)}-${randomPart.substring(4, 8)}`
  }

  const handleGenerateCode = () => {
    const newCode = generateSKU()
    setFormData({ ...formData, code: newCode })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
      const payload = {
        name: formData.name,
        priceBuy: formData.priceBuy,
        priceSale: formData.priceSale,
        notes: formData.notes,
        uom: formData.uom,
        stock: formData.stock,
        minStock: formData.minStock || undefined,
        isActive: formData.isActive,
        category: formData.category || undefined,
        brand: formData.brand || undefined,
      }

      if (product) {
        await apiClient.updateProduct(product.code, payload as UpdateProductRequest)
      } else {
        await apiClient.createProduct({ ...payload, code: formData.code } as CreateProductRequest)
      }
      onSuccess()
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Error al guardar producto")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center sm:p-4 z-50">
      <Card className="w-full sm:max-w-2xl h-full sm:h-auto sm:max-h-[95vh] flex flex-col bg-white shadow-2xl gap-0 rounded-none sm:rounded-xl">

        <CardHeader className="border-b bg-gray-50/50 sm:rounded-t-xl shrink-0 py-3 sm:py-4">
          <CardTitle className="text-xl">
            {product ? "Editar Producto" : "Nuevo Producto"}
          </CardTitle>
          {error && (
            <div className="mt-3 p-3 bg-red-100 border border-red-200 text-red-700 rounded-md text-sm font-medium">
              {error}
            </div>
          )}
        </CardHeader>

        <CardContent
          className="overflow-y-auto flex-1 p-4 sm:p-6 scrollbar-visible"
          style={scrollbarStyles}
        >
          <form id="product-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">

            <div className="space-y-2">
              {!product ? (
                <>
                  <div className="flex items-center gap-1">
                    <Label htmlFor="code">Código *</Label>
                    <button type="button" onClick={() => setShowCodeHelp(true)} className="text-gray-400 hover:text-gray-600">
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="Ej: MART-01"
                      required
                    />
                    <Button type="button" variant="outline" onClick={handleGenerateCode}>
                      Generar
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col">
                  <Label className="text-gray-500">Código</Label>
                  <span className="font-mono font-medium text-lg text-gray-700 mt-1">{product.code}</span>
                </div>
              )}
            </div>

            <div className="flex items-end justify-start md:justify-end h-full pt-4 md:pt-0">
              <div className="flex items-center space-x-3">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <div className="flex flex-col">
                  <Label htmlFor="isActive" className="font-medium cursor-pointer">Producto Activo</Label>
                  <span className="text-xs text-gray-500">Visible en ventas</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="name">Nombre del Producto *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Martillo Galponero"
                required
                className="text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <CreatableSelect
                id="category"
                isClearable
                isLoading={loadingCategories}
                options={categoryOptions}
                value={formData.category ? { value: formData.category, label: formData.category } : null}
                onChange={(option) => setFormData({ ...formData, category: option?.value || "" })}
                onCreateOption={(inputValue) => {
                  const newOption = { value: inputValue, label: inputValue }
                  setCategoryOptions((prev) => [...prev, newOption])
                  setFormData({ ...formData, category: inputValue })
                }}
                placeholder="Seleccionar..."
                formatCreateLabel={(v) => `Crear "${v}"`}
                styles={{ control: (base) => ({ ...base, borderColor: "hsl(var(--input))" }) }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Marca</Label>
              <CreatableSelect
                id="brand"
                isClearable
                options={brandOptions}
                value={formData.brand ? { value: formData.brand, label: formData.brand } : null}
                onChange={(option) => setFormData({ ...formData, brand: option?.value || "" })}
                onCreateOption={(v) => setFormData({ ...formData, brand: v })}
                placeholder="Seleccionar..."
                formatCreateLabel={(v) => `Crear "${v}"`}
                styles={{ control: (base) => ({ ...base, borderColor: "hsl(var(--input))" }) }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priceBuy">Precio Compra ($) *</Label>
              <Input
                id="priceBuy"
                type="text"
                value={priceBuyInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setPriceBuyInput(v);
                }}
                onBlur={() => {
                  const n = parseFloat(priceBuyInput);
                  if (!isNaN(n)) setFormData(prev => ({ ...prev, priceBuy: n }));
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priceSale">Precio Venta ($) *</Label>
              <Input
                id="priceSale"
                type="text"
                value={priceSaleInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setPriceSaleInput(v);
                }}
                onBlur={() => {
                  const n = parseFloat(priceSaleInput);
                  if (!isNaN(n)) setFormData(prev => ({ ...prev, priceSale: n }));
                }}
                required
                className="font-bold text-emerald-600"
              />
            </div>

            <div className="flex gap-4">
              <div className="w-1/2 space-y-2">
                <Label htmlFor="stock">Stock *</Label>
                <Input
                  id="stock"
                  value={stockInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setStockInput(v);
                  }}
                  onBlur={() => {
                    const n = parseFloat(stockInput);
                    if (!isNaN(n)) setFormData(prev => ({ ...prev, stock: n }));
                  }}
                  required
                />
              </div>
              <div className="w-1/2 space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="uom">Unidad *</Label>
                  <button type="button" onClick={() => setShowUomHelp(true)} className="text-gray-400">
                    <HelpCircle className="h-3 w-3" />
                  </button>
                </div>
                <ReactSelect
                  id="uom"
                  options={UOM_OPTIONS}
                  required
                  value={UOM_OPTIONS.find(opt => opt.value === formData.uom) || null}
                  onChange={(opt) => setFormData({ ...formData, uom: opt?.value || "" })}
                  placeholder="u, kg..."
                  styles={{ control: (base) => ({ ...base, borderColor: "hsl(var(--input))" }) }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="minStock">Alerta Stock Bajo</Label>
              </div>
              <Input
                id="minStock"
                value={minStockInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*$/.test(v)) setMinStockInput(v);
                }}
                onBlur={() => {
                  const n = parseInt(minStockInput);
                  setFormData(prev => ({ ...prev, minStock: isNaN(n) ? 0 : n }));
                }}
                placeholder="0 (opcional)"
              />
              <p className="text-xs text-gray-500">Cantidad mínima antes de avisar.</p>
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="notes">Notas / Descripción adicional</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                placeholder="Detalles internos..."
              />
            </div>

            <div className="pb-4 md:hidden"></div>
          </form>
        </CardContent>

        <div className="p-3 sm:p-4 border-t sm:rounded-b-xl flex justify-between items-center shrink-0 bg-white z-10" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <span className="text-xs text-gray-400 hidden sm:inline-block">
            * Campos requeridos para el sistema
          </span>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="product-form"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700 w-32"
            >
              {loading ? "..." : "Guardar"}
            </Button>
          </div>
        </div>

      </Card>



      <Dialog open={showUomHelp} onOpenChange={setShowUomHelp}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">¿Qué es la Unidad de Medida (UOM)?</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <p className="text-gray-600">
              La <strong>Unidad de Medida (UOM)</strong> define cómo se cuenta, pesa o mide el producto al momento de venderlo o controlar su stock.
            </p>

            {/* Categoría: Unidades */}
            <div className="flex gap-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <span className="text-xl">📦</span>
              <div>
                <p className="font-semibold text-blue-800">Cantidades enteras</p>
                <p className="text-blue-900/80 text-xs mt-1">
                  Para productos que se venden por envase cerrado o por pieza.
                </p>
                <div className="mt-2 flex gap-2">
                  <code className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs font-semibold">Unidad (u)</code>
                </div>
              </div>
            </div>

            {/* Categoría: Peso */}
            <div className="flex gap-3 p-3 bg-orange-50 rounded-lg border-l-4 border-orange-500">
              <span className="text-xl">⚖️</span>
              <div>
                <p className="font-semibold text-orange-800">Peso</p>
                <p className="text-orange-900/80 text-xs mt-1">
                  Ideal para productos sueltos, fiambrería, verdulería o carnicería (se integra con las balanzas).
                </p>
                <div className="mt-2 flex gap-2">
                  <code className="bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded text-xs font-semibold">Kilogramo (kg)</code>
                  <code className="bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded text-xs font-semibold">Gramo (g)</code>
                </div>
              </div>
            </div>

            {/* Categoría: Volumen */}
            <div className="flex gap-3 p-3 bg-teal-50 rounded-lg border-l-4 border-teal-500">
              <span className="text-xl">💧</span>
              <div>
                <p className="font-semibold text-teal-800">Líquidos y Volumen</p>
                <p className="text-teal-900/80 text-xs mt-1">
                  Para bebidas sueltas, artículos de limpieza, perfumería, etc.
                </p>
                <div className="mt-2 flex gap-2">
                  <code className="bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded text-xs font-semibold">Litro (l)</code>
                  <code className="bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded text-xs font-semibold">Mililitro (ml)</code>
                </div>
              </div>
            </div>

            {/* Categoría: Longitud */}
            <div className="flex gap-3 p-3 bg-purple-50 rounded-lg border-l-4 border-purple-500">
              <span className="text-xl">📏</span>
              <div>
                <p className="font-semibold text-purple-800">Longitud</p>
                <p className="text-purple-900/80 text-xs mt-1">
                  Útil si vendés telas, cables, mangueras o materiales de ferretería.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <code className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-xs font-semibold">Metro (m)</code>
                  <code className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-xs font-semibold">Centímetro (cm)</code>
                  <code className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-xs font-semibold">Milímetro (mm)</code>
                </div>
              </div>
            </div>

            {/* Tip de facturación/precios */}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-700 mb-2">💡 Consejo sobre el precio</p>
              <p className="text-gray-600 text-xs leading-relaxed">
                Asegurate de que el precio base que le pongas al producto corresponda exactamente a <strong>1 unidad de la medida elegida</strong>. Por ejemplo, si elegís <code className="bg-gray-200 px-1 rounded">kg</code>, el precio de venta debe ser el valor por 1 Kilogramo.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCodeHelp} onOpenChange={setShowCodeHelp}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">¿Qué es el Código de Producto?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-gray-600">
              El código es un <strong>identificador único</strong> para cada producto. Sirve para buscarlo rápidamente y evitar confusiones.
            </p>

            {/* Tipos de código */}
            <div className="flex gap-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <span className="text-xl">🏷️</span>
              <div>
                <p className="font-semibold text-blue-800">SKU (Stock Keeping Unit)</p>
                <p className="text-blue-900/80 text-xs mt-1">
                  Código interno que vos definís. Ej: <strong>GAL-CHOC-500</strong> (galleta chocolate 500g)
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
              <span className="text-xl">📊</span>
              <div>
                <p className="font-semibold text-green-800">EAN / Código de barras</p>
                <p className="text-green-900/80 text-xs mt-1">
                  Número del código de barras del producto. Ej: <strong>7790001234567</strong>
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-3 bg-orange-50 rounded-lg border-l-4 border-orange-500">
              <span className="text-xl">⚖️</span>
              <div>
                <p className="font-semibold text-orange-800">Código de Balanza (EAN-13)</p>
                <p className="text-orange-900/80 text-xs mt-1">
                  Para productos pesables. El sistema detecta automáticamente si el código empieza con <strong>2</strong>.
                </p>
                <div className="mt-2 grid grid-cols-1 gap-1 text-[10px] uppercase tracking-wider font-bold text-orange-700">
                  <div className="flex justify-between bg-orange-100 px-2 py-1 rounded">
                    <span>Prefijo</span>
                    <span>2</span>
                  </div>
                  <div className="flex justify-between bg-orange-200 px-2 py-1 rounded">
                    <span>PLU (Producto)</span>
                    <span>5 dígitos</span>
                  </div>
                  <div className="flex justify-between bg-orange-100 px-2 py-1 rounded">
                    <span>Peso/Precio</span>
                    <span>5 dígitos</span>
                  </div>
                </div>
                <p className="text-orange-900/60 text-[10px] mt-2 italic">
                  Ejemplo: 200123015007 interpretará 1.500kg del producto con PLU 00123.
                </p>
              </div>
            </div>

            {/* Generar automático */}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-700 mb-2">💡 ¿No tenés código?</p>
              <p className="text-gray-600 text-xs">
                Si el producto no tiene código de barras o no querés inventar uno, usá el botón <strong>&quot;Generar&quot;</strong> para crear uno automático con formato <code className="bg-gray-200 px-1 rounded">INT-XXXX-XXXX</code>.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}