export interface CognitoUser {
  username: string,
  email_verified: boolean,
  sub: string
  email: string
  "cognito:groups": string[]
  commerceId: string | null
  commerceList: string[]
  registrationId?: string | null
  accountStatus?: "pending_subscription" | "trial" | "active" | "past_due" | "cancelled" | string
  role?: "admin" | "vendedor"
}

export interface AuthState {
  isAuthenticated: boolean
  user: CognitoUser | null
  token: string | null
  commerceId: string | null
  accountStatus: "pending_subscription" | "trial" | "active" | "past_due" | "cancelled" | string | null
  role: "admin" | "vendedor" | null
}

export interface LoginCredentials {
  username: string
  password: string
}
