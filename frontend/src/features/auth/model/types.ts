export interface TokensResponse {
  access_token?: string
  refresh_token?: string
  id_token?: string
  expires_in?: number
}

export interface Tokens {
  accessToken: string
  refreshToken: string
  idToken: string
  expiresIn?: number
}

export interface User {
  id: string
  email: string
  name?: string
}

export interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  tokens: Tokens | null
  user: User | null
} 