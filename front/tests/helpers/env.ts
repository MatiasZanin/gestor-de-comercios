import fs from "fs"
import path from "path"

const envPath = path.resolve(process.cwd(), ".env")

function readEnvFile(): Record<string, string> {
  if (!fs.existsSync(envPath)) {
    return {}
  }

  const content = fs.readFileSync(envPath, "utf8")
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=")
        if (index === -1) {
          return [line, ""]
        }
        const key = line.slice(0, index).trim()
        const value = line.slice(index + 1).trim()
        return [key, value]
      })
  )
}

const env = {
  ...readEnvFile(),
  ...process.env,
}

export const API_BASE_URL = env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000"
export const COGNITO_CLIENT_ID = env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? ""
export const COGNITO_USER_POOL_ID = env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? ""

