"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSaleForm } from "@/lib/hooks/use-sale-form" // Asegurate que la ruta sea correcta
import { OtherPriceModal } from "./other-price-modal"
import { ProductList } from "./product-list"
import { SaleCart } from "./sale-cart"
import { SuccessModal } from "./success-modal"
import { formatCurrency } from "@/lib/utils/sales-utils"
import { CheckoutModal } from "./checkout-modal"

interface SaleFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function SaleForm({ onSuccess, onCancel }: SaleFormProps) {
  const { state, actions } = useSaleForm({ onSuccess })

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      {/* CAMBIO: h-[95vh] y flex-col para forzar la altura completa */}
      <Card className="w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden">

        <CardHeader className="flex flex-row items-center justify-between py-4 border-b shrink-0">
          <CardTitle>Nueva Venta</CardTitle>
          <div className="text-2xl font-bold text-orange-600">
            Total: {formatCurrency(actions.calculateTotal())}
          </div>
        </CardHeader>

        {/* CAMBIO: flex-1 y min-h-0 permite que el contenido interno haga scroll sin romper el layout */}
        <CardContent className="flex-1 flex flex-col min-h-0 p-6 gap-4">

          {/* Grid principal que ocupa todo el espacio disponible */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
            <div className="h-full overflow-hidden">
              <ProductList
                searchTerm={state.searchTerm}
                onSearchChange={actions.setSearchTerm}
                onKeyDown={actions.handleSearchKeyDown}
                loading={state.loadingProducts}
                products={actions.filteredProducts()}
                onAdd={actions.addItem}
                onOpenOther={() => actions.setShowOtherModal(true)}
              />
            </div>

            <div className="h-full overflow-hidden">
              <SaleCart
                items={state.selectedItems}
                qtyInputs={state.qtyInputs}
                onUpdateQty={actions.updateItemQty}
                onUpdateQtyInput={actions.updateQtyInput}
                onRemove={actions.removeItem}
                total={actions.calculateTotal()}
              />
            </div>
          </div>

          {/* Aviso de Stock (flotante o fijo, aquí lo ponemos fijo abajo para no molestar layout) */}
          {state.stockWarning && (
            <div className="bg-amber-100 border border-amber-200 rounded p-2 text-amber-800 text-center text-sm font-medium animate-in fade-in shrink-0">
              ⚠️ {state.stockWarning}
            </div>
          )}

          {/* Footer de botones, fijo al fondo */}
          <div className="flex justify-end space-x-2 pt-2 border-t shrink-0">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={state.selectedItems.length === 0}
              className="bg-orange-600 hover:bg-orange-700 px-8"
              onClick={() => actions.setShowCheckoutModal(true)}
            >
              Continuar al Cobro
            </Button>
          </div>

        </CardContent>

        {/* Modales fuera del flujo principal */}
        {state.showCheckoutModal && (
          <CheckoutModal
            total={actions.calculateTotal()}
            paymentMethod={state.paymentMethod}
            notes={state.notes}
            loading={state.loading}
            onPaymentMethodChange={actions.setPaymentMethod}
            onNotesChange={actions.setNotes}
            onConfirm={actions.handleSubmit}
            onClose={() => actions.setShowCheckoutModal(false)}
          />
        )}
        {state.showOtherModal && (
          <OtherPriceModal
            onClose={() => actions.setShowOtherModal(false)}
            onConfirm={(price) => {
              actions.addOtherItem(price)
              actions.setShowOtherModal(false)
            }}
          />
        )}
        {state.loading && (
          <div className="fixed inset-0 bg-white/50 flex items-center justify-center z-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
          </div>
        )}
        {state.showSuccess && (
          <SuccessModal onClose={() => { actions.setShowSuccess(false); onSuccess() }} />
        )}
      </Card>
    </div>
  )
}