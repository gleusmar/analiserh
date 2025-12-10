import { createClient } from '@supabase/supabase-js'
import pdfParse from 'pdf-parse'

function parseBRL(str) {
  if (!str) return 0
  const s = String(str).replace(/\./g, '').replace(/,/g, '.')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}
function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

async function getOrCreateEntryType(admin, name, kind) {
  const { data: existing } = await admin
    .from('payroll_entry_types')
    .select('id, name, kind')
    .eq('name', name)
    .maybeSingle()
  if (existing) {
    if (existing.kind !== kind) {
      const { data } = await admin
        .from('payroll_entry_types')
        .update({ kind })
        .eq('id', existing.id)
        .select('id, name, kind')
        .single()
      return data
    }
    return existing
  }
  const { data } = await admin
    .from('payroll_entry_types')
    .insert({ name, kind })
    .select('id, name, kind')
    .single()
  return data
}

function extractMappedValues(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const tryGetAmount = (line) => {
    const re = /(\d{1,3}(?:\.\d{3})*,\d{2})/g
    let m, last = null
    while ((m = re.exec(line)) !== null) last = m[1]
    return last ? parseBRL(last) : 0
  }
  const out = {
    salario: 0,
    insalubridade: 0,
    inss: 0,
    unimed: 0,
    fgts: 0,
    irrf: 0,
    gratificacao: 0,
    salario_familia: 0,
    quinquenio: 0,
    ferias: 0,
    adicional_ferias_terco: 0,
    antecipacao_ferias: 0,
    inss_ferias: 0,
    plantoes: 0,
    atestado: 0,
  }
  for (const raw of lines) {
    const l = normalizeText(raw)
    if ((l.includes('inss') || l.includes('i.n.s.s')) && l.includes('ferias')) out.inss_ferias = Math.max(out.inss_ferias, tryGetAmount(raw))
    else if (l.includes('quinquenio')) out.quinquenio = Math.max(out.quinquenio, tryGetAmount(raw))
    else if (l.includes('1/3')) out.adicional_ferias_terco = Math.max(out.adicional_ferias_terco, tryGetAmount(raw))
    else if (l.includes('antecipacao de ferias')) out.antecipacao_ferias = Math.max(out.antecipacao_ferias, tryGetAmount(raw))
    else if (l.includes('ferias')) out.ferias = Math.max(out.ferias, tryGetAmount(raw))
    else if (l.includes('gratific')) out.gratificacao = Math.max(out.gratificacao, tryGetAmount(raw))
    else if (l.includes('salario familia')) out.salario_familia = Math.max(out.salario_familia, tryGetAmount(raw))
    else if (l.includes('planto')) out.plantoes = Math.max(out.plantoes, tryGetAmount(raw))
    else if (l.includes('atestado')) out.atestado = Math.max(out.atestado, tryGetAmount(raw))
    else if (l.includes('saldo de salario')) out.salario = Math.max(out.salario, tryGetAmount(raw))
    else if (l.includes('insalubr')) out.insalubridade = Math.max(out.insalubridade, tryGetAmount(raw))
    else if (l.includes('inss') || l.includes('i.n.s.s')) out.inss = Math.max(out.inss, tryGetAmount(raw))
    else if (l.includes('unimed')) out.unimed = Math.max(out.unimed, tryGetAmount(raw))
    else if (l.includes('fgts') || l.includes('f.g.t.s')) out.fgts = Math.max(out.fgts, tryGetAmount(raw))
    else if (l.includes('irrf') || l.includes('i.r.r.f') || l.includes('imposto de renda')) out.irrf = Math.max(out.irrf, tryGetAmount(raw))
  }
  return out
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
    const { sheetId, pages = [], overwrite = true } = body || {}
    if (!sheetId || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'sheetId e pages são obrigatórios' })
    }

    const admin = getAdminClient()

    const tSal = await getOrCreateEntryType(admin, 'Salário', 'in')
    const tIns = await getOrCreateEntryType(admin, 'Insalubridade', 'in')
    const tINSS = await getOrCreateEntryType(admin, 'INSS', 'out')
    const tUni = await getOrCreateEntryType(admin, 'Unimed', 'out')
    const tFGTS = await getOrCreateEntryType(admin, 'FGTS', 'out')
    const tIRRF = await getOrCreateEntryType(admin, 'IRRF', 'out')
    const tGrat = await getOrCreateEntryType(admin, 'Gratificação', 'in')
    const tSalFam = await getOrCreateEntryType(admin, 'Salário Família', 'in')
    const tQuinq = await getOrCreateEntryType(admin, 'Quinquênio', 'in')
    const tFerias = await getOrCreateEntryType(admin, 'Férias', 'in')
    const tTerco = await getOrCreateEntryType(admin, 'Adicional de Férias (1/3)', 'in')
    const tAntFer = await getOrCreateEntryType(admin, 'Antecipação de Férias', 'out')
    const tINSSFer = await getOrCreateEntryType(admin, 'INSS Férias', 'out')
    const tPlant = await getOrCreateEntryType(admin, 'Plantões', 'in')
    const tAtest = await getOrCreateEntryType(admin, 'Atestado', 'in')

    const results = []
    for (const p of pages) {
      const { collaborator_id, data } = p || {}
      if (!collaborator_id || !data) continue
      const buf = Buffer.from(String(data).replace(/^data:.*;base64,/, ''), 'base64')
      const parsed = await pdfParse(buf)
      const vals = extractMappedValues(parsed.text)

      try {
        const bucket = admin.storage.from('holerites')
        const path = `${sheetId}/${collaborator_id}.pdf`
        await bucket.upload(path, buf, { contentType: 'application/pdf', upsert: true })
      } catch (e) {
        console.warn('storage upload failed', e)
      }

      const { data: item } = await admin
        .from('payroll_sheet_items')
        .select('id')
        .eq('sheet_id', sheetId)
        .eq('collaborator_id', collaborator_id)
        .maybeSingle()
      if (!item) { results.push({ collaborator_id, error: 'sheet_item não encontrado' }); continue }

      const ops = [
        { type: tSal, amount: vals.salario, note: 'Holerite' },
        { type: tIns, amount: vals.insalubridade, note: 'Holerite' },
        { type: tINSS, amount: vals.inss, note: 'Holerite' },
        { type: tUni, amount: vals.unimed, note: 'Holerite' },
        { type: tFGTS, amount: vals.fgts, note: 'Holerite' },
        { type: tIRRF, amount: vals.irrf, note: 'Holerite' },
        { type: tGrat, amount: vals.gratificacao, note: 'Holerite' },
        { type: tSalFam, amount: vals.salario_familia, note: 'Holerite' },
        { type: tQuinq, amount: vals.quinquenio, note: 'Holerite' },
        { type: tFerias, amount: vals.ferias, note: 'Holerite' },
        { type: tTerco, amount: vals.adicional_ferias_terco, note: 'Holerite' },
        { type: tAntFer, amount: vals.antecipacao_ferias, note: 'Holerite' },
        { type: tINSSFer, amount: vals.inss_ferias, note: 'Holerite' },
        { type: tPlant, amount: vals.plantoes, note: 'Holerite' },
        { type: tAtest, amount: vals.atestado, note: 'Holerite' },
      ].filter(o => o.amount > 0)

      for (const op of ops) {
        if (overwrite) {
          await admin.from('payroll_entries')
            .delete()
            .eq('sheet_item_id', item.id)
            .eq('entry_type_id', op.type.id)
        }
        await admin
          .from('payroll_entries')
          .insert({ sheet_item_id: item.id, entry_type_id: op.type.id, amount: op.amount, note: op.note })
      }

      results.push({ collaborator_id, counts: ops.length })

      try {
        const actorId = req.headers['x-actor-id'] || null
        const actorEmail = req.headers['x-actor-email'] || null
        await admin.from('audit_logs').insert({
          action: 'holerite:import',
          actor_id: actorId,
          actor_email: actorEmail,
          target_id: item.id,
          details: { sheet_id: sheetId, collaborator_id, entries: ops.map(o => ({ entry_type_id: o.type.id, amount: o.amount })) },
        })
      } catch (logErr) { console.warn('audit log failed', logErr) }
    }

    return res.json({ ok: true, results })
  } catch (e) {
    console.error('import error', e)
    return res.status(500).json({ error: e.message || 'falha ao importar holerites' })
  }
}
