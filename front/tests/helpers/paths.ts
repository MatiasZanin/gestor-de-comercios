import path from "path"

export const AUTH_DIR = path.resolve(process.cwd(), "tests/.auth")
export const ADMIN_STATE_PATH = path.resolve(AUTH_DIR, "admin.json")
export const USER_STATE_PATH = path.resolve(AUTH_DIR, "user.json")
export const VENDOR_STATE_PATH = path.resolve(AUTH_DIR, "vendor.json")

