import { test, expect } from '@playwright/test';

// Test data - 10 products to create
const testProducts = [
    {
        code: "7790387013621",
        name: "Yerba Mate Playadito 500g",
        priceBuy: "2100",
        priceSale: "3200",
        uom: "Unidad (u)",
        stock: "40",
        minStock: "10",
        category: "Almacén",
        brand: "Playadito"
    },
    {
        code: "7790070411715",
        name: "Cerveza Quilmes Clásica 1L",
        priceBuy: "1800",
        priceSale: "2800",
        uom: "Unidad (u)",
        stock: "60",
        minStock: "12",
        category: "Bebidas",
        brand: "Quilmes"
    },
    {
        code: "7790060023560",
        name: "Alfajor Jorgito Chocolate",
        priceBuy: "450",
        priceSale: "800",
        uom: "Unidad (u)",
        stock: "100",
        minStock: "20",
        category: "Golosinas",
        brand: "Jorgito"
    },
    {
        code: "7790040111201",
        name: "Galletitas Variedad 400g",
        priceBuy: "1200",
        priceSale: "1900",
        uom: "Unidad (u)",
        stock: "30",
        minStock: "5",
        category: "Almacén",
        brand: "Terrabusi"
    },
    {
        code: "7790150021226",
        name: "Pan Lactal Blanco Grande",
        priceBuy: "2500",
        priceSale: "3800",
        uom: "Unidad (u)",
        stock: "15",
        minStock: "0",
        category: "Panadería",
        brand: "Fargo"
    },
    {
        code: "7792790000155",
        name: "Agua Villavicencio 500ml",
        priceBuy: "600",
        priceSale: "1100",
        uom: "Unidad (u)",
        stock: "80",
        minStock: "20",
        category: "Bebidas",
        brand: "Villavicencio"
    },
    {
        code: "7790010000122",
        name: "Leche Entera Clásica 1L",
        priceBuy: "1100",
        priceSale: "1650",
        uom: "Unidad (u)",
        stock: "24",
        minStock: "6",
        category: "Lácteos",
        brand: "La Serenísima"
    },
    {
        code: "7790030000121",
        name: "Papitas Clásicas 150g",
        priceBuy: "1400",
        priceSale: "2300",
        uom: "Unidad (u)",
        stock: "25",
        minStock: "8",
        category: "Snacks",
        brand: "Lay's"
    },
    {
        code: "7790101001114",
        name: "Vino Tinto Clásico 1L",
        priceBuy: "1300",
        priceSale: "2100",
        uom: "Unidad (u)",
        stock: "36",
        minStock: "10",
        category: "Bebidas",
        brand: "Toro"
    },
    {
        code: "7622300150221",
        name: "Chocolate Milka Leger",
        priceBuy: "1200",
        priceSale: "2000",
        uom: "Unidad (u)",
        stock: "50",
        minStock: "15",
        category: "Golosinas",
        brand: "Milka"
    }
];

test.describe('Products Module', () => {
    test('should create 10 products with categories and brands', async ({ page }) => {
        test.setTimeout(60000);
        // Navigate to products page
        await page.goto('/dashboard/productos');

        // Wait for page to load - look for the products list title
        await expect(page.getByText('Lista de Productos')).toBeVisible({ timeout: 10000 });

        // Track created categories and brands to know if we need to create new ones
        const createdCategories = new Set<string>();
        const createdBrands = new Set<string>();

        for (const product of testProducts) {
            // Click "Nuevo Producto" button
            // 1. SCROLL AL TOP: Al haber muchos productos, el scroll queda abajo.
            // Forzamos subir para ver el botón y evitar "element outside of viewport".
            await page.evaluate(() => window.scrollTo(0, 0));
            // await page.waitForTimeout(1000);

            // 2. APERTURA INTELIGENTE:
            // Solo clickeamos si no está visible. Aumentamos el timeout interno
            // para esperar a que React renderice sin spamear clicks.
            await expect(async () => {
                const modalTitle = page.locator('div.fixed').getByText('Nuevo Producto');

                if (!await modalTitle.isVisible()) {
                    await page.getByRole('button', { name: 'Nuevo Producto' }).click();
                }

                // Damos 5s (en vez de 1s) para que aparezca.
                // Esto evita que el loop re-intente hacer clic mientras el modal ya está cargando.
                await expect(modalTitle).toBeVisible({ timeout: 5000 });
            }).toPass({ timeout: 20000 });

            // Fill code field
            await page.locator('#code').fill(product.code);

            // Fill name field
            await page.locator('#name').fill(product.name);

            /// --- Manejo de Categoría ---
            const categoryWrapper = page.locator('#category').locator('..');
            const categoryInput = categoryWrapper.locator('input');

            // Esperar a que cargue el componente
            await expect(categoryWrapper).not.toContainText('Loading', { timeout: 5000 });

            await categoryInput.click();
            await categoryInput.fill(product.category);

            // Esperamos a que aparezca la opción exacta en el menú desplegable
            const categoryMenuOption = page.locator('.css-d7l1ni-option, [role="option"]').filter({ hasText: new RegExp(`^${product.category}$`, 'i') });
            const createCategoryOption = page.getByText(`Crear "${product.category}"`);

            // Espera dinámica a que aparezca o la opción o el botón de crear
            await Promise.race([
                createCategoryOption.waitFor({ state: 'visible', timeout: 3000 }).catch(() => { }),
                categoryMenuOption.waitFor({ state: 'visible', timeout: 3000 }).catch(() => { })
            ]);

            if (await createCategoryOption.isVisible()) {
                await createCategoryOption.click();
                createdCategories.add(product.category);
            } else if (await categoryMenuOption.isVisible()) {
                // Si la opción existe, la clickeamos específicamente para evitar el campo vacío
                await categoryMenuOption.first().click();
            } else {
                // Fallback de seguridad
                await categoryInput.press('Enter');
            }

            // --- Manejo de Marca (Misma lógica) ---
            const brandWrapper = page.locator('#brand').locator('..');
            const brandInput = brandWrapper.locator('input');

            await brandInput.click();
            await brandInput.fill(product.brand);

            const brandMenuOption = page.locator('.css-d7l1ni-option, [role="option"]').filter({ hasText: new RegExp(`^${product.brand}$`, 'i') });
            const createBrandOption = page.getByText(`Crear "${product.brand}"`);

            await Promise.race([
                createBrandOption.waitFor({ state: 'visible', timeout: 3000 }).catch(() => { }),
                brandMenuOption.waitFor({ state: 'visible', timeout: 3000 }).catch(() => { })
            ]);

            if (await createBrandOption.isVisible()) {
                await createBrandOption.click();
                createdBrands.add(product.brand);
            } else {
                await brandMenuOption.first().click();
            }

            // Fill priceBuy
            await page.locator('#priceBuy').fill(product.priceBuy);

            // Fill priceSale
            await page.locator('#priceSale').fill(product.priceSale);

            // Handle UOM (ReactSelect)
            const uomInput = page.locator('#uom').locator('..').locator('input');
            await uomInput.click();
            await page.getByText(product.uom, { exact: true }).click();

            // Fill stock
            await page.locator('#stock').fill(product.stock);

            // Fill minStock (if > 0)
            if (product.minStock !== "0") {
                await page.locator('#minStock').fill(product.minStock);
            }

            // Click "Guardar" button
            const guardarBtn = page.getByRole('button', { name: 'Guardar' });
            await guardarBtn.scrollIntoViewIfNeeded(); // Asegura que el botón esté visible antes de clickear
            await guardarBtn.click();

            // Wait for form to close and product list to reload
            const modalTitle = page.locator('div.fixed').getByText('Nuevo Producto');
            await expect(modalTitle).not.toBeVisible({ timeout: 5000 });

            const nuevoProductoEnLista = page.getByText(product.name).last();

            // 2. SCROLL PRIMERO (La clave del éxito):
            // scrollIntoViewIfNeeded() tiene "auto-wait":
            // - Espera a que el elemento se "adjunte" al DOM (o sea, espera el refresh de la lista).
            // - Una vez que existe, hace scroll hasta él.
            await nuevoProductoEnLista.scrollIntoViewIfNeeded({ timeout: 15000 });

            // 3. ASERCIÓN: Ahora que ya scrolleamos, verificamos que sea visible.
            // Le damos un pequeño margen extra por si hay animaciones.
            await expect(nuevoProductoEnLista).toBeVisible({ timeout: 5000 });
            // Verify the product appears in the list
            // await expect(page.getByText(product.name)).toBeVisible({ timeout: 5000 });

            console.log(`✓ Created product: ${product.name}`);
        }

        // Final verification: count visible products
        console.log(`\n✓ Successfully created ${testProducts.length} products`);
        console.log(`  Categories created: ${[...createdCategories].join(', ') || 'none (all existed)'}`);
        console.log(`  Brands created: ${[...createdBrands].join(', ') || 'none (all existed)'}`);
    });
});
