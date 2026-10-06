import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { FramerPage } from './pages/FramerPage'
import { AdminPage } from './pages/AdminPage'

function HomeRedirect() {
  const { session, profile, loading } = useAuth()

  if (loading) return <p>Loading...</p>

  if (!session || !profile) {
    return <Navigate to="/login" replace />
  }

  return (
    <Navigate
      to={profile.role === 'admin' ? '/admin' : '/framer'}
      replace
    />
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="/framer"
          element={
            <ProtectedRoute allowedRole="framer">
              <FramerPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App