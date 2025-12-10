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
    const { sheetId, collaborator_id, expiresInSeconds = 3600 } = body || {}
    if (!sheetId || !collaborator_id) return res.status(400).json({ error: 'sheetId e collaborator_id são obrigatórios' })

    const admin = getAdminClient()
    const bucket = admin.storage.from('holerites')
    const path = `${sheetId}/${collaborator_id}.pdf`
    const { data, error } = await bucket.createSignedUrl(path, expiresInSeconds)
    if (error || !data?.signedUrl) return res.status(404).json({ error: 'arquivo não encontrado' })
    return res.json({ url: data.signedUrl })
  } catch (e) {
    console.error('url error', e)
    return res.status(500).json({ error: e.message || 'falha ao gerar URL do holerite' })
  }
}
