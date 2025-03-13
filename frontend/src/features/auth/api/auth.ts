import { api } from '@/shared/api/instance'
import type { ApiResponse } from '@/shared/api/types'
import type { Tokens } from '../model/types'

interface TokenExchangeRequest {
  code: string
  redirect_uri: string
}

interface TokenResponse {
  meta: {
    fetchedAt: string
  }
  item: {
    access_token: string
    refresh_token: string
    id_token: string
    expires_in: number
  }
}

export const authApi = {
  exchangeCode: async (params: TokenExchangeRequest): Promise<ApiResponse<Tokens>> => {
    const response = await api.post<TokenResponse>('/auth/token', params)
    return {
      data: {
        accessToken: response.data.item.access_token,
        refreshToken: response.data.item.refresh_token,
        idToken: response.data.item.id_token,
        expiresIn: response.data.item.expires_in,
      },
      meta: response.data.meta,
    }
  },

  refreshToken: async (refreshToken: string): Promise<ApiResponse<Tokens>> => {
    const response = await api.post<ApiResponse<Tokens>>('/auth/refresh', {
      refreshToken,
    })
    return response.data
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout')
  },
} 