import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function BankConsolidation() {
  const { profile, loading } = useAuth()

  if (loading || !profile) {
    return <div className="min-h-screen grid place-items-center text-neutral-500">Carregando...</div>
  }

  if (!profile.can_access_financeiro) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Consolidação Bancária</h1>
    </div>
  )
}
