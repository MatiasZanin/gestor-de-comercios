import { test as setup, expect } from '@playwright/test';

const authFile = 'tests/.auth/user.json';

setup('authenticate', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Wait for the login form to load
    await expect(page.getByText('Sistema de Ventas')).toBeVisible();

    // Fill login credentials
    // Note: The login form has default values re-filled (Matias / Pass_2025)
    // We'll clear and fill to ensure correct values
    await page.locator('#username').clear();
    await page.locator('#username').fill('Matias');

    await page.locator('#password').clear();
    await page.locator('#password').fill('Pass_2025');

    // Click login button
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click();

    // Wait for navigation to dashboard after successful login
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 15000 });

    // Verify we're on the dashboard
    await expect(page.locator('body')).toContainText('Dashboard', { timeout: 5000 });

    console.log('✓ Login successful, saving auth state');

    // Save the storage state (cookies, localStorage, etc.)
    await page.context().storageState({ path: authFile });
});
