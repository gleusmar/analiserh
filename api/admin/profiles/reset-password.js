import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE')
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(req.body || '{}')
    const { profile_id, password } = body || {}

    if (!profile_id || !password) {
      return res.status(400).json({ error: 'profile_id e password são obrigatórios' })
    }

    const admin = getAdminClient()

    const { data: before, error: selErr } = await admin
      .from('profiles')
      .select('id, email')
      .eq('id', profile_id)
      .maybeSingle()
    if (selErr) throw selErr
    if (!before) return res.status(404).json({ error: 'perfil não encontrado' })

    const { error: updErr } = await admin.auth.admin.updateUserById(profile_id, { password })
    if (updErr) throw updErr

    const { data, error: profErr } = await admin
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', profile_id)
      .select('id, email')
      .single()
    if (profErr) throw profErr

    try {
      const actorId = req.headers['x-actor-id'] || null
      const actorEmail = req.headers['x-actor-email'] || null
      await admin.from('audit_logs').insert({
        action: 'user:password:reset',
        actor_id: actorId,
        actor_email: actorEmail,
        target_id: data.id,
        target_email: data.email,
      })
    } catch (logErr) {
      console.warn('audit log failed', logErr)
    }

    return res.status(200).json({ ok: true, id: data.id })
  } catch (e) {
    console.error('reset-password error', e)
    return res.status(500).json({ error: e.message || 'falha ao resetar senha do usuário' })
  }
}
