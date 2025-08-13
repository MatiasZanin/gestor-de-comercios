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
            username:   payload["cognito:username"],
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
      })
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
