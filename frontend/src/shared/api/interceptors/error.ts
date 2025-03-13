import type { AxiosError, AxiosResponse } from 'axios'
import { api } from '../instance'
import type { ApiError } from '../types'

api.interceptors.response.use(
  (response) => {
    // Add fetchedAt to response metadata
    return {
      ...response,
      data: {
        data: response.data,
        meta: {
          fetchedAt: new Date().toISOString(),
        },
      },
    }
  },
  (error: AxiosError<ApiError>) => {
    // For token endpoint errors, pass through without transformation
    if (error.config?.url?.includes('/auth/token')) {
      return Promise.reject(error)
    }

    // Standardize error format for other errors
    if (error.response) {
      const standardError = {
        code: error.response.data.code || error.response.status.toString(),
        message: error.response.data.message || error.message,
        details: error.response.data.details,
      }
      error.response.data = standardError
      return Promise.reject(error)
    }

    // Network errors
    const networkErrorResponse: AxiosResponse = {
      data: {
        code: 'NETWORK_ERROR',
        message: 'Network error occurred',
        details: error.message,
      },
      status: 0,
      statusText: 'Network Error',
      headers: {},
      config: error.config!,
    }
    error.response = networkErrorResponse
    return Promise.reject(error)
  },
) 