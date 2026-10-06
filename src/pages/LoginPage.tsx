import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Header } from '../components/Header'

export function LoginPage() {
  const { session, profile, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setSubmitting(false)

    if (error) {
      setError(error.message)
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <div className="page-container">
          <p>Loading...</p>
        </div>
      </>
    )
  }

  if (session && profile) {
    return (
      <Navigate
        to={profile.role === 'admin' ? '/admin' : '/framer'}
        replace
      />
    )
  }

  return (
    <>
      <Header />
      <div className="page-container">
        <h1>Log in</h1>

        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="field-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <p className="error-text" role="alert" aria-live="polite">
              {error}
            </p>
          )}

          <div className="btn-row">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Logging in...' : 'Log in'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}