import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE
  if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE')
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { autoRefreshToken: false, persistSession: false } })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const { vacationId, fileData, contentType } = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(req.body || '{}')
    if (!vacationId || !fileData) return res.status(400).json({ error: 'vacationId e fileData são obrigatórios' })
    const base64 = String(fileData).replace(/^data:.*;base64,/, '')
    const buf = Buffer.from(base64, 'base64')
    const admin = getAdminClient()
    const bucket = admin.storage.from('ferias')
    const path = `${vacationId}.pdf`
    const { error } = await bucket.upload(path, buf, { contentType: contentType || 'application/pdf', upsert: true })
    if (error) throw error
    return res.json({ ok: true })
  } catch (e) {
    console.error('vacations/upload error', e)
    return res.status(500).json({ error: e.message || 'erro' })
  }
}
