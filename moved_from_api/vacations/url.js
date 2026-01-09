import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
  if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE')
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } })
}

export default async function handler(req, res) {
  try {
    const vacationId = req.method === 'GET' ? req.query.vacationId : (req.body?.vacationId)
    if (!vacationId) return res.status(400).json({ error: 'vacationId é obrigatório' })
    const admin = getAdminClient()
    const bucket = admin.storage.from('ferias')
    const path = `${vacationId}.pdf`
    const { data, error } = await bucket.createSignedUrl(path, 3600)
    if (error) return res.json({ url: null })
    return res.json({ url: data?.signedUrl || null })
  } catch (e) {
    console.error('vacations/url error', e)
    return res.status(500).json({ error: e.message || 'erro' })
  }
}
