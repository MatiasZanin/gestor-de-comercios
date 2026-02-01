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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { HelpCircle } from "lucide-react"
import { apiClient } from "@/lib/api/client"
import type { Product, CreateProductRequest, UpdateProductRequest } from "@/lib/types/api"
import CreatableSelect from "react-select/creatable"
import ReactSelect from "react-select"

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
  products?: Product[] // Para derivar las opciones de marca
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
    isActive: product?.isActive ?? true,
    category: product?.category || "",
    brand: product?.brand || "",
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
  const [showUomHelp, setShowUomHelp] = useState(false)
  const [showCodeHelp, setShowCodeHelp] = useState(false)
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)

  // Cargar categorías al montar el componente
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

  // Derivar opciones de marca desde los productos existentes
  const brandOptions: BrandOption[] = useMemo(() => {
    const uniqueBrands = [...new Set(products.map(p => p.brand).filter(Boolean))] as string[]
    return uniqueBrands.map(brand => ({ value: brand, label: brand }))
  }, [products])


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
          category: formData.category || undefined,
          brand: formData.brand || undefined,
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
          category: formData.category || undefined,
          brand: formData.brand || undefined,
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
                <div className="flex items-center gap-1 mb-2">
                  <Label htmlFor="code">
                    Código (SKU, EAN, etc.) *
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowCodeHelp(true)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Ayuda sobre código de producto"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    placeholder="Ej: MART-01"
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerateCode}
                    className="whitespace-nowrap"
                  >
                    Generar
                  </Button>
                </div>
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

            <div className="mt-2">
              <Label className="mb-2" htmlFor="category">
                Categoría
              </Label>
              <CreatableSelect
                id="category"
                isClearable
                isLoading={loadingCategories}
                options={categoryOptions}
                value={formData.category ? { value: formData.category, label: formData.category } : null}
                onChange={(option) => {
                  setFormData({ ...formData, category: option?.value || "" })
                }}
                onCreateOption={(inputValue) => {
                  const newOption = { value: inputValue, label: inputValue }
                  setCategoryOptions((prev) => [...prev, newOption])
                  setFormData({ ...formData, category: inputValue })
                }}
                placeholder="Seleccionar o crear..."
                formatCreateLabel={(inputValue) => `Crear "${inputValue}"`}
                noOptionsMessage={() => "Escribí para crear una categoría"}
                classNames={{
                  control: () => "!border-input !bg-background !shadow-sm !rounded-md !min-h-10",
                  menu: () => "!bg-background !border !border-input !rounded-md !shadow-md",
                  option: () => "!bg-background hover:!bg-accent !cursor-pointer !text-foreground",
                  singleValue: () => "!text-foreground",
                  input: () => "!text-foreground",
                  placeholder: () => "!text-muted-foreground",
                }}
                styles={{
                  control: (base) => ({ ...base, borderColor: "hsl(var(--input))" }),
                  menu: (base) => ({ ...base, zIndex: 50 }),
                }}
              />
            </div>

            <div className="mt-2">
              <Label className="mb-2" htmlFor="brand">
                Marca
              </Label>
              <CreatableSelect
                id="brand"
                isClearable
                options={brandOptions}
                value={formData.brand ? { value: formData.brand, label: formData.brand } : null}
                onChange={(option) => {
                  setFormData({ ...formData, brand: option?.value || "" })
                }}
                onCreateOption={(inputValue) => {
                  setFormData({ ...formData, brand: inputValue })
                }}
                placeholder="Seleccionar o crear..."
                formatCreateLabel={(inputValue) => `⚠️ Nueva marca: "${inputValue}"`}
                noOptionsMessage={() => "Escribí para crear una marca"}
                classNames={{
                  control: () => "!border-input !bg-background !shadow-sm !rounded-md !min-h-10",
                  menu: () => "!bg-background !border !border-input !rounded-md !shadow-md",
                  option: () => "!bg-background hover:!bg-accent !cursor-pointer !text-foreground",
                  singleValue: () => "!text-foreground",
                  input: () => "!text-foreground",
                  placeholder: () => "!text-muted-foreground",
                }}
                styles={{
                  control: (base) => ({ ...base, borderColor: "hsl(var(--input))" }),
                  menu: (base) => ({ ...base, zIndex: 50 }),
                }}
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
                <div className="flex items-center gap-1 mb-2">
                  <Label htmlFor="uom">
                    Unidad de Medida *
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowUomHelp(true)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label="Ayuda sobre unidad de medida"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                </div>
                <ReactSelect
                  id="uom"
                  options={UOM_OPTIONS}
                  value={UOM_OPTIONS.find(opt => opt.value === formData.uom) || null}
                  onChange={(option) => {
                    setFormData({ ...formData, uom: option?.value || "" })
                  }}
                  placeholder="Seleccionar..."
                  noOptionsMessage={() => "Sin opciones"}
                  classNames={{
                    control: () => "!border-input !bg-background !shadow-sm !rounded-md !min-h-10",
                    menu: () => "!bg-background !border !border-input !rounded-md !shadow-md",
                    option: () => "!bg-background hover:!bg-accent !cursor-pointer !text-foreground",
                    singleValue: () => "!text-foreground",
                    input: () => "!text-foreground",
                    placeholder: () => "!text-muted-foreground",
                  }}
                  styles={{
                    control: (base) => ({ ...base, borderColor: "hsl(var(--input))" }),
                    menu: (base) => ({ ...base, zIndex: 50 }),
                  }}
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

      {/* Modal de ayuda para Unidad de Medida */}
      <Dialog open={showUomHelp} onOpenChange={setShowUomHelp}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">¿Cómo elegir la Unidad de Medida?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-gray-600">
              Preguntate: <strong>¿Cómo lo cobro?</strong> No importa lo que diga la etiqueta, sino cómo lo entregás al cliente.
            </p>

            {/* Unidad */}
            <div className="flex gap-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <span className="text-xl">🥤</span>
              <div>
                <p className="font-semibold text-blue-800">Unidad (u)</p>
                <p className="text-blue-900/80 text-xs mt-1">
                  Productos <strong>envasados o cerrados</strong>. Ej: Una Coca de 2L = 1 unidad.
                </p>
              </div>
            </div>

            {/* Peso */}
            <div className="flex gap-3 p-3 bg-orange-50 rounded-lg border-l-4 border-orange-500">
              <span className="text-xl">⚖️</span>
              <div>
                <p className="font-semibold text-orange-800">Kilogramo (kg)</p>
                <p className="text-orange-900/80 text-xs mt-1">
                  Cuando usás la <strong>balanza</strong>. Ej: Fruta, carne, pan al peso.
                </p>
              </div>
            </div>

            {/* Volumen */}
            <div className="flex gap-3 p-3 bg-purple-50 rounded-lg border-l-4 border-purple-500">
              <span className="text-xl">🍺</span>
              <div>
                <p className="font-semibold text-purple-800">Litro (lt)</p>
                <p className="text-purple-900/80 text-xs mt-1">
                  Líquidos <strong>sueltos o tirados</strong>. Ej: Cerveza de barril, limpieza a granel.
                </p>
              </div>
            </div>

            {/* Tabla resumen */}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-700 mb-2 text-xs">Resumen rápido:</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Viene cerrado (lata, caja, botella)</span>
                  <span className="font-semibold text-blue-600">→ Unidad</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Se pone en la balanza</span>
                  <span className="font-semibold text-orange-600">→ Kilogramo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Se sirve desde bidón/grifo</span>
                  <span className="font-semibold text-purple-600">→ Litro</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de ayuda para Código de Producto */}
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