import { jwtDecode } from 'jwt-decode'
import { authApi } from '../api/auth'
import type { Tokens, TokensResponse, User } from '../model/types'
import { createLogger } from '@/shared/lib/logger'

const TOKEN_KEY = 'auth_tokens'
const logger = createLogger({ module: 'TokenManager' })

interface JwtPayload {
  sub: string
  email: string
  given_name?: string
  family_name?: string
  name?: string
  exp?: number
}

export function getTokens(): Tokens | null {
  logger.debug('Getting tokens from storage')
  const stored = localStorage.getItem(TOKEN_KEY)
  if (!stored) {
    logger.debug('No tokens found in storage')
    return null
  }

  const tokens: Tokens = JSON.parse(stored)
  if (!isTokenValid(tokens.accessToken)) {
    logger.debug('Stored access token is invalid')
    return null
  }

  logger.debug('Retrieved valid tokens from storage')
  return tokens
}

export function setTokens(tokens: Tokens | TokensResponse | null | undefined, isRefreshOperation = false): void {
  logger.debug('Setting tokens')
  if (!tokens) {
    logger.debug('No tokens provided, clearing storage')
    clearTokens()
    return
  }

  // Handle both camelCase and snake_case formats
  const normalizedTokens: Tokens = {
    accessToken: (tokens as Tokens).accessToken || (tokens as TokensResponse).access_token || '',
    idToken: (tokens as Tokens).idToken || (tokens as TokensResponse).id_token || '',
    refreshToken: (tokens as Tokens).refreshToken || (tokens as TokensResponse).refresh_token || '',
    expiresIn: (tokens as Tokens).expiresIn || (tokens as TokensResponse).expires_in,
  }

  // During refresh, we want to keep the existing refresh token if the new one is null/empty
  if (isRefreshOperation && !normalizedTokens.refreshToken) {
    const existingTokens = getTokens()
    if (existingTokens?.refreshToken) {
      logger.debug('Keeping existing refresh token during refresh operation')
      normalizedTokens.refreshToken = existingTokens.refreshToken
    }
  }

  if (!normalizedTokens.accessToken || (!isRefreshOperation && !normalizedTokens.refreshToken)) {
    logger.debug('Invalid tokens provided, clearing storage')
    clearTokens()
    return
  }

  localStorage.setItem(TOKEN_KEY, JSON.stringify(normalizedTokens))
  logger.debug('Tokens successfully stored')
}

export function clearTokens(): void {
  logger.debug('Clearing tokens from storage')
  localStorage.removeItem(TOKEN_KEY)
}

export function isTokenValid(token: string): boolean {
  logger.debug('Validating token')
  try {
    const decoded = jwtDecode<JwtPayload>(token)
    const currentTime = Date.now() / 1000
    const expiresIn = decoded.exp ? decoded.exp - currentTime : -1
    
    logger.debug('Token expires in: ' + expiresIn + ' seconds')
    const isValid = decoded.exp ? decoded.exp > currentTime : false
    logger.debug('Token is ' + (isValid ? 'valid' : 'invalid'))
    return isValid
  } catch (error) {
    logger.error('Token validation failed:', error)
    return false
  }
}

export function getUserFromToken(token: string): User | null {
  logger.debug('Extracting user from token')
  try {
    const decoded = jwtDecode<JwtPayload>(token)
    const fullName = decoded.name || 
                    (decoded.given_name && decoded.family_name 
                      ? `${decoded.given_name} ${decoded.family_name}`
                      : decoded.given_name || decoded.family_name)
    const user = {
      id: decoded.sub,
      email: decoded.email,
      name: fullName || undefined,
    }
    logger.debug('Successfully extracted user:', user)
    return user
  } catch (error) {
    logger.error('Failed to extract user from token:', error)
    return null
  }
}

export async function refreshTokens(): Promise<Tokens> {
  logger.debug('Starting token refresh')
  const currentTokens = getTokens()
  if (!currentTokens?.refreshToken) {
    logger.error('No refresh token available')
    throw new Error('No refresh token available')
  }

  try {
    logger.debug('Calling refresh token API')
    const { data: tokens } = await authApi.refreshToken(currentTokens.refreshToken)
    logger.debug('Token refresh successful')
    setTokens(tokens)
    return tokens
  } catch (error) {
    logger.error('Token refresh failed:', error)
    throw error
  }
} 