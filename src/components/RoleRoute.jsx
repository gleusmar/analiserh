import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function RoleRoute({ allow = [], children }) {
  const { role, loading } = useAuth()
  if (loading) return null
  if (!allow.includes(role)) {
    return <Navigate to="/" replace />
  }
  return children
}
