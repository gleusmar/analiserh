import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { clearMustChangePassword } from '../lib/db'
import { useNavigate } from 'react-router-dom'

export default function ResetPassword() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(()=>{
    // The user reaches here after clicking the recovery link; supabase will attach a session.
  },[])

  async function onSubmit(e) {
    e.preventDefault()
    if (password !== confirm) {
      setMessage({ type: 'error', text: 'As senhas não coincidem.' })
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const { error } = await updatePassword(password)
      if (error) throw error
      try { await clearMustChangePassword() } catch (_) {}
      setMessage({ type: 'success', text: 'Senha atualizada com sucesso. Redirecionando...' })
      setTimeout(()=>navigate('/login'), 1200)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Erro ao atualizar senha.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass w-full max-w-md rounded-2xl p-6">
        <h1 className="text-xl font-semibold mb-4">Definir nova senha</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <input type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Nova senha" className="w-full rounded-xl border border-neutral-200 bg-white/60 px-3 py-2.5 outline-none focus:ring-4 ring-violet-100"/>
          <input type="password" required value={confirm} onChange={(e)=>setConfirm(e.target.value)} placeholder="Confirmar senha" className="w-full rounded-xl border border-neutral-200 bg-white/60 px-3 py-2.5 outline-none focus:ring-4 ring-violet-100"/>
          {message && (
            <div className={`${message.type === 'error' ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'} text-sm rounded-xl px-3 py-2`}>{message.text}</div>
          )}
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-neutral-900 text-white py-2.5">{loading? 'Atualizando...' : 'Salvar'}</button>
        </form>
      </div>
    </div>
  )
}
