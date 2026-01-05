import { useState } from 'react'
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const { signIn, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  useEffect(() => {
    if (user) navigate('/')
  }, [user, navigate])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const { error } = await signIn(email, password)
      if (error) throw error
      navigate(from, { replace: true })
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Erro ao fazer login.' })
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-violet-50 flex items-center justify-center p-6">
      <div className="glass w-full max-w-md rounded-2xl p-8">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2">
            <div className="size-10 rounded-xl bg-gradient-to-tr from-sky-500 to-violet-500 grid place-items-center text-white font-bold">RH</div>
            <span className="text-2xl font-semibold tracking-tight">Análise RH</span>
          </div>
          <div className="mt-3 flex items-center justify-center gap-3">
            <p className="text-sm text-neutral-500">Acesse sua conta para continuar</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-xl border border-neutral-200 bg-white/60 pl-10 pr-3 py-2.5 outline-none focus:ring-4 ring-sky-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-neutral-200 bg-white/60 pl-10 pr-10 py-2.5 outline-none focus:ring-4 ring-violet-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-neutral-500 hover:text-neutral-700"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {message && (
            <div className={`${message.type === 'error' ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'} text-sm rounded-xl px-3 py-2`}>{message.text}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 text-white font-medium py-2.5 hover:opacity-95 active:opacity-90 disabled:opacity-60"
          >
            <LogIn className="size-4" />
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-neutral-600">
          <Link to="/forgot-password" className="font-medium text-sky-600 hover:underline">Esqueci a senha</Link>
        </div>
      </div>
    </div>
  )
}
