import { expect, type Page } from "@playwright/test"
import { API_BASE_URL } from "./env"

export interface AuthedRequestOptions extends RequestInit {
  commerceId?: string
}

export async function authedRequest(page: Page, endpoint: string, options: AuthedRequestOptions = {}) {
  const response = await page.evaluate(
    async ({ baseUrl, endpoint: pathName, options: requestOptions }) => {
      const rawAuth = localStorage.getItem("authState")
      if (!rawAuth) {
        throw new Error("Missing auth state in localStorage")
      }

      const authState = JSON.parse(rawAuth) as { token?: string; commerceId?: string | null }
      const token = authState.token
      const commerceId = requestOptions.commerceId ?? authState.commerceId

      if (!token || !commerceId) {
        throw new Error("Missing token or commerceId")
      }

      const headers = new Headers(requestOptions.headers || {})
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json")
      }
      headers.set("Authorization", `Bearer ${token}`)

      const response = await fetch(`${baseUrl}/${commerceId}${pathName}`, {
        ...requestOptions,
        headers,
      })

      const text = await response.text()
      let body: any = null
      if (text) {
        try {
          body = JSON.parse(text)
        } catch {
          body = text
        }
      }

      return {
        ok: response.ok,
        status: response.status,
        body,
      }
    },
    { baseUrl: API_BASE_URL, endpoint, options }
  )

  expect(response.ok, `Request to ${endpoint} failed with status ${response.status}`).toBeTruthy()
  return response.body
}

