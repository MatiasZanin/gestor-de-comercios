import { test } from "@playwright/test"
import { ensureAuthDir, loginAndSaveState, ADMIN_CREDENTIALS, VENDOR_CREDENTIALS } from "./helpers/auth"
import { ADMIN_STATE_PATH, VENDOR_STATE_PATH } from "./helpers/paths"

test.describe.serial("auth setup", () => {
  test("save admin storage state", async ({ page }) => {
    await ensureAuthDir()
    await loginAndSaveState(page, ADMIN_CREDENTIALS, ADMIN_STATE_PATH)
  })

  test("save vendor storage state", async ({ page }) => {
    await ensureAuthDir()
    await loginAndSaveState(page, VENDOR_CREDENTIALS, VENDOR_STATE_PATH)
  })
})

