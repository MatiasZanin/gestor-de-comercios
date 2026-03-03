import type { AuthState, CognitoUser as CognitoUserType, LoginCredentials } from "@/lib/types/auth"
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  type CognitoUserSession,
} from "amazon-cognito-identity-js"

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID

if (!userPoolId || !clientId) {
  throw new Error(
    "Missing required Cognito configuration. Please ensure NEXT_PUBLIC_COGNITO_USER_POOL_ID and NEXT_PUBLIC_COGNITO_CLIENT_ID are set in your environment variables.",
  )
}

const userPool = new CognitoUserPool({
  UserPoolId: userPoolId,
  ClientId: clientId,
})

export class AuthService {
  private static instance: AuthService
  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    token: null,
    commerceId: null,
    role: null,
  }

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
        this.authState = JSON.parse(storedAuth)
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
      const cognitoUser = new CognitoUser({
        Username: credentials.username,
        Pool: userPool,
      })

      const authenticationDetails = new AuthenticationDetails({
        Username: credentials.username,
        Password: credentials.password,
      })

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (session: CognitoUserSession) => {
          const idToken = session.getIdToken()
          console.log("🚀 ~ AuthService ~ login ~ idToken:", idToken)
          const payload = idToken.payload as any

          const user: CognitoUserType = {
            username: payload["cognito:username"],
            email_verified: payload.email_verified,
            sub: payload.sub,
            email: payload.email,
            "cognito:groups": payload["cognito:groups"] || [],
            role: payload["cognito:groups"]?.includes("admin") ? "admin" : "vendedor",
            commerceId: payload["custom:commerceIds"].split(",")[0] || null,
            commerceList: payload["custom:commerceIds"]
              ? payload["custom:commerceIds"].split(",")
              : [payload["custom:commerceId"]],
          }

          const role = user["cognito:groups"].includes("admin") ? "admin" : "vendedor"

          this.authState = {
            isAuthenticated: true,
            user,
            token: idToken.getJwtToken(),
            commerceId: user.commerceId,
            role,
          }

          this.saveToStorage()
          resolve(this.authState)
        },
        onFailure: (error) => {
          reject(error)
        },
        newPasswordRequired: (userAttributes, requiredAttributes) => {
          // Guardamos el usuario temporalmente para usarlo en completeNewPassword
          this.tempCognitoUser = cognitoUser
          this.tempUserAttributes = userAttributes

          // Rechazamos con un error especial para que el frontend sepa que necesita nueva contraseña
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

  // Propiedades temporales para manejar el cambio de contraseña
  private tempCognitoUser: CognitoUser | null = null
  private tempUserAttributes: any = null

  async completeNewPassword(newPassword: string): Promise<AuthState> {
    return new Promise((resolve, reject) => {
      if (!this.tempCognitoUser) {
        reject(new Error("No hay proceso de cambio de contraseña en curso"))
        return
      }

      // Removemos los atributos que no se pueden modificar
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

            const user: CognitoUserType = {
              username: payload["cognito:username"],
              email_verified: payload.email_verified,
              sub: payload.sub,
              email: payload.email,
              "cognito:groups": payload["cognito:groups"] || [],
              role: payload["cognito:groups"]?.includes("admin") ? "admin" : "vendedor",
              commerceId: payload["custom:commerceIds"]?.split(",")[0] || null,
              commerceList: payload["custom:commerceIds"]
                ? payload["custom:commerceIds"].split(",")
                : [payload["custom:commerceId"]],
            }

            const role = user["cognito:groups"]?.includes("admin") ? "admin" : "vendedor"

            this.authState = {
              isAuthenticated: true,
              user,
              token: idToken.getJwtToken(),
              commerceId: user.commerceId,
              role,
            }

            this.saveToStorage()

            // Limpiamos las referencias temporales
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

  logout(): void {
    const cognitoUser = userPool.getCurrentUser()
    if (cognitoUser) {
      cognitoUser.signOut()
    }

    this.authState = {
      isAuthenticated: false,
      user: null,
      token: null,
      commerceId: null,
      role: null,
    }

    this.clearStorage()
  }

  // Intenta obtener un token válido, refrescando automáticamente si es necesario
  async getValidToken(): Promise<string | null> {
    return new Promise((resolve) => {
      const cognitoUser = userPool.getCurrentUser()
      if (!cognitoUser) {
        resolve(this.authState.token) // fallback al token almacenado
        return
      }

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          console.warn("No se pudo obtener sesión válida:", err?.message)
          resolve(this.authState.token) // fallback, el API client manejará el 401
          return
        }

        const idToken = session.getIdToken()
        const newToken = idToken.getJwtToken()

        // Actualizar el estado interno si el token cambió
        if (newToken !== this.authState.token) {
          console.info("🔄 Token refrescado exitosamente")
          this.authState.token = newToken
          this.saveToStorage()
        }

        resolve(newToken)
      })
    })
  }

  // Intenta refrescar el token explícitamente. Retorna el nuevo token o null si falla.
  async refreshToken(): Promise<string | null> {
    return new Promise((resolve) => {
      const cognitoUser = userPool.getCurrentUser()
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

        // Actualizar authState completo con el nuevo token
        const user: CognitoUserType = {
          username: payload["cognito:username"],
          email_verified: payload.email_verified,
          sub: payload.sub,
          email: payload.email,
          "cognito:groups": payload["cognito:groups"] || [],
          role: payload["cognito:groups"]?.includes("admin") ? "admin" : "vendedor",
          commerceId: payload["custom:commerceIds"]?.split(",")[0] || null,
          commerceList: payload["custom:commerceIds"]
            ? payload["custom:commerceIds"].split(",")
            : [payload["custom:commerceId"]],
        }

        const role = user["cognito:groups"]?.includes("admin") ? "admin" : "vendedor"

        this.authState = {
          isAuthenticated: true,
          user,
          token: newToken,
          commerceId: user.commerceId,
          role,
        }

        this.saveToStorage()
        console.info("🔄 Token refrescado exitosamente (refresh explícito)")
        resolve(newToken)
      })
    })
  }

  // Maneja tokens expirados: intenta refresh, si falla hace logout
  async handleTokenExpired(): Promise<boolean> {
    console.warn("Token expirado, intentando refresh...")
    const newToken = await this.refreshToken()
    if (newToken) {
      return true // refresh exitoso
    }
    console.warn("Refresh falló, haciendo logout")
    this.logout()
    return false // hay que redirigir al login
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

  getRole(): "admin" | "vendedor" | null {
    return this.authState.role
  }

  getCurrentUser(): CognitoUserType | null {
    return this.authState.user
  }
}

export const authService = AuthService.getInstance()
