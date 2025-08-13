"use client"

import { useState, useEffect } from "react"
import { Plus, Search, Edit, Trash2, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/hooks/use-auth"
import { apiClient } from "@/lib/api/client"
import type { Product, ProductListResponse } from "@/lib/types/api"
import { ProductForm } from "@/components/products/product-form"
import { DeleteProductDialog } from "@/components/products/delete-product-dialog"

export default function ProductsPage() {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showActiveOnly, setShowActiveOnly] = useState(true)
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

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.code.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-orange-500 bg-clip-text text-transparent">
            Productos
          </h1>
          <p className="text-gray-600">Gestiona el inventario de productos de tu comercio</p>
        </div>
        {isAdmin && (
          <Button
            onClick={handleCreateProduct}
            className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Producto
          </Button>
        )}
      </div>

      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-orange-50 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-gray-800">
              <Package className="w-5 h-5 text-emerald-600" />
              Lista de Productos
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar productos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64 border-gray-200 focus:border-emerald-500"
                />
              </div>
              <Button
                variant={showActiveOnly ? "default" : "outline"}
                onClick={() => setShowActiveOnly(!showActiveOnly)}
                size="sm"
                className={showActiveOnly ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              >
                {showActiveOnly ? "Solo Activos" : "Todos"}
              </Button>
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
              <p className="text-gray-500 text-lg">No se encontraron productos</p>
              <p className="text-gray-400">
                {searchTerm ? "Intenta con otros términos de búsqueda" : "Comienza creando tu primer producto"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProducts.map((product) => (
                <div
                  key={product.code}
                  className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gradient-to-r hover:from-emerald-50 hover:to-orange-50 transition-all duration-200 hover:shadow-md"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900 text-lg">{product.name}</h3>
                      <Badge
                        variant={product.isActive ? "default" : "secondary"}
                        className={product.isActive ? "bg-emerald-100 text-emerald-800" : ""}
                      >
                        {product.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                      {product.stock <= 5 && product.isActive && (
                        <Badge variant="destructive" className="bg-orange-100 text-orange-800">
                          Stock Bajo
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Código:</span>
                        <span className="ml-1 font-medium">{product.code}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Stock:</span>
                        <span
                          className={`ml-1 font-medium ${product.stock <= 5 ? "text-orange-600" : "text-gray-900"}`}
                        >
                          {product.stock} {product.uom}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Precio:</span>
                        <span className="ml-1 font-medium text-emerald-600">${product.priceSale}</span>
                      </div>
                      {isAdmin && product.priceBuy && (
                        <div>
                          <span className="text-gray-500">Costo:</span>
                          <span className="ml-1 font-medium">${product.priceBuy}</span>
                        </div>
                      )}
                    </div>
                    {product.notes && <p className="text-sm text-gray-600 mt-2 italic">{product.notes}</p>}
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2 ml-4">
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

              {lastKey && (
                <div className="text-center pt-6">
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
        <ProductForm product={editingProduct} onSuccess={handleFormSuccess} onCancel={() => setShowForm(false)} />
      )}

      {deletingProduct && (
        <DeleteProductDialog
          product={deletingProduct}
          onSuccess={handleDeleteSuccess}
          onCancel={() => setDeletingProduct(null)}
        />
      )}
    </div>
  )
}
