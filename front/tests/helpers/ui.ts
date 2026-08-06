import { expect, type Page } from "@playwright/test"

export async function selectRadixOption(page: Page, triggerName: string, optionName: string) {
  const trigger = page.getByRole("combobox", { name: triggerName })
  await trigger.click()
  await page.getByRole("option", { name: optionName, exact: true }).click()
}

export async function selectCreatableOption(page: Page, controlId: string, value: string) {
  const wrapper = page.locator(`#${controlId}`).locator("..")
  const input = wrapper.locator("input")
  await input.click()
  await input.fill(value)

  const existingOption = page.getByRole("option", { name: value, exact: true })
  const createOption = page.getByText(`Crear "${value}"`)

  if (await existingOption.count()) {
    await existingOption.first().click()
    return
  }

  await createOption.click()
}

export async function selectReactSelectOption(page: Page, controlId: string, value: string) {
  const wrapper = page.locator(`#${controlId}`).locator("..")
  const input = wrapper.locator("input")
  await input.click()
  await input.fill(value)
  await page.getByRole("option", { name: value, exact: true }).click()
}

export async function expectTextVisible(page: Page, text: string) {
  await expect(page.getByText(text, { exact: false })).toBeVisible()
}
