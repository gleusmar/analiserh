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
    const { profile_id, collaborator_id = null } = body || {}

    if (!profile_id) {
      return res.status(400).json({ error: 'profile_id é obrigatório' })
    }

    const admin = getAdminClient()

    const { data: before, error: selErr } = await admin
      .from('profiles')
      .select('id, email, collaborator_id')
      .eq('id', profile_id)
      .maybeSingle()
    if (selErr) throw selErr
    if (!before) return res.status(404).json({ error: 'perfil não encontrado' })

    const { data, error } = await admin
      .from('profiles')
      .update({ collaborator_id: collaborator_id || null })
      .eq('id', profile_id)
      .select('id, email, collaborator_id')
      .single()
    if (error) throw error

    try {
      const actorId = req.headers['x-actor-id'] || null
      const actorEmail = req.headers['x-actor-email'] || null
      await admin.from('audit_logs').insert({
        action: 'profile:collaborator:link',
        actor_id: actorId,
        actor_email: actorEmail,
        target_id: data.id,
        target_email: data.email,
        details: { from: before?.collaborator_id || null, to: data?.collaborator_id || null },
      })
    } catch (logErr) {
      console.warn('audit log failed', logErr)
    }

    return res.status(200).json({ ok: true, id: data.id, collaborator_id: data.collaborator_id })
  } catch (e) {
    console.error('link-collaborator error', e)
    return res.status(500).json({ error: e.message || 'falha ao vincular colaborador ao perfil' })
  }
}
