import { useLocation } from 'react-router-dom'
import { useAuth } from '@/app/providers/auth-provider'
import { env } from '@/app/config/env'
import { Loading } from '@/shared/ui/loading'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <Loading />
  }

  if (!isAuthenticated) {
    // Redirect to Cognito login
    window.location.href = `${env.AUTH.COGNITO_DOMAIN}/login?client_id=${
      env.AUTH.COGNITO_CLIENT_ID
    }&response_type=code&scope=email+openid+profile&redirect_uri=${
      env.AUTH.REDIRECT_SIGN_IN
    }&state=${encodeURIComponent(location.pathname)}`
    return null
  }

  return <>{children}</>
} 