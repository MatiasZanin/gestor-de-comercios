import { expect, test } from "@playwright/test"
import { ADMIN_STATE_PATH, VENDOR_STATE_PATH } from "./helpers/paths"
import {
  authedRequest,
  createManagedUser,
  disableManagedUser,
  getCommerceId,
  listManagedUsers,
  resetManagedUserPassword,
  updateManagedUser,
} from "./helpers/api"

test.describe.serial("user management", () => {
  test.use({ storageState: ADMIN_STATE_PATH })

  test("admin lists its commerce and manages users from the responsive UI", async ({ page }) => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const email = `e2e-user-${suffix}@example.com`
    await page.goto("/dashboard/usuarios")
    await expect(page.getByRole("heading", { name: "Gestor de usuarios" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Gestor de usuarios" })).toBeVisible()

    await page.getByRole("button", { name: "Agregar usuario" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Nombre").fill("A")
    await dialog.getByLabel("Apellido").fill("B")
    await dialog.getByLabel("Email").fill("invalid")
    await dialog.getByRole("button", { name: "Guardar" }).click()
    await expect(dialog.getByText(/al menos 2 caracteres/)).toBeVisible()
    await dialog.getByLabel("Nombre").fill("Usuario")
    await dialog.getByLabel("Apellido").fill("Prueba")
    await dialog.getByLabel("Email").fill(email.toUpperCase())
    await dialog.getByRole("button", { name: "Guardar" }).click()
    const table = page.getByRole("table")
    const userRow = table.getByRole("row").filter({ hasText: email })
    await expect(userRow.getByText(email, { exact: true })).toBeVisible({ timeout: 20000 })
    await expect(userRow.getByText("Vendedor", { exact: true })).toBeVisible()

    await userRow.getByRole("button", { name: "Modificar Usuario Prueba" }).click()
    await expect(dialog.getByLabel("Email")).toHaveAttribute("readonly", "")
    await dialog.getByLabel("Nombre").fill("Usuario Editado")
    await dialog.getByLabel("Rol").click()
    await page.getByRole("option", { name: "Administrador" }).click()
    await dialog.getByRole("button", { name: "Guardar" }).click()
    const editedUserRow = table.getByRole("row").filter({ hasText: email })
    await expect(editedUserRow.getByText("Usuario Editado Prueba")).toBeVisible()

    await page.route("**/users/*/reset-password", async (route) => {
      if (route.request().method() !== "POST") return route.continue()
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ message: "Código enviado" }),
      })
    })
    await editedUserRow.getByRole("button", { name: "Restablecer contraseña de Usuario Editado Prueba" }).click()
    await page.getByRole("button", { name: "Confirmar" }).click()
    await expect(page.getByText("Restablecimiento iniciado")).toBeVisible()

    await editedUserRow.getByRole("button", { name: "Eliminar Usuario Editado Prueba" }).click()
    await page.getByRole("button", { name: "Confirmar" }).click()
    await expect(table.getByText(email, { exact: true })).toHaveCount(0)
  })

  test("backend enforces tenant, owner, email and role restrictions", async () => {
    const users = await listManagedUsers()
    const owner = users.items.find((item) => item.isOwner)
    expect(owner).toBeTruthy()
    await expect(updateManagedUser(owner!.userId, { firstName: "Owner", lastName: "Changed", role: "admin" })).rejects.toThrow()
    await expect(disableManagedUser(owner!.userId)).rejects.toThrow()
    await expect(listManagedUsers({ commerceId: "otro-comercio" })).rejects.toThrow()
    await expect(authedRequest("/users", { role: "vendor" })).rejects.toThrow()

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
    const created = await createManagedUser({ firstName: "API", lastName: "Vendedor", email: `api-${suffix}@example.com`, role: "vendedor" })
    await expect(createManagedUser({ firstName: "API", lastName: "Duplicado", email: created.email.toUpperCase(), role: "admin" })).rejects.toThrow(/existe/i)
    await expect(updateManagedUser(created.userId, { firstName: "API", lastName: "Vendedor", role: "root" })).rejects.toThrow(/rol/i)
    await expect(updateManagedUser(created.userId, { firstName: "API", lastName: "Vendedor", role: "vendedor", email: "otro@example.com" })).rejects.toThrow(/email/i)
    await expect(resetManagedUserPassword(created.userId)).rejects.toThrow(/invitación/i)
    await disableManagedUser(created.userId)
    expect((await listManagedUsers()).items.some((item) => item.userId === created.userId)).toBe(false)
    expect(getCommerceId()).toBeTruthy()
  })
})

test.describe("user manager vendor access", () => {
  test.use({ storageState: VENDOR_STATE_PATH })
  test("vendors neither see nor open user management", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page.getByRole("link", { name: "Gestor de usuarios" })).toHaveCount(0)
    await page.goto("/dashboard/usuarios")
    await expect(page).toHaveURL(/\/dashboard$/)
  })
})
