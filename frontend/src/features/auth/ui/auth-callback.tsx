import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Alert } from '@cloudscape-design/components'
import { useAuth } from '@/app/providers/auth-provider'
import { Loading } from '@/shared/ui/loading'

export function AuthCallback() {
  const [searchParams] = useSearchParams()
  const { handleAuthCallback } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const processedCode = useRef<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    if (error) {
      setError(error)
      return
    }

    // Only process if we have a code and haven't processed this exact code before
    if (code && processedCode.current !== code) {
      processedCode.current = code
      handleAuthCallback(code)
        .then(() => {
          // Redirect to the original path or default to home
          navigate(state ? decodeURIComponent(state) : '/')
        })
        .catch((err: any) => {
          // Extract error message from various possible error formats
          const errorMessage = err.response?.data?.message || 
                             err.response?.data?.error_description ||
                             err.message || 
                             'Authentication failed'
          setError(errorMessage)
          // Don't reset processedCode here - if it failed once, it will fail again
        })
    }
  }, [handleAuthCallback, navigate, searchParams])

  if (error) {
    return (
      <Alert
        type="error"
        header="Authentication Error"
        dismissible
        onDismiss={() => {
          // On dismiss, redirect to login
          window.location.href = '/'
        }}
      >
        {error}
      </Alert>
    )
  }

  return <Loading />
} 