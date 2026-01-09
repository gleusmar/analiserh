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
    const { sheetId, collaborator_id } = body || {}
    if (!sheetId || !collaborator_id) return res.status(400).json({ error: 'sheetId e collaborator_id são obrigatórios' })

    const admin = getAdminClient()
    const bucket = admin.storage.from('holerites')
    const path = `${sheetId}/${collaborator_id}.pdf`
    const { error } = await bucket.remove([path])
    if (error) throw error

    try {
      const actorId = req.headers['x-actor-id'] || null
      const actorEmail = req.headers['x-actor-email'] || null
      await admin.from('audit_logs').insert({
        action: 'holerite:remove',
        actor_id: actorId,
        actor_email: actorEmail,
        target_id: collaborator_id,
        details: { sheet_id: sheetId, collaborator_id },
      })
    } catch (logErr) { console.warn('audit log failed', logErr) }

    return res.json({ ok: true })
  } catch (e) {
    console.error('remove error', e)
    return res.status(500).json({ error: e.message || 'falha ao remover holerite' })
  }
}
