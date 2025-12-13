import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function RoleRoute({ allow = [], children }) {
  const { role, loading, user } = useAuth()
  // Enquanto a sessão está carregando, ou o usuário existe mas o papel ainda não foi resolvido, não redirecionar
  if (loading || (user && role === 'anonymous')) {
    return null
  }
  if (!allow.includes(role)) {
    return <Navigate to="/" replace />
  }
  return children
}
