import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Definimos la ruta del archivo de autenticación.
 */
const authFile = 'tests/.auth/user.json';

/**
 * Verificamos si el archivo de sesión ya existe en el disco.
 * Usamos path.resolve para asegurar la ruta correcta desde la raíz.
 */
const authFileExists = fs.existsSync(path.resolve(__dirname, authFile));

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel - disabled for ordered execution */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Run tests sequentially */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',

  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: 'http://localhost:3000',

    // Desactiva el viewport fijo para usar el tamaño real de la pantalla
    viewport: null,

    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',

    // Si un click no se puede hacer en 5 segundos, falla el test inmediatamente.
    actionTimeout: 5000,
  },

  /* Configure projects for ordered test execution */
  projects: [
    // 1. Setup project (Autenticación)
    // LÓGICA CONDICIONAL: Solo incluimos este proyecto si el archivo NO existe.
    ...(!authFileExists ? [{
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    }] : []),

    // 2. Main tests (Chromium)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Usamos el estado guardado (si existe) o el que generará el setup
        storageState: authFile,
      },
      // LÓGICA CONDICIONAL: Solo depende de 'setup' si el archivo NO existía.
      // Si ya existe, arranca directo sin esperar nada.
      dependencies: !authFileExists ? ['setup'] : [],

      // Run test files in alphabetical order
      testMatch: /.*\.spec\.ts/,
    },

    // Uncomment these to run in other browsers as well
    // {
    //   name: 'firefox',
    //   use: { 
    //     ...devices['Desktop Firefox'],
    //     storageState: authFile,
    //   },
    //   dependencies: !authFileExists ? ['setup'] : [],
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});