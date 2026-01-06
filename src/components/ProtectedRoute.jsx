import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  // Allow a one-time skip of the forced password change flow,
  // used right after a successful password reset + novo login.
  let skipMustChange = false
  if (typeof window !== 'undefined') {
    try {
      skipMustChange = window.localStorage.getItem('skip-must-change-password') === '1'
    } catch (_) {}
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-neutral-500">Carregando...</div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Force password change flow
  if (skipMustChange && profile?.must_change_password) {
    try {
      window.localStorage.removeItem('skip-must-change-password')
    } catch (_) {}
    return children
  }

  if (profile?.must_change_password && location.pathname !== '/reset-password') {
    return <Navigate to="/reset-password" replace state={{ from: location }} />
  }

  return children
}
