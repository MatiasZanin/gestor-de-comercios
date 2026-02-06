import { test, expect } from '@playwright/test';

// Mapeo de métodos de pago a las etiquetas que se ven en la UI (React Select)
// Ajusta estos valores si tus etiquetas en PAYMENT_METHOD_LABELS son diferentes
const PAYMENT_LABELS: Record<string, string> = {
    CASH: "Efectivo",
    TRANSFER: "Transferencia",
    CARD: "Tarjeta", // o "Tarjeta de Crédito/Débito"
    OTHER: "Otros",  // o "Otros Medios"
};

const salesData: any = [
    {
        "paymentMethod": "CASH",
        "notes": "Cliente regular, cambio justo.",
        "items": [
            { "code": "7790010000122", "qty": 2 },
            { "code": "7790150021226", "qty": 1 }
        ]
    },
    {
        "paymentMethod": "TRANSFER",
        "notes": "Comprobante #1234 enviado por WhatsApp.",
        "items": [
            { "code": "7790070411715", "qty": 6 },
            { "code": "7790030000121", "qty": 3 }
        ]
    },
    {
        "paymentMethod": "CARD",
        "notes": "Tarjeta de débito",
        "items": [
            { "code": "7622300150221", "qty": 2 },
            { "code": "7790060023560", "qty": 4 }
        ]
    },
    {
        "paymentMethod": "CARD",
        "notes": "Tarjeta de crédito, un pago",
        "items": [
            { "code": "7790387013621", "qty": 2 },
            { "code": "7792790000155", "qty": 6 },
            { "code": "7790040111201", "qty": 2 }
        ]
    },
    {
        "paymentMethod": "OTHER",
        "notes": "Mercado Pago QR",
        "items": [
            { "code": "7790060023560", "qty": 1 },
            { "code": "7792790000155", "qty": 1 }
        ]
    },
    {
        "paymentMethod": "CASH",
        "items": [
            { "code": "7790101001114", "qty": 3 }
        ]
    },
    {
        "paymentMethod": "OTHER",
        "notes": "Billetera Santa Fe",
        "items": [
            { "code": "7790387013621", "qty": 1 },
            { "code": "7790010000122", "qty": 3 }
        ]
    },
    {
        "paymentMethod": "CARD",
        "items": [
            { "code": "7790030000121", "qty": 2 },
            { "code": "7790070411715", "qty": 1 },
            { "code": "7790101001114", "qty": 1 }
        ]
    },
    {
        "paymentMethod": "TRANSFER",
        "notes": "Transferencia inmediata desde cuenta DNI",
        "items": [
            { "code": "7792790000155", "qty": 10 },
            { "code": "7790060023560", "qty": 12 }
        ]
    },
    {
        "paymentMethod": "CASH",
        "notes": "Prueba de ítem genérico (Otros)",
        "items": [
            { "code": "7790387013621", "qty": 1 },
            // El item especial "Otros" con código -1 y precio manual
            { "code": "-1", "qty": 1, "priceSale": 500 }
        ]
    }
];

test.describe('Sales Module', () => {
    test('should create 10 sales sequentially', async ({ page }) => {
        // Dado que son 10 ventas completas, aumentamos el timeout
        test.setTimeout(120000);

        // 1. Navegar a la página de ventas
        await page.goto('/dashboard/ventas');
        await expect(page.getByText('Lista de Ventas')).toBeVisible({ timeout: 10000 });

        // 2. Abrir formulario de Nueva Venta
        await page.getByRole('button', { name: 'Nueva Venta' }).click();
        await expect(page.locator('div.fixed').getByText('Nueva Venta')).toBeVisible({ timeout: 1000 });

        for (const [index, sale] of salesData.entries()) {
            console.log(`Processing Sale #${index + 1}...`);

            // 3. Agregar items al carrito
            for (const item of sale.items) {
                // Paso A: Buscar el producto
                // Usamos fill en lugar de type para ser más rápidos y fiables
                const searchInput = page.getByPlaceholder('Buscar productos...');
                await searchInput.fill(item.code);

                // Esperamos un momento a que el filtrado ocurra
                // Buscamos el contenedor del producto específico para evitar ambigüedades
                // (Especialmente útil si el código '123' también aparece en '1234')
                const productRow = page.locator('.border-b').filter({ hasText: item.code }).first();

                // Caso especial: Ítem "Otros" (-1)
                if (item.code === "-1") {
                    // El botón "+" en el ítem -1 abre el modal
                    await productRow.getByRole('button').click();

                    // Manejar modal de precio "Otros"
                    const priceModal = page.locator('text=Precio para "Otros"');
                    await expect(priceModal).toBeVisible();

                    if (item.priceSale) {
                        await page.locator('#otherPrice').fill(item.priceSale.toString());
                    }
                    await page.getByRole('button', { name: 'Agregar' }).click();
                    await expect(priceModal).not.toBeVisible();

                } else {
                    // Producto normal
                    // Hacemos click en el botón "+"
                    await expect(productRow).toBeVisible();
                    await productRow.getByRole('button').click();

                    // Paso B: Ajustar Cantidad si es mayor a 1
                    if (item.qty > 1) {
                        // Buscamos el item en el carrito (lado derecho)
                        // El componente SaleCart usa inputs para la cantidad
                        const cartRow = page.locator('div.bg-white.rounded-lg.shadow-sm').filter({ hasText: item.code });
                        await expect(cartRow).toBeVisible();

                        const qtyInput = cartRow.locator('input[inputmode="decimal"]');
                        await qtyInput.fill(item.qty.toString());
                        // Disparamos el evento blur para asegurar que se actualice el estado
                        await qtyInput.blur();
                    }
                }

                // Limpiar búsqueda para el siguiente item (si hay más)
                await searchInput.fill('');
            }

            // 4. Ir al Checkout
            await page.getByRole('button', { name: 'Continuar al Cobro' }).click();

            // Verificar que el modal de cobro se abrió
            const checkoutModal = page.locator('text=Finalizar Venta');
            await expect(checkoutModal).toBeVisible();

            // 5. Seleccionar Método de Pago (React Select)
            // React Select es un poco truculento en tests. La estrategia más segura es:
            // Click en el contenedor -> Escribir o esperar opciones -> Click en la opción.
            const paymentSelect = page.locator('#paymentMethod').locator('..'); // Contenedor padre
            await paymentSelect.click();

            // Buscamos la opción por texto en el menú desplegable
            const labelToSelect = PAYMENT_LABELS[sale.paymentMethod] || "Efectivo";

            // CORRECCIÓN: Usamos getByRole('option') en lugar de getByText.
            // Esto filtra el texto que está en el input (que no es una option) y selecciona solo el del menú.
            await page.getByRole('option', { name: labelToSelect, exact: true }).click();

            // 6. Agregar Notas (si existen)
            if (sale.notes) {
                await page.locator('#notes').fill(sale.notes);
            }

            // 7. Confirmar Venta
            // Usamos una promesa race para manejar posibles tiempos de carga
            await page.getByRole('button', { name: 'Confirmar Venta' }).click();

            // 8. Manejar Modal de Éxito
            const successModal = page.locator('text=¡Venta creada!');
            await expect(successModal).toBeVisible({ timeout: 10000 });

            // Cerrar el modal explícitamente para ir más rápido, o esperar a que se cierre
            await page.getByRole('button', { name: 'Cerrar ahora' }).click();

            // Verificar que volvimos a la lista (modal cerrado)
            await expect(successModal).not.toBeVisible();

            console.log(`✓ Sale #${index + 1} created.`);
        }

        console.log(`\n✓ Successfully created ${salesData.length} sales.`);

        // ============================================================
        // FASE DE VERIFICACIÓN: Cerrar modal y verificar todas las ventas
        // ============================================================

        console.log('\n--- Starting verification phase ---');

        // 9. Cerrar el modal de Nueva Venta
        await page.getByRole('button', { name: 'Cancelar' }).click();

        // Esperar a que el modal de Nueva Venta se cierre
        await expect(page.locator('div.fixed').getByText('Nueva Venta')).not.toBeVisible({ timeout: 2000 });

        // 10. Filtrar por la fecha de hoy para ver las ventas nuevas
        const today = new Date().toISOString().split('T')[0];
        const dateInput = page.locator('input[type="date"]');
        await dateInput.fill(today);
        await page.getByRole('button', { name: 'Filtrar' }).click();

        // Esperar a que se carguen las ventas
        await page.waitForTimeout(1500);

        // 11. Obtener todas las ventas visibles en la lista
        // Usamos .first() para evitar errores de strict mode
        const saleCards = page.locator('.p-3.sm\\:p-4.border.rounded-lg');

        // Verificar que hay al menos 10 ventas (las que acabamos de crear)
        const saleCount = await saleCards.count();
        console.log(`Found ${saleCount} sales in the list.`);
        expect(saleCount).toBeGreaterThanOrEqual(salesData.length);

        // 12. Verificar cada venta creada (en orden inverso porque las más nuevas están primero)
        for (let i = 0; i < salesData.length; i++) {
            // Las ventas se muestran en orden inverso (más reciente primero)
            const saleIndex = salesData.length - 1 - i;
            const sale = salesData[saleIndex];
            const saleCard = saleCards.nth(i);

            console.log(`Verifying Sale #${saleIndex + 1}...`);

            // Verificar que la venta es visible
            await expect(saleCard).toBeVisible({ timeout: 3000 });

            // 13. Verificar el método de pago
            const expectedPaymentLabel = PAYMENT_LABELS[sale.paymentMethod];
            const paymentBadge = saleCard.getByText(expectedPaymentLabel).first();
            await expect(paymentBadge).toBeVisible();

            // 14. Verificar cada item de la venta
            for (const item of sale.items) {
                const codeToCheck = item.code;

                // Buscar el código del producto en la tabla de la venta
                // Usamos .first() para evitar errores de strict mode
                const itemCell = saleCard.locator('td').filter({ hasText: codeToCheck }).first();
                await expect(itemCell).toBeVisible({ timeout: 3000 });

                // Verificar la cantidad - buscamos el patrón "qty uom" en la misma venta
                const qtyPattern = new RegExp(`${item.qty}\\s+\\w+`);
                const qtyCell = saleCard.locator('td').filter({ hasText: qtyPattern }).first();
                await expect(qtyCell).toBeVisible();
            }

            // 15. Verificar que existe un total con formato de moneda
            const totalRow = saleCard.locator('tr').filter({ hasText: 'Total:' });
            const totalElement = totalRow.getByText(/\$\s*[\d.,]+/);

            await expect(totalElement).toBeVisible();

            // 16. Verificar notas si existen
            if (sale.notes) {
                const notesElement = saleCard.getByText(sale.notes).first();
                await expect(notesElement).toBeVisible();
            }

            console.log(`✓ Sale #${saleIndex + 1} verified.`);
        }

        console.log(`\n✓ Successfully created and verified ${salesData.length} sales.`);
    });
});