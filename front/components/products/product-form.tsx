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

// Estilos para scrollbar (por si acaso sigue siendo necesario en pantallas muy chicas)
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

  // Estados para inputs numéricos (manejo de decimales)
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
    // Normalizaciones finales antes de enviar
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
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error al guardar producto")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      {/* CAMBIO PRINCIPAL: max-w-2xl 
         Esto hace el modal mucho más ancho, permitiendo 2 columnas reales.
      */}
      <Card className="w-full max-w-2xl max-h-[95vh] flex flex-col bg-white shadow-2xl">

        <CardHeader className="border-b bg-gray-50/50 rounded-t-xl shrink-0 py-4">
          <CardTitle className="text-xl">
            {product ? "Editar Producto" : "Nuevo Producto"}
          </CardTitle>
        </CardHeader>

        <CardContent
          className="overflow-y-auto flex-1 p-6 scrollbar-visible"
          style={scrollbarStyles}
        >
          {/* GRID PRINCIPAL: 2 columnas en pantallas medianas (md:grid-cols-2) */}
          <form id="product-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* --- FILA 1: CÓDIGO y ESTADO --- */}
            {/* El código ocupa su espacio, el switch de activo lo ponemos a la derecha para verlo SIEMPRE */}
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

            {/* Switch de ACTIVO movido aquí arriba para visibilidad total */}
            <div className="flex items-end justify-start md:justify-end h-full pt-4 md:pt-0">
              <div className="flex items-center space-x-3">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <div className="flex flex-col">
                  <Label htmlFor="isActive" className="font-medium cursor-pointer">Producto `Activo`</Label>
                  <span className="text-xs text-gray-500">Visible en ventas</span>
                </div>
              </div>
            </div>

            {/* --- FILA 2: NOMBRE (Ocupa las 2 columnas) --- */}
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

            {/* --- FILA 3: CATEGORÍA y MARCA --- */}
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

            {/* --- FILA 4: PRECIOS --- */}
            <div className="space-y-2">
              <Label htmlFor="priceBuy">Precio Compra ($) *</Label>
              <Input
                id="priceBuy"
                type="text" // Usamos text para mejor control manual de decimales
                value={priceBuyInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setPriceBuyInput(v);
                }}
                onBlur={() => {
                  // Lógica de guardado en número al salir del campo
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

            {/* --- FILA 5: STOCK y UNIDAD --- */}
            {/* Aquí agrupamos Stock y Unidad en la izquierda, y Min Stock a la derecha */}
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

            {/* --- FILA 6: NOTAS (Full width) --- */}
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

            {/* Mensaje de error si existe */}
            {error && <div className="md:col-span-2 text-red-600 text-sm font-medium">{error}</div>}

            {/* Espacio extra al final (por si acaso) */}
            <div className="pb-4 md:hidden"></div>
          </form>
        </CardContent>

        {/* FOOTER FIJO */}
        <div className="p-4 border-t rounded-b-xl flex justify-between items-center shrink-0">
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

      {/* --- MODALES DE AYUDA (Se mantienen igual, resumidos aquí) --- */}
      <Dialog open={showUomHelp} onOpenChange={setShowUomHelp}>
        <DialogContent>
          <DialogHeader><DialogTitle>Unidades de Medida</DialogTitle></DialogHeader>
          <div className="text-sm space-y-2">
            <p><strong>Unidad (u):</strong> Productos cerrados (latas, paquetes).</p>
            <p><strong>Kilos/Litros:</strong> Productos a granel o balanza.</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCodeHelp} onOpenChange={setShowCodeHelp}>
        <DialogContent>
          <DialogHeader><DialogTitle>Código de Producto</DialogTitle></DialogHeader>
          <p className="text-sm">Usa el código de barras del producto o genera uno interno con el botón "Generar".</p>
        </DialogContent>
      </Dialog>

    </div>
  )
}