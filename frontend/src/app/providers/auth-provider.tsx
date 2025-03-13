import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { useLocation } from 'react-router-dom'
import { jwtDecode } from 'jwt-decode'
import { env } from '@/app/config/env'
import { authApi } from '@/features/auth/api/auth'
import {
  clearTokens,
  getTokens,
  getUserFromToken,
  setTokens,
  isTokenValid,
} from '@/features/auth/lib/token-manager'
import type { AuthState, Tokens, TokensResponse, User } from '@/features/auth/model/types'
import { createLogger } from '@/shared/lib/logger'

const logger = createLogger({ module: 'AuthProvider' })

interface AuthContextType extends AuthState {
  login: () => void
  logout: () => void
  handleAuthCallback: (code: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(true)
  const [tokens, setAuthTokens] = useState<Tokens | null>(null)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (!tokens?.accessToken) {
      logger.debug('No access token in state, skipping refresh check')
      return
    }

    const decoded = jwtDecode(tokens.accessToken)
    const expiresIn = decoded.exp! - Date.now() / 1000
    const refreshBuffer = 5 * 60 // 5 minutes before expiry
    logger.debug('Token expires in: ' + expiresIn + ' seconds')

    if (expiresIn < refreshBuffer) {
      logger.debug('Token will expire soon, refreshing now')
      handleRefresh()
      return
    }

    logger.debug('Setting up refresh timer for: ' + (expiresIn - refreshBuffer) + ' seconds')
    const timeoutId = setTimeout(() => {
      logger.debug('Refresh timer triggered')
      handleRefresh()
    }, (expiresIn - refreshBuffer) * 1000)

    return () => clearTimeout(timeoutId)
  }, [tokens])

  const handleRefresh = async () => {
    logger.debug('Starting token refresh')
    try {
      const currentTokens = getTokens()
      if (!currentTokens?.refreshToken) {
        logger.debug('No refresh token available')
        throw new Error('No refresh token available')
      }

      logger.debug('Calling refresh token API')
      const { data } = await authApi.refreshToken(currentTokens.refreshToken)
      const newTokens = data.item as TokensResponse
      logger.debug('Token refresh successful')
      
      // Convert snake_case to camelCase and keep existing refresh token
      const normalizedTokens: Tokens = {
        accessToken: newTokens.access_token || '',
        idToken: newTokens.id_token || '',
        refreshToken: currentTokens.refreshToken, // Keep existing refresh token
        expiresIn: newTokens.expires_in,
      }
      
      setTokens(normalizedTokens, true)
      setAuthTokens(normalizedTokens)
      setUser(getUserFromToken(normalizedTokens.idToken))
    } catch (error) {
      logger.error('Token refresh failed:', error)
      logout()
    }
  }

  useEffect(() => {
    const initializeAuth = async () => {
      logger.debug('Initializing auth')
      try {
        const storedTokens = getTokens()
        if (!storedTokens) {
          logger.debug('No stored tokens found')
          setIsLoading(false)
          return
        }

        logger.debug('Found stored tokens, checking validity')
        // Check if access token is expired or will expire soon
        if (!isTokenValid(storedTokens.accessToken)) {
          logger.debug('Access token is invalid or expired, attempting refresh')
          // Try to refresh the token
          await handleRefresh()
        } else {
          logger.debug('Access token is valid, setting auth state')
          setAuthTokens(storedTokens)
          setUser(getUserFromToken(storedTokens.accessToken))
        }
      } catch (error) {
        logger.error('Initialization failed:', error)
        // If refresh fails, clear everything
        clearTokens()
        setAuthTokens(null)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [])

  const login = () => {
    logger.debug('Initiating login redirect')
    const currentPath = location.pathname + location.search
    const loginUrl = `${env.AUTH.COGNITO_DOMAIN}/login?client_id=${
      env.AUTH.COGNITO_CLIENT_ID
    }&response_type=code&scope=email+openid+profile&redirect_uri=${
      env.AUTH.REDIRECT_SIGN_IN
    }&state=${encodeURIComponent(currentPath)}`
    window.location.href = loginUrl
  }

  const logout = async () => {
    logger.debug('Logging out')
    try {
      await authApi.logout()
    } finally {
      clearTokens()
      setAuthTokens(null)
      setUser(null)
      const logoutUrl = `${env.AUTH.COGNITO_DOMAIN}/logout?client_id=${
        env.AUTH.COGNITO_CLIENT_ID
      }&logout_uri=${env.AUTH.REDIRECT_SIGN_OUT}`
      window.location.href = logoutUrl
    }
  }

  const handleAuthCallback = async (code: string) => {
    logger.debug('Handling auth callback')
    try {
      setIsLoading(true)
      const { data: tokens } = await authApi.exchangeCode({
        code,
        redirect_uri: env.AUTH.REDIRECT_SIGN_IN,
      })
      if (!tokens?.accessToken || !tokens?.refreshToken || !tokens?.idToken) {
        logger.error('Invalid token response')
        throw new Error('Invalid token response')
      }
      logger.debug('Token exchange successful')
      setTokens(tokens)
      setAuthTokens(tokens)
      setUser(getUserFromToken(tokens.idToken))
    } catch (error) {
      logger.error('Auth callback failed:', error)
      clearTokens()
      setAuthTokens(null)
      setUser(null)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const value = useMemo(
    () => ({
      isAuthenticated: !!tokens,
      isLoading,
      tokens,
      user,
      login,
      logout,
      handleAuthCallback,
    }),
    [isLoading, tokens, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
} 