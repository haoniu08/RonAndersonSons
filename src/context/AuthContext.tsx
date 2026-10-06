import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/auth'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, name, role')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Failed to fetch profile:', error)
      setProfile(null)
      return
    }

    setProfile(data as Profile)
  }

  useEffect(() => {
    async function initializeAuth() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (error) {
        console.error('Failed to get session:', error)
      }

      setSession(session)

      if (session) {
        await fetchProfile(session.user.id)
      }

      setLoading(false)
    }

    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)

      if (!session) {
        setProfile(null)
        setLoading(false)
        return
      }

      // Don't block the auth callback itself.
      void fetchProfile(session.user.id)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Failed to sign out:', error)
      throw error
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}