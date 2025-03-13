import { Environment } from './types'

function validateEnvironment(): Environment {
  const env = import.meta.env

  const required = [
    'VITE_API_URL',
    'VITE_COGNITO_REGION',
    'VITE_COGNITO_USER_POOL_ID',
    'VITE_COGNITO_CLIENT_ID',
    'VITE_COGNITO_DOMAIN',
    'VITE_REDIRECT_SIGN_IN',
    'VITE_REDIRECT_SIGN_OUT',
  ]

  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
  }

  return {
    MODE: env.MODE as Environment['MODE'],
    API_URL: env.VITE_API_URL,
    AUTH: {
      COGNITO_REGION: env.VITE_COGNITO_REGION,
      COGNITO_USER_POOL_ID: env.VITE_COGNITO_USER_POOL_ID,
      COGNITO_CLIENT_ID: env.VITE_COGNITO_CLIENT_ID,
      COGNITO_DOMAIN: env.VITE_COGNITO_DOMAIN,
      REDIRECT_SIGN_IN: env.VITE_REDIRECT_SIGN_IN,
      REDIRECT_SIGN_OUT: env.VITE_REDIRECT_SIGN_OUT,
    },
    FEATURES: {
      ENABLE_ANALYTICS: env.VITE_ENABLE_ANALYTICS === 'true',
      ENABLE_ERROR_REPORTING: env.VITE_ENABLE_ERROR_REPORTING === 'true',
    },
  }
}

export const env = validateEnvironment() 