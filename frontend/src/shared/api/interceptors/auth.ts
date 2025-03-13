import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { api } from '../instance'
import { getTokens, refreshTokens } from '@/features/auth/lib/token-manager'
import { env } from '@/app/config/env'

// Add auth token to requests
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const tokens = getTokens()
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`
  }
  return config
})

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config

    // If it's not a 401 error or it's a token endpoint, just reject
    if (error.response?.status !== 401 || 
        originalRequest?.url?.includes('/auth/token') || 
        originalRequest?.url?.includes('/auth/refresh')) {
      return Promise.reject(error)
    }

    try {
      // Attempt to refresh the token
      await refreshTokens()

      // Retry the original request with the new token
      const tokens = getTokens()
      if (tokens?.accessToken && originalRequest) {
        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`
        return api(originalRequest)
      }
    } catch (refreshError) {
      // If refresh fails, redirect to login
      window.location.href = `${env.AUTH.COGNITO_DOMAIN}/login?client_id=${
        env.AUTH.COGNITO_CLIENT_ID
      }&response_type=code&scope=email+openid+profile&redirect_uri=${
        env.AUTH.REDIRECT_SIGN_IN
      }&state=${encodeURIComponent(window.location.pathname)}`
    }
    
    return Promise.reject(error)
  },
) 