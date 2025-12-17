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
  // Break into lines and attempt to find amounts next to known rubricas via numeric codes
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const tryGetAmount = (line) => {
    // Capture last BRL number like 1.900,00 or 175,55
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
    trienio_3: 0,
    ferias: 0,
    adicional_ferias_terco: 0,
    antecipacao_ferias: 0,
    inss_ferias: 0,
    plantoes: 0,
    atestado: 0,
    emprestimo_consignado: 0,
    diferenca_salario: 0,
    decimo_1: 0,
    decimo_2: 0,
    insal_13: 0,
    grat_13: 0,
    quinq_13: 0,
    plantao_13: 0,
    inss_13: 0,
    irrf_13: 0,
  }
  for (const raw of lines) {
    const amount = tryGetAmount(raw)
    if (!amount) continue
    // Try to get a 2-3 digit code near the line start
    const m = raw.match(/(^|\s)(\d{2,3})(?=\s)/)
    if (!m) continue
    const code = m[2]
    switch (code) {
      case '001': out.salario += amount; break
      case '025': out.insalubridade += amount; break
      case '501': out.inss += amount; break
      case '504': out.irrf += amount; break
      case '549': out.unimed += amount; break
      case '062': out.quinquenio += amount; break
      case '100': out.plantoes += amount; break
      case '104': out.quinquenio += amount; break
      case '002': out.salario_familia += amount; break
      case '038': out.atestado += amount; break
      case '060': out.trienio_3 += amount; break
      case '551': out.emprestimo_consignado += amount; break
      case '028': out.ferias += amount; break
      case '029': out.adicional_ferias_terco += amount; break
      case '503': out.inss_ferias += amount; break
      case '512': out.antecipacao_ferias += amount; break
      case '107': out.diferenca_salario += amount; break
      case '011': out.decimo_1 += amount; break
      case '514': out.decimo_1 += amount; break
      case '012': out.decimo_2 += amount; break
      case '017': out.insal_13 += amount; break
      case '047': out.grat_13 += amount; break
      case '053': out.quinq_13 += amount; break
      case '093': out.quinq_13 += amount; break
      case '094': out.plantao_13 += amount; break
      case '502': out.inss_13 += amount; break
      case '528': out.irrf_13 += amount; break
      default: break
    }
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
    const tTrienio3 = await getOrCreateEntryType(admin, 'Triênio (3%)', 'in')
    const tEmpConsig = await getOrCreateEntryType(admin, 'Empréstimo Consignado', 'out')
    const tDifSal = await getOrCreateEntryType(admin, 'Diferença de Salário', 'in')
    const tIns13 = await getOrCreateEntryType(admin, 'Insalubridade - 13º Salário', 'in')
    const tGrat13 = await getOrCreateEntryType(admin, 'Gratificação - 13º Salário', 'in')
    const tQuinq13 = await getOrCreateEntryType(admin, 'Quinquênio - 13º Salário', 'in')
    const tPlant13 = await getOrCreateEntryType(admin, 'Plantões - 13º Salário', 'in')
    const tINSS13 = await getOrCreateEntryType(admin, 'INSS - 13º Salário', 'out')
    const tIRRF13 = await getOrCreateEntryType(admin, 'IRRF - 13º Salário', 'out')
    const t13p1 = await getOrCreateEntryType(admin, '13º Salário - 1ª Parcela', 'in')
    const t13p2 = await getOrCreateEntryType(admin, '13º Salário - 2ª Parcela', 'in')

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
        { type: tTrienio3, amount: vals.trienio_3, note: 'Holerite' },
        { type: tFerias, amount: vals.ferias, note: 'Holerite' },
        { type: tTerco, amount: vals.adicional_ferias_terco, note: 'Holerite' },
        { type: tAntFer, amount: vals.antecipacao_ferias, note: 'Holerite' },
        { type: tINSSFer, amount: vals.inss_ferias, note: 'Holerite' },
        { type: tPlant, amount: vals.plantoes, note: 'Holerite' },
        { type: tAtest, amount: vals.atestado, note: 'Holerite' },
        { type: tEmpConsig, amount: vals.emprestimo_consignado, note: 'Holerite' },
        { type: tDifSal, amount: vals.diferenca_salario, note: 'Holerite' },
        { type: t13p1, amount: vals.decimo_1, note: 'Holerite' },
        { type: t13p2, amount: vals.decimo_2, note: 'Holerite' },
        { type: tIns13, amount: vals.insal_13, note: 'Holerite' },
        { type: tGrat13, amount: vals.grat_13, note: 'Holerite' },
        { type: tQuinq13, amount: vals.quinq_13, note: 'Holerite' },
        { type: tPlant13, amount: vals.plantao_13, note: 'Holerite' },
        { type: tINSS13, amount: vals.inss_13, note: 'Holerite' },
        { type: tIRRF13, amount: vals.irrf_13, note: 'Holerite' },
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
