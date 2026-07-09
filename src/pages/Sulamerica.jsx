import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function Sulamerica() {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (loading) return
    // Se o perfil ainda não foi carregado, não decidir ainda
    if (!profile) return
    if (profile.can_access_sulamerica) return
    setToast({ title: 'Acesso restrito', message: 'Você não tem permissão para acessar o portal SulAmérica.' })
    const timer = setTimeout(() => {
      // Redirecionar para o domínio principal de RH
      window.location.href = 'https://rh.analiselabclinico.com.br'
    }, 2500)
    return () => clearTimeout(timer)
  }, [loading, profile, navigate])

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-neutral-500">Carregando...</div>
  }

  // Enquanto o perfil não estiver carregado, evitar piscar tela de acesso negado
  if (!profile) {
    return <div className="min-h-screen grid place-items-center text-neutral-500">Carregando...</div>
  }

  if (!profile.can_access_sulamerica) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-white">
        {toast && (
          <div className="fixed bottom-4 right-4 bg-red-500 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
            <div className="font-semibold mb-0.5">{toast.title}</div>
            <div>{toast.message}</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <h1 className="text-2xl font-semibold">Portal SulAmérica</h1>
        <p className="mt-2 text-sm text-neutral-600">Área restrita para gestão de informações relacionadas ao convênio SulAmérica.</p>
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
        Em breve: conteúdo específico do portal SulAmérica.
      </div>
    </div>
  )
}
