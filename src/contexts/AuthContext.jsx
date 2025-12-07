import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ensureProfile, fetchMyProfile } from '../lib/db'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [role, setRole] = useState('anonymous')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function init() {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    }
    init()
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })
    return () => {
      subscription.subscription.unsubscribe()
      mounted = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user) {
        setRole('anonymous')
        return
      }
      try {
        await ensureProfile(user)
        const profile = await fetchMyProfile()
        setProfile(profile)
        if (cancelled) return
        const superEmail = import.meta.env.VITE_SUPER_EMAIL
        const derived = (superEmail && user.email === superEmail)
          ? 'super'
          : profile?.role || user.user_metadata?.role || 'user'
        setRole(derived)
      } catch (_e) {
        const superEmail = import.meta.env.VITE_SUPER_EMAIL
        const fallback = (superEmail && user.email === superEmail) ? 'super' : (user.user_metadata?.role || 'user')
        setRole(fallback)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user])

  const value = useMemo(() => ({
    session,
    user,
    profile,
    role,
    loading,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password) => supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { role: 'user' },
      },
    }),
    signOut: () => supabase.auth.signOut(),
    sendPasswordReset: (email) => supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }),
    updatePassword: (password) => supabase.auth.updateUser({ password }),
    exchangeCodeForSession: () => supabase.auth.exchangeCodeForSession({ currentUrl: window.location.href }),
  }), [session, user, role, loading])

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
