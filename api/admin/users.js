import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in environment')
}

const admin = SUPABASE_URL && SERVICE_ROLE
  ? createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!admin) {
    return res.status(500).json({ error: 'Admin client not configured' })
  }

  try {
    const { email, password, role = 'user' } = req.body || {}

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }
    if (!['user', 'admin', 'gestor-plantoes'].includes(role)) {
      return res.status(400).json({ error: 'invalid role' })
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role },
    })
    if (error) throw error

    const user = data.user
    if (!user) throw new Error('User creation returned no user')

    const { error: upsertErr } = await admin
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email,
          role,
          status: 'active',
          must_change_password: true,
        },
        { onConflict: 'id' },
      )
    if (upsertErr) throw upsertErr

    try {
      const actorId = req.headers['x-actor-id'] || null
      const actorEmail = req.headers['x-actor-email'] || null
      await admin.from('audit_logs').insert({
        action: 'user:create',
        actor_id: actorId,
        actor_email: actorEmail,
        target_id: user.id,
        target_email: user.email,
        details: { role },
      })
    } catch (logErr) {
      console.warn('audit log failed', logErr)
    }

    return res.status(200).json({ id: user.id, email: user.email, role })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message || 'internal error' })
  }
}
