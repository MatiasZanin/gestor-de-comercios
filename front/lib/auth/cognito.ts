import type { BillingStatusResponse } from "@/lib/types/api"
import type { AuthState, CognitoUser as CognitoUserType, LoginCredentials } from "@/lib/types/auth"
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  type CognitoUserSession,
} from "amazon-cognito-identity-js"

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID

let userPool: CognitoUserPool | null = null

try {
  if (userPoolId && clientId) {
    userPool = new CognitoUserPool({
      UserPoolId: userPoolId,
      ClientId: clientId,
    })
  }
} catch {
  userPool = null
}

const BILLING_STATUSES = new Set(["pending_subscription", "trial", "active", "past_due", "cancelled"])

export const authStateEvents = new EventTarget()

function normalizeAccountStatus(value: unknown): AuthState["accountStatus"] {
  return typeof value === "string" && BILLING_STATUSES.has(value) ? value : null
}

function splitCommerceIds(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) {
    return []
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildUserFromPayload(payload: any): CognitoUserType {
  const commerceIds = splitCommerceIds(payload["custom:commerceIds"])
  const commerceId = commerceIds[0] || null
  const groups = Array.isArray(payload["cognito:groups"]) ? payload["cognito:groups"] : []

  return {
    username: typeof payload["cognito:username"] === "string" ? payload["cognito:username"] : "",
    email_verified: payload.email_verified === true || payload.email_verified === "true",
    sub: typeof payload.sub === "string" ? payload.sub : "",
    email: typeof payload.email === "string" ? payload.email : "",
    "cognito:groups": groups,
    commerceId,
    commerceList: commerceIds.length > 0 ? commerceIds : commerceId ? [commerceId] : [],
    registrationId: typeof payload["custom:regId"] === "string" ? payload["custom:regId"] : null,
    accountStatus: normalizeAccountStatus(payload["custom:accountStatus"]) ?? undefined,
    role: groups.includes("admin") ? "admin" : groups.includes("vendedor") ? "vendedor" : undefined,
  }
}

function buildAuthStateFromPayload(payload: any, token: string): AuthState {
  const user = buildUserFromPayload(payload)
  return {
    isAuthenticated: true,
    user,
    token,
    commerceId: user.commerceId,
    accountStatus: user.accountStatus ?? null,
    role: user.role ?? null,
  }
}

function notifyAuthStateChanged() {
  if (typeof window === "undefined") return
  authStateEvents.dispatchEvent(new Event("change"))
}

// Evento global para notificar que la sesión expiró
export const sessionEvents = new EventTarget()

export class AuthService {
  private static instance: AuthService
  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    token: null,
    commerceId: null,
    accountStatus: null,
    role: null,
  }
  private pendingReauth: { resolve: (value: boolean) => void } | null = null
  private tempCognitoUser: CognitoUser | null = null
  private tempUserAttributes: any = null
  private lastBillingRefreshAt = 0
  private lastBillingStatus: BillingStatusResponse | null = null
  private billingStatusLoaded = false

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage(): void {
    if (typeof window === "undefined") return

    try {
      const storedAuth = localStorage.getItem("authState")
      if (storedAuth) {
        const parsed = JSON.parse(storedAuth)
        this.authState = {
          isAuthenticated: !!parsed.isAuthenticated,
          user: parsed.user ?? null,
          token: parsed.token ?? null,
          commerceId: parsed.commerceId ?? null,
          accountStatus: normalizeAccountStatus(parsed.accountStatus),
          role: parsed.role ?? null,
        }
      }
    } catch (error) {
      console.error("Error loading auth state from storage:", error)
      this.clearStorage()
    }
  }

  private saveToStorage(): void {
    if (typeof window === "undefined") return

    try {
      localStorage.setItem("authState", JSON.stringify(this.authState))
      notifyAuthStateChanged()
    } catch (error) {
      console.error("Error saving auth state to storage:", error)
    }
  }

  private clearStorage(): void {
    if (typeof window === "undefined") return
    localStorage.removeItem("authState")
  }

  async login(credentials: LoginCredentials): Promise<AuthState> {
    return new Promise((resolve, reject) => {
      if (!userPool) {
        reject(new Error("Missing required Cognito configuration"))
        return
      }

      const username = credentials.username.includes("@")
        ? credentials.username.trim().toLowerCase()
        : credentials.username.trim()
      const cognitoUser = new CognitoUser({
        Username: username,
        Pool: userPool,
      })

      const authenticationDetails = new AuthenticationDetails({
        Username: username,
        Password: credentials.password,
      })

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (session: CognitoUserSession) => {
          const idToken = session.getIdToken()
          const payload = idToken.payload as any
          this.authState = buildAuthStateFromPayload(payload, idToken.getJwtToken())
          this.saveToStorage()
          resolve(this.authState)
        },
        onFailure: (error) => {
          reject(error)
        },
        newPasswordRequired: (userAttributes, requiredAttributes) => {
          this.tempCognitoUser = cognitoUser
          this.tempUserAttributes = userAttributes
          reject({
            code: "NewPasswordRequired",
            name: "NewPasswordRequired",
            message: "Se requiere cambiar la contraseña",
            userAttributes,
            requiredAttributes,
          })
        },
      })
    })
  }

  async completeNewPassword(newPassword: string): Promise<AuthState> {
    return new Promise((resolve, reject) => {
      if (!this.tempCognitoUser) {
        reject(new Error("No hay proceso de cambio de contraseña en curso"))
        return
      }

      const attributesData = { ...this.tempUserAttributes }
      delete attributesData.email_verified
      delete attributesData.email

      this.tempCognitoUser.completeNewPasswordChallenge(
        newPassword,
        attributesData,
        {
          onSuccess: (session: CognitoUserSession) => {
            const idToken = session.getIdToken()
            const payload = idToken.payload as any
            this.authState = buildAuthStateFromPayload(payload, idToken.getJwtToken())
            this.saveToStorage()
            this.tempCognitoUser = null
            this.tempUserAttributes = null
            resolve(this.authState)
          },
          onFailure: (error) => {
            reject(error)
          },
        }
      )
    })
  }

  async requestPasswordReset(usernameInput: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!userPool) return reject(new Error("Missing required Cognito configuration"))
      const username = usernameInput.includes("@") ? usernameInput.trim().toLowerCase() : usernameInput.trim()
      const cognitoUser = new CognitoUser({ Username: username, Pool: userPool })
      cognitoUser.forgotPassword({
        onSuccess: () => resolve(),
        onFailure: reject,
        inputVerificationCode: () => resolve(),
      })
    })
  }

  async confirmPasswordReset(usernameInput: string, code: string, newPassword: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!userPool) return reject(new Error("Missing required Cognito configuration"))
      const username = usernameInput.includes("@") ? usernameInput.trim().toLowerCase() : usernameInput.trim()
      const cognitoUser = new CognitoUser({ Username: username, Pool: userPool })
      cognitoUser.confirmPassword(code.trim(), newPassword, {
        onSuccess: () => resolve(),
        onFailure: reject,
      })
    })
  }

  logout(): void {
    const cognitoUser = userPool?.getCurrentUser()
    if (cognitoUser) {
      cognitoUser.signOut()
    }

    this.authState = {
      isAuthenticated: false,
      user: null,
      token: null,
      commerceId: null,
      accountStatus: null,
      role: null,
    }

    this.clearStorage()
    this.lastBillingStatus = null
    this.billingStatusLoaded = false
    notifyAuthStateChanged()
  }

  async getValidToken(): Promise<string | null> {
    return new Promise((resolve) => {
      const cognitoUser = userPool?.getCurrentUser()
      if (!cognitoUser) {
        resolve(this.authState.token)
        return
      }

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          console.warn("No se pudo obtener sesión válida:", err?.message)
          resolve(this.authState.token)
          return
        }

        const idToken = session.getIdToken()
        const newToken = idToken.getJwtToken()
        if (newToken !== this.authState.token) {
          this.authState.token = newToken
          this.saveToStorage()
        }

        resolve(newToken)
      })
    })
  }

  async refreshToken(): Promise<string | null> {
    return new Promise((resolve) => {
      const cognitoUser = userPool?.getCurrentUser()
      if (!cognitoUser) {
        resolve(null)
        return
      }

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          console.warn("Refresh token falló:", err?.message)
          resolve(null)
          return
        }

        const idToken = session.getIdToken()
        const newToken = idToken.getJwtToken()
        const payload = idToken.payload as any
        this.authState = buildAuthStateFromPayload(payload, newToken)
        this.saveToStorage()
        resolve(newToken)
      })
    })
  }

  async forceRefreshToken(): Promise<string | null> {
    return new Promise((resolve) => {
      const cognitoUser = userPool?.getCurrentUser()
      if (!cognitoUser) return resolve(null)
      cognitoUser.getSession((error: Error | null, session: CognitoUserSession | null) => {
        if (error || !session) return resolve(null)
        cognitoUser.refreshSession(session.getRefreshToken(), (refreshError, refreshedSession) => {
        if (refreshError || !refreshedSession) return resolve(null)
        const idToken = refreshedSession.getIdToken()
        this.authState = buildAuthStateFromPayload(idToken.payload, idToken.getJwtToken())
        this.saveToStorage()
        resolve(idToken.getJwtToken())
        })
      })
    })
  }

  async handleTokenExpired(): Promise<boolean> {
    const newToken = await this.refreshToken()
    if (newToken) {
      return true
    }

    sessionEvents.dispatchEvent(new Event("session-expired"))
    return new Promise((resolve) => {
      this.pendingReauth = { resolve }
    })
  }

  resolveReauth(): void {
    if (this.pendingReauth) {
      this.pendingReauth.resolve(true)
      this.pendingReauth = null
    }
  }

  rejectReauth(): void {
    if (this.pendingReauth) {
      this.pendingReauth.resolve(false)
      this.pendingReauth = null
    }
  }

  getAuthState(): AuthState {
    return { ...this.authState }
  }

  isAuthenticated(): boolean {
    return this.authState.isAuthenticated && !!this.authState.token
  }

  getToken(): string | null {
    return this.authState.token
  }

  getCommerceId(): string | null {
    return this.authState.commerceId
  }

  getAccountStatus(): AuthState["accountStatus"] {
    return this.authState.accountStatus
  }

  getRole(): "admin" | "vendedor" | null {
    return this.authState.role
  }

  getCurrentUser(): CognitoUserType | null {
    return this.authState.user
  }

  markBillingRefresh(): void {
    this.lastBillingRefreshAt = Date.now()
  }

  getLastBillingRefreshAt(): number {
    return this.lastBillingRefreshAt
  }

  setBillingStatus(status: BillingStatusResponse | null): void {
    this.lastBillingStatus = status
    this.billingStatusLoaded = true
    notifyAuthStateChanged()
  }

  getBillingStatus(): BillingStatusResponse | null {
    return this.lastBillingStatus
  }

  isBillingStatusLoaded(): boolean {
    return this.billingStatusLoaded
  }
}

export const authService = AuthService.getInstance()
