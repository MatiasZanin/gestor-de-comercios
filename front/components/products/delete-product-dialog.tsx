"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { apiClient } from "@/lib/api/client"
import type { Product } from "@/lib/types/api"

interface DeleteProductDialogProps {
  product: Product
  onSuccess: () => void
  onCancel: () => void
}

export function DeleteProductDialog({ product, onSuccess, onCancel }: DeleteProductDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleDelete = async () => {
    setLoading(true)
    setError("")

    try {
      await apiClient.deleteProduct(product.code)
      onSuccess()
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error al eliminar producto")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-red-600">Confirmar Eliminación</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            ¿Estás seguro de que deseas eliminar el producto <strong>{product.name}</strong>?
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Esta acción marcará el producto como inactivo y no se podrá deshacer.
          </p>

          {error && <div className="text-red-600 text-sm mb-4 p-2 bg-red-50 rounded">{error}</div>}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onCancel} disabled={loading}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "Eliminando..." : "Eliminar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
