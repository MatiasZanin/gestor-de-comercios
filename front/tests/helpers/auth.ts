import { expect, type Page } from "@playwright/test";
import fs from "fs";
import {
  ADMIN_STATE_PATH,
  AUTH_DIR,
  USER_STATE_PATH,
  VENDOR_STATE_PATH,
} from "./paths";

export interface LoginCredentials {
  username: string;
  password: string;
}

export const ADMIN_CREDENTIALS: LoginCredentials = {
  username: process.env.E2E_ADMIN_EMAIL ?? "",
  password: process.env.E2E_ADMIN_PASSWORD ?? "",
};

export const VENDOR_CREDENTIALS: LoginCredentials = {
  username: process.env.E2E_VENDOR_EMAIL ?? "",
  password: process.env.E2E_VENDOR_PASSWORD ?? "",
};

export async function loginAndSaveState(
  page: Page,
  credentials: LoginCredentials,
  statePath: string,
) {
  if (!credentials.username || !credentials.password) {
    throw new Error("E2E email/password environment variables are required");
  }
  await page.goto("/login");
  await expect(
    page.getByText("Ingresar al sistema", { exact: true }),
  ).toBeVisible();
  await page.locator("#username").fill(credentials.username);
  await page.locator("#password").fill(credentials.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  await page.context().storageState({ path: statePath });
}

export async function ensureAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }
}

export async function saveAuthStates(page: Page) {
  await ensureAuthDir();
  await loginAndSaveState(page, ADMIN_CREDENTIALS, ADMIN_STATE_PATH);
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await loginAndSaveState(page, VENDOR_CREDENTIALS, VENDOR_STATE_PATH);
  await page.context().storageState({ path: USER_STATE_PATH });
}
