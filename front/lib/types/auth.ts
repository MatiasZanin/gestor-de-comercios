export interface CognitoUser {
  sub: string
  email: string
  "cognito:groups": string[]
  "custom:commerceId": string
  "custom:commerceIds"?: string[]
}

export interface AuthState {
  isAuthenticated: boolean
  user: CognitoUser | null
  token: string | null
  commerceId: string | null
  role: "admin" | "vendedor" | null
}

export interface LoginCredentials {
  username: string
  password: string
}
