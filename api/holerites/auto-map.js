import { createClient } from '@supabase/supabase-js'
import pdfParse from 'pdf-parse'

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function norm(s) {
  return normalizeText(s).replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function onlyDigits(s) {
  return String(s || '').replace(/\D/g, '')
}

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
    const { sheetId, pages = [] } = body || {}
    if (!sheetId || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'sheetId e pages são obrigatórios' })
    }

    const admin = getAdminClient()

    const { data: items, error } = await admin
      .from('payroll_sheet_items')
      .select('collaborator_id, collaborators(name, concent_id)')
      .eq('sheet_id', sheetId)
    if (error) throw error

    const cols = (items || []).map(it => ({ id: it.collaborator_id, name: it.collaborators?.name || '', concent_id: it.collaborators?.concent_id || '' }))
    const colsNorm = cols.map(c => ({ ...c, key: norm(c.name), idKey: onlyDigits(c.concent_id) }))

    const out = []
    for (const pg of pages) {
      const buf = Buffer.from(String(pg.data || '').replace(/^data:.*;base64,/, ''), 'base64')
      const parsed = await pdfParse(buf)
      const txt = norm(parsed.text)
      let match = null
      for (const c of colsNorm) {
        if (c.key && txt.includes(c.key)) { match = c; break }
        if (c.idKey && c.idKey.length >= 3 && txt.includes(c.idKey)) { match = c; break }
      }
      out.push({ collaborator_id: match ? match.id : null, matched_name: match ? match.name : null, matched_id: match ? match.concent_id : null })
    }

    return res.json({ ok: true, mappings: out })
  } catch (e) {
    console.error('auto-map error', e)
    return res.status(500).json({ error: e.message || 'falha no auto-map' })
  }
}
