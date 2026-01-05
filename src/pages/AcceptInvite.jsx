import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import { acceptInvitationAndPromote } from '../lib/db'

export default function AcceptInvite() {
  const { token } = useParams()
  const { user } = useAuth()
  const [status, setStatus] = useState('idle') // idle | need-login | processing | done | error
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    async function run() {
      if (!token) return
      if (!user) {
        setStatus('need-login')
        return
      }
      try {
        setStatus('processing')
        await acceptInvitationAndPromote(token, user)
        setStatus('done')
        setMessage('Convite aceito! Seu papel foi atualizado.')
        setTimeout(() => window.location.assign('/'), 1000)
      } catch (e) {
        setStatus('error')
        setMessage(e.message || 'Não foi possível aceitar o convite.')
      }
    }
    run()
  }, [token, user, navigate])

  if (status === 'need-login') {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="glass max-w-md w-full rounded-2xl p-6 text-center space-y-3">
          <h1 className="text-xl font-semibold">Você precisa entrar para aceitar o convite</h1>
          <p className="text-neutral-600">Acesse com o mesmo e-mail que recebeu o convite.</p>
          <Link to="/login" state={{ from: location }} className="inline-flex justify-center rounded-xl bg-neutral-900 text-white px-4 py-2.5">Ir para login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="glass max-w-md w-full rounded-2xl p-6 text-center space-y-3">
        <h1 className="text-xl font-semibold">Aceitando convite...</h1>
        {status === 'processing' && <p className="text-neutral-600">Processando...</p>}
        {status === 'done' && <p className="text-emerald-600">{message}</p>}
        {status === 'error' && <p className="text-red-600">{message}</p>}
      </div>
    </div>
  )
}
