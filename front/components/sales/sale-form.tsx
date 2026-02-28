"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSaleForm } from "@/lib/hooks/use-sale-form" // Asegurate que la ruta sea correcta
import { OtherPriceModal } from "./other-price-modal"
import { ProductList } from "./product-list"
import { SaleCart } from "./sale-cart"
import { SuccessModal } from "./success-modal"
import type { Sale } from "@/lib/types/api"
import { formatCurrency } from "@/lib/utils/sales-utils"
import { CheckoutModal } from "./checkout-modal"

interface SaleFormProps {
  onSuccess: (sale: Sale) => void
  onCancel: () => void
  initialItems?: import("@/lib/types/api").SaleItem[]
}

export function SaleForm({ onSuccess, onCancel, initialItems }: SaleFormProps) {
  const { state, actions } = useSaleForm({ onSuccess, initialItems })

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center sm:p-4 z-50">
      {/* Full-screen on mobile, constrained modal on desktop */}
      <Card className="w-full sm:max-w-7xl h-full sm:h-[95vh] flex flex-col overflow-hidden gap-0 rounded-none sm:rounded-xl">

        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-3 sm:py-4 border-b shrink-0 gap-1">
          <CardTitle className="text-base sm:text-lg">{initialItems ? "Devolución por Ticket" : "Nueva Venta"}</CardTitle>
          <div className="text-xl sm:text-2xl font-bold text-orange-600">
            Total: {formatCurrency(actions.calculateTotal())}
          </div>
        </CardHeader>

        {/* CAMBIO: flex-1 y min-h-0 permite que el contenido interno haga scroll sin romper el layout */}
        <CardContent className="flex-1 flex flex-col min-h-0 p-3 sm:p-6 gap-3 sm:gap-4">

          {/* Grid principal que ocupa todo el espacio disponible */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 flex-1 min-h-0">
            <div className="min-h-[200px] lg:h-full overflow-hidden">
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

            <div className="min-h-[200px] lg:h-full overflow-hidden">
              <SaleCart
                items={state.itemsWithOffers}
                qtyInputs={state.qtyInputs}
                onUpdateQty={actions.updateItemQty}
                onUpdateQtyInput={actions.updateQtyInput}
                onRemove={actions.removeItem}
                onToggleReturn={actions.toggleReturnMode}
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
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:space-x-2 pt-2 border-t shrink-0" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
            <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={state.selectedItems.length === 0}
              className="bg-orange-600 hover:bg-orange-700 px-8 w-full sm:w-auto"
              onClick={() => actions.setShowCheckoutModal(true)}
            >
              {actions.calculateTotal() > 0
                ? "Cobrar"
                : actions.calculateTotal() === 0
                  ? "Confirmar Cambio"
                  : "Emitir Reembolso"}
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
          <SuccessModal onClose={() => actions.setShowSuccess(false)} />
        )}
      </Card>
    </div>
  )
}