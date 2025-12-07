import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function ForgotPassword() {
  const { sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const { error } = await sendPasswordReset(email)
      if (error) throw error
      setMessage({ type: 'success', text: 'Se existir uma conta, você receberá um e-mail com instruções.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Erro ao solicitar recuperação.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass w-full max-w-md rounded-2xl p-6">
        <h1 className="text-xl font-semibold mb-2">Recuperar senha</h1>
        <p className="text-sm text-neutral-500 mb-4">Informe seu e-mail para receber o link de recuperação.</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="seu@email.com" className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 px-3 py-2.5 outline-none focus:ring-4 ring-sky-100 dark:ring-sky-900/30"/>
          {message && (
            <div className={`${message.type === 'error' ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30' : 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30'} text-sm rounded-xl px-3 py-2`}>{message.text}</div>
          )}
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 py-2.5">{loading? 'Enviando...' : 'Enviar link'}</button>
        </form>
      </div>
    </div>
  )
}
