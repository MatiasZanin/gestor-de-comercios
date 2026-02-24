"use client"

import { useState, useEffect, useMemo } from "react"
// --- Imports Modificados ---
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  ArrowDownUp,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
// -------------------------

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// --- Nuevos Imports ---
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
// --------------------

import { useAuth } from "@/lib/hooks/use-auth"
import { apiClient } from "@/lib/api/client"
import type { Product, ProductListResponse } from "@/lib/types/api"
import { ProductForm } from "@/components/products/product-form"
import { DeleteProductDialog } from "@/components/products/delete-product-dialog"
import { DashboardLayout } from "../../../components/dashboard/dashboard-layout"

// --- Nuevo Tipo ---
// Tipo para las claves de ordenamiento
type SortKey = "name_asc" | "name_desc" | "stock_asc" | "stock_desc"

const ITEMS_PER_PAGE = 10

export default function ProductsPage() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showActiveOnly, setShowActiveOnly] = useState(true)

  // --- Nuevo Estado ---
  const [sortOrder, setSortOrder] = useState<SortKey>("name_asc")
  const [currentPage, setCurrentPage] = useState(1)

  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [lastKey, setLastKey] = useState<string | undefined>()

  const isAdmin = user?.["cognito:groups"]?.includes("admin")

  const loadProducts = async (reset = false) => {
    try {
      setLoading(true)
      const response: ProductListResponse = await apiClient.listProducts({
        isActive: showActiveOnly,
        lastKey: reset ? undefined : lastKey,
      })

      if (reset) {
        setProducts(response.items)
      } else {
        setProducts((prev) => [...prev, ...response.items])
      }

      setLastKey(response.lastKey)
    } catch (error) {
      console.error("Error loading products:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts(true)
  }, [showActiveOnly])

  const handleCreateProduct = () => {
    setEditingProduct(null)
    setShowForm(true)
  }

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product)
    setShowForm(true)
  }

  const handleDeleteProduct = (product: Product) => {
    setDeletingProduct(product)
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    setEditingProduct(null)
    loadProducts(true)
  }

  const handleDeleteSuccess = () => {
    setDeletingProduct(null)
    loadProducts(true)
  }

  const filteredProducts = useMemo(() =>
    products
      .filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.code.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        switch (sortOrder) {
          case "name_asc":
            return a.name.localeCompare(b.name)
          case "name_desc":
            return b.name.localeCompare(a.name)
          case "stock_asc":
            return a.stock - b.stock
          case "stock_desc":
            return b.stock - a.stock
          default:
            return 0
        }
      }),
    [products, searchTerm, sortOrder]
  )

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, sortOrder, showActiveOnly])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold ">Productos</h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Gestiona el inventario de productos de tu comercio
            </p>
          </div>
          {isAdmin && (
            <Button
              onClick={handleCreateProduct}
              className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Producto
            </Button>
          )}
        </div>
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm pt-0">
          <CardHeader className="border-b pt-6">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-gray-800">
                <Package className="w-5 h-5 text-emerald-600" />
                Lista de Productos
              </CardTitle>
            </div>
            <div className="flex flex-col sm:flex-row mt-4 items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full sm:w-64 border-gray-200 focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-3">
                  {/* --- DESPLEGABLE DE ORDEN --- */}
                  <Select
                    onValueChange={(value) => setSortOrder(value as SortKey)}
                    defaultValue={sortOrder}
                  >
                    <SelectTrigger className="w-full sm:w-[200px] border-gray-200 focus:border-emerald-500">
                      <SelectValue placeholder="Ordenar por..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Nombre</SelectLabel>
                        <SelectItem value="name_asc">
                          <div className="flex items-center gap-2">
                            <ArrowUp className="w-3 h-3" />
                            Alfabético (A-Z)
                          </div>
                        </SelectItem>
                        <SelectItem value="name_desc">
                          <div className="flex items-center gap-2">
                            <ArrowDown className="w-3 h-3" />
                            Alfabético (Z-A)
                          </div>
                        </SelectItem>
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Stock</SelectLabel>
                        <SelectItem value="stock_asc">
                          <div className="flex items-center gap-2">
                            <ArrowUp className="w-3 h-3" />
                            Menor a Mayor
                          </div>
                        </SelectItem>
                        <SelectItem value="stock_desc">
                          <div className="flex items-center gap-2">
                            <ArrowDown className="w-3 h-3" />
                            Mayor a Menor
                          </div>
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {/* ---------------------------------- */}

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-gray-700">
                      {showActiveOnly ? "Activos" : "Inactivos"}
                    </span>
                    <Switch
                      checked={showActiveOnly}
                      onCheckedChange={setShowActiveOnly}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {loading && products.length === 0 ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
                <p className="text-gray-500 mt-4">Cargando productos...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">
                  No se encontraron productos
                </p>
                <p className="text-gray-400">
                  {searchTerm
                    ? "Intenta con otros términos de búsqueda"
                    : "Comienza creando tu primer producto"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedProducts.map((product) => (
                  <div
                    key={product.code}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all duration-200 gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900 text-base sm:text-lg truncate">
                          {product.name}
                        </h3>
                        <Badge
                          variant={product.isActive ? "default" : "secondary"}
                          className={
                            product.isActive
                              ? "bg-emerald-100 text-emerald-800"
                              : ""
                          }
                        >
                          {product.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                        {product.isActive && product.alertStatus && (
                          <Badge
                            variant="destructive"
                            className="bg-orange-100 text-orange-800"
                          >
                            Stock Bajo
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-2 md:grid-cols-6 gap-x-3 gap-y-2 sm:gap-4 text-sm">
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs sm:text-sm">Código</span>
                          <span className="font-medium text-xs sm:text-sm truncate">
                            {product.code}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs sm:text-sm">Categoría</span>
                          <span className="font-medium text-xs sm:text-sm truncate">
                            {product.category || "-"}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs sm:text-sm">Marca</span>
                          <span className="font-medium text-xs sm:text-sm truncate">
                            {product.brand || "-"}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs sm:text-sm">Stock</span>
                          <span
                            className={`font-medium text-xs sm:text-sm ${product.alertStatus === 'LOW'
                              ? "text-red-600"
                              : product.stock <= 5
                                ? "text-orange-600"
                                : "text-gray-900"
                              }`}
                          >
                            {product.stock} {product.uom}
                            {product.minStock && product.minStock > 0 && (
                              <span className="text-gray-400 text-xs ml-1 hidden sm:inline">
                                (mín: {product.minStock})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs sm:text-sm">Precio</span>
                          <span className="font-medium text-emerald-600 text-xs sm:text-sm">
                            ${product.priceSale}
                          </span>
                        </div>
                        {isAdmin && product.priceBuy && (
                          <div className="flex flex-col">
                            <span className="text-gray-500 text-xs sm:text-sm">Costo</span>
                            <span className="font-medium text-xs sm:text-sm">
                              ${product.priceBuy}
                            </span>
                          </div>
                        )}
                      </div>
                      {product.notes && (
                        <p className="text-xs sm:text-sm text-gray-600 mt-2 italic">
                          {product.notes}
                        </p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2 sm:ml-4 self-end sm:self-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditProduct(product)}
                          className="hover:bg-emerald-50 hover:border-emerald-300"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteProduct(product)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-gray-100 gap-3">
                    <span className="text-xs sm:text-sm text-gray-500">
                      Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} de {filteredProducts.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="hover:bg-emerald-50 hover:border-emerald-300"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((page) => {
                          if (page === 1 || page === totalPages) return true
                          if (Math.abs(page - currentPage) <= 1) return true
                          return false
                        })
                        .reduce<(number | string)[]>((acc, page, idx, arr) => {
                          if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                            acc.push("...")
                          }
                          acc.push(page)
                          return acc
                        }, [])
                        .map((item, idx) =>
                          typeof item === "string" ? (
                            <span key={`ellipsis-${idx}`} className="px-1.5 sm:px-2 text-gray-400 text-sm">
                              {item}
                            </span>
                          ) : (
                            <Button
                              key={item}
                              variant={item === currentPage ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(item)}
                              className={item === currentPage
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "hover:bg-emerald-50 hover:border-emerald-300"
                              }
                            >
                              {item}
                            </Button>
                          )
                        )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        className="hover:bg-emerald-50 hover:border-emerald-300"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {lastKey && (
                  <div className="text-center pt-4">
                    <Button
                      variant="outline"
                      onClick={() => loadProducts(false)}
                      disabled={loading}
                      className="hover:bg-emerald-50 hover:border-emerald-300"
                    >
                      {loading ? "Cargando..." : "Cargar más productos"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        {showForm && (
          <ProductForm
            product={editingProduct}
            products={products}
            onSuccess={handleFormSuccess}
            onCancel={() => setShowForm(false)}
          />
        )}
        {deletingProduct && (
          <DeleteProductDialog
            product={deletingProduct}
            onSuccess={handleDeleteSuccess}
            onCancel={() => setDeletingProduct(null)}
          />
        )}
      </div>
    </DashboardLayout >
  )
}