export interface CognitoUser {
  username: string,
  email_verified: boolean,
  sub: string
  email: string
  "cognito:groups": string[]
  commerceId: string
  commerceList: string[]
  role?: "admin" | "vendedor"
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
