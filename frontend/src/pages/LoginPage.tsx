/**
 * Login page component.
 */
import React, { useState } from 'react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const { login, register, loginWithGoogle, isLoading, error, clearError } = useAuth()
  const navigate = useNavigate()
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) {
      return
    }

    let cancelled = false

    const initializeGoogle = () => {
      if (cancelled || !window.google || !googleButtonRef.current) {
        return
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: { credential?: string }) => {
          if (!response.credential) {
            return
          }
          clearError()
          try {
            await loginWithGoogle(response.credential)
            navigate('/')
          } catch {
            // Error surfaced from auth context
          }
        },
      })

      googleButtonRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: 320,
      })
    }

    if (window.google?.accounts?.id) {
      initializeGoogle()
      return () => {
        cancelled = true
      }
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = initializeGoogle
    document.head.appendChild(script)

    return () => {
      cancelled = true
    }
  }, [clearError, googleClientId, loginWithGoogle, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    try {
      if (isRegistering) {
        await register(email, password)
      } else {
        await login(email, password)
      }
      navigate('/')
    } catch {
      // Error is handled by context
    }
  }

  const toggleMode = () => {
    clearError()
    setIsRegistering(!isRegistering)
    setEmail('')
    setPassword('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 rounded-lg shadow-2xl p-8">
          <h1 className="text-3xl font-bold text-center text-white mb-2">
            Amzur Chat
          </h1>
          <p className="text-center text-slate-400 mb-8">
            {isRegistering ? 'Create your account' : 'Welcome back'}
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-700 rounded text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@amzur.com"
                required
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
              {isRegistering && (
                <p className="text-xs text-slate-400 mt-1">Minimum 6 characters</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-medium rounded transition duration-200"
            >
              {isLoading ? 'Please wait...' : isRegistering ? 'Create Account' : 'Login'}
            </button>
          </form>

          {!isRegistering && (
            <div className="mt-6">
              <div className="flex items-center gap-3 text-slate-500 text-xs mb-3">
                <div className="h-px bg-slate-700 flex-1" />
                <span>OR</span>
                <div className="h-px bg-slate-700 flex-1" />
              </div>
              {googleClientId ? (
                <div className="flex justify-center">
                  <div ref={googleButtonRef} />
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center">
                  Set VITE_GOOGLE_CLIENT_ID in frontend .env to enable Google login.
                </p>
              )}
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-slate-400 text-sm">
              {isRegistering ? 'Already have an account?' : "Don't have an account?"}
            </p>
            <button
              type="button"
              onClick={toggleMode}
              className="text-purple-400 hover:text-purple-300 font-medium text-sm mt-1"
            >
              {isRegistering ? 'Login' : 'Register'}
            </button>
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs mt-8">
          Allowed domains: @amzur.com and @stackyon.com
        </p>
      </div>
    </div>
  )
}

export default LoginPage
