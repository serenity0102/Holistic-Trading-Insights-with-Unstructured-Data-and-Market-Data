export interface Environment {
  MODE: 'local' | 'development' | 'testing' | 'production'
  API_URL: string
  AUTH: {
    COGNITO_REGION: string
    COGNITO_USER_POOL_ID: string
    COGNITO_CLIENT_ID: string
    COGNITO_DOMAIN: string
    REDIRECT_SIGN_IN: string
    REDIRECT_SIGN_OUT: string
  }
  FEATURES: {
    ENABLE_ANALYTICS: boolean
    ENABLE_ERROR_REPORTING: boolean
  }
}

export interface RuntimeConfig {
  publicUrl: string
  isDevelopment: boolean
  isProduction: boolean
  isTesting: boolean
  isLocal: boolean
} 