import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-neutral-500">Carregando...</div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Force password change flow
  if (profile?.must_change_password && location.pathname !== '/reset-password') {
    return <Navigate to="/reset-password" replace state={{ from: location }} />
  }

  return children
}
