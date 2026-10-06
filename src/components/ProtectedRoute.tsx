import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../types/auth'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRole: Role
}

export function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return <p>Loading...</p>
  }

  if (!session || !profile) {
    return <Navigate to="/login" replace />
  }

  if (profile.role !== allowedRole) {
    // Logged in, but wrong role — send them to their own home instead
    const redirectPath = profile.role === 'admin' ? '/admin' : '/framer'
    return <Navigate to={redirectPath} replace />
  }

  return <>{children}</>
}