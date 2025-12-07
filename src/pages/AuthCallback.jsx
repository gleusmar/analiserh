import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useNavigate } from 'react-router-dom'

export default function AuthCallback() {
  const { exchangeCodeForSession } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    async function run() {
      try {
        await exchangeCodeForSession()
      } catch (e) {
        // ignore
      } finally {
        navigate('/')
      }
    }
    run()
  }, [exchangeCodeForSession, navigate])

  return <div className="min-h-screen grid place-items-center text-neutral-500">Finalizando login...</div>
}
