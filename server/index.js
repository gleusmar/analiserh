import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import pdfParse from 'pdf-parse'

dotenv.config()

const app = express()
app.use(cors({ origin: [/^http:\/\/localhost:\d+$/], credentials: false }))
app.use(express.json({ limit: '25mb' }))
app.use(express.urlencoded({ extended: true, limit: '25mb' }))

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE in environment')
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Auto-map pages to collaborators on a sheet using text matching
// Body: { sheetId, pages: [{ data: base64 }] }
app.post('/api/holerites/auto-map', async (req, res) => {
  try {
    const { sheetId, pages = [] } = req.body || {}
    if (!sheetId || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'sheetId e pages são obrigatórios' })
    }
    // Load collaborators for the sheet
    const { data: items, error } = await admin
      .from('payroll_sheet_items')
      .select('collaborator_id, collaborators(name, concent_id)')
      .eq('sheet_id', sheetId)
    if (error) throw error
    const cols = (items || []).map(it => ({ id: it.collaborator_id, name: it.collaborators?.name || '', concent_id: it.collaborators?.concent_id || '' }))
    const norm = (s) => normalize(s).replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim()
    const onlyDigits = (s) => String(s||'').replace(/\D/g,'')
    const colsNorm = cols.map(c => ({ ...c, key: norm(c.name), idKey: onlyDigits(c.concent_id) }))
    const out = []
    for (const pg of pages) {
      const buf = Buffer.from(String(pg.data||'').replace(/^data:.*;base64,/, ''), 'base64')
      const parsed = await pdfParse(buf)
      const txt = norm(parsed.text)
      let match = null
      for (const c of colsNorm) {
        if (c.key && txt.includes(c.key)) { match = c; break }
        if (c.idKey && c.idKey.length >= 3 && txt.includes(c.idKey)) { match = c; break }
      }
      out.push({ collaborator_id: match ? match.id : null, matched_name: match ? match.name : null, matched_id: match ? match.concent_id : null })
    }
    res.json({ ok: true, mappings: out })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message || 'falha no auto-map' })
  }
})

// Remove holerite file of a collaborator for a sheet
// Body: { sheetId, collaborator_id }
app.post('/api/holerites/remove', async (req, res) => {
  try {
    const { sheetId, collaborator_id } = req.body || {}
    if (!sheetId || !collaborator_id) return res.status(400).json({ error: 'sheetId e collaborator_id são obrigatórios' })
    const bucket = admin.storage.from('holerites')
    const path = `${sheetId}/${collaborator_id}.pdf`
    const { error } = await bucket.remove([path])
    if (error) throw error
    // audit
    try {
      const actorId = req.header('x-actor-id') || null
      const actorEmail = req.header('x-actor-email') || null
      await admin.from('audit_logs').insert({
        action: 'holerite:remove',
        actor_id: actorId,
        actor_email: actorEmail,
        target_id: collaborator_id,
        details: { sheet_id: sheetId, collaborator_id },
      })
    } catch (logErr) { console.warn('audit log failed', logErr) }
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message || 'falha ao remover holerite' })
  }
})

// Cleanup all holerites for a sheet
// Body: { sheetId }
app.post('/api/holerites/cleanup', async (req, res) => {
  try {
    const { sheetId } = req.body || {}
    if (!sheetId) return res.status(400).json({ error: 'sheetId é obrigatório' })
    const bucket = admin.storage.from('holerites')
    const paths = []
    let page = 0
    const limit = 100
    while (true) {
      const { data, error } = await bucket.list(`${sheetId}`, { limit, offset: page * limit })
      if (error) throw error
      if (!data || data.length === 0) break
      data.forEach(f => paths.push(`${sheetId}/${f.name}`))
      if (data.length < limit) break
      page++
    }
    if (paths.length) {
      const { error: remErr } = await bucket.remove(paths)
      if (remErr) throw remErr
    }
    // audit
    try {
      const actorId = req.header('x-actor-id') || null
      const actorEmail = req.header('x-actor-email') || null
      await admin.from('audit_logs').insert({
        action: 'holerite:cleanup',
        actor_id: actorId,
        actor_email: actorEmail,
        details: { sheet_id: sheetId, removed: paths.length },
      })
    } catch (logErr) { console.warn('audit log failed', logErr) }
    res.json({ ok: true, removed: paths.length })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message || 'falha ao limpar holerites' })
  }
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// Generate signed URL for a holerite file (service role, bypasses RLS)
// Body: { sheetId, collaborator_id, expiresInSeconds? }
app.post('/api/holerites/url', async (req, res) => {
  try {
    const { sheetId, collaborator_id, expiresInSeconds = 3600 } = req.body || {}
    if (!sheetId || !collaborator_id) return res.status(400).json({ error: 'sheetId e collaborator_id são obrigatórios' })
    const bucket = admin.storage.from('holerites')
    const path = `${sheetId}/${collaborator_id}.pdf`
    const { data, error } = await bucket.createSignedUrl(path, expiresInSeconds)
    if (error || !data?.signedUrl) return res.status(404).json({ error: 'arquivo não encontrado' })
    res.json({ url: data.signedUrl })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message || 'falha ao gerar URL do holerite' })
  }
})

// Link a profile to a collaborator (service role). Body: { profile_id, collaborator_id|null }
app.post('/api/admin/profiles/link-collaborator', async (req, res) => {
  try {
    const { profile_id, collaborator_id = null } = req.body || {}
    if (!profile_id) return res.status(400).json({ error: 'profile_id é obrigatório' })

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
      const actorId = req.header('x-actor-id') || null
      const actorEmail = req.header('x-actor-email') || null
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

    res.json({ ok: true, id: data.id, collaborator_id: data.collaborator_id })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message || 'falha ao vincular colaborador ao perfil' })
  }
})

// Update profile email (admin only; service role bypasses RLS)
app.post('/api/admin/profiles/update-email', async (req, res) => {
  try {
    const { profile_id, email } = req.body || {}
    if (!profile_id || !email) {
      return res.status(400).json({ error: 'profile_id e email são obrigatórios' })
    }

    const { data: before, error: selErr } = await admin
      .from('profiles')
      .select('id, email')
      .eq('id', profile_id)
      .maybeSingle()
    if (selErr) throw selErr
    if (!before) return res.status(404).json({ error: 'perfil não encontrado' })

    const { error: updErr } = await admin.auth.admin.updateUserById(profile_id, { email, email_confirm: true })
    if (updErr) throw updErr

    const { data, error: profErr } = await admin
      .from('profiles')
      .update({ email })
      .eq('id', profile_id)
      .select('id, email')
      .single()
    if (profErr) throw profErr

    try {
      const actorId = req.header('x-actor-id') || null
      const actorEmail = req.header('x-actor-email') || null
      await admin.from('audit_logs').insert({
        action: 'profile:email:update',
        actor_id: actorId,
        actor_email: actorEmail,
        target_id: data.id,
        target_email: data.email,
        details: { from: before?.email || null, to: data?.email || null },
      })
    } catch (logErr) {
      console.warn('audit log failed', logErr)
    }

    res.json({ ok: true, id: data.id, email: data.email })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message || 'falha ao atualizar e-mail do perfil' })
  }
})

// Create user (admin only; for now we trust local dev). In production, add auth/checks.
app.post('/api/admin/users', async (req, res) => {
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

    // Ensure profile with desired role & status; force first password change
    const { error: upsertErr } = await admin
      .from('profiles')
      .upsert({ id: user.id, email: user.email, role, status: 'active', must_change_password: true }, { onConflict: 'id' })
    if (upsertErr) throw upsertErr

    // Audit log: user:create
    try {
      const actorId = req.header('x-actor-id') || null
      const actorEmail = req.header('x-actor-email') || null
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

    res.json({ id: user.id, email: user.email, role })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message || 'internal error' })
  }
})

// Helpers
function parseBRL(str) {
  if (!str) return 0
  const s = String(str).replace(/\./g, '').replace(/,/g, '.')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}
function normalize(s) {
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
  // Break into lines and attempt to find amounts next to known rubricas
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
    decimo_1_in: 0,
    decimo_1_out: 0,
    decimo_2: 0,
    insal_13: 0,
    grat_13: 0,
    quinq_13: 0,
    plantao_13: 0,
    inss_13: 0,
    irrf_13: 0,
  }
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const n = normalize(raw)
    if (/total\s+liquido/.test(n)) break
    let amount = tryGetAmount(raw)
    // Capture the first 3 digits at line start (or after space). Some lines like '5141ª PARCELA' have a digit after the code.
    let m = raw.match(/(?:^|\s)(\d{3})/)
    if (!m) continue
    // If this code line has no amount, scan subsequent continuation lines (no leading code) until next section or 'TOTAL LÍQUIDO'
    if (!amount) {
      for (let j = i + 1; j < lines.length; j++) {
        const ln = lines[j]
        const nn = normalize(ln)
        if (/total\s+liquido/.test(nn)) break
        if (/^\s*\d{3}/.test(ln)) break
        const a2 = tryGetAmount(ln)
        if (a2) { amount = a2; break }
      }
    }
    if (!amount) continue
    const c = String(m[1] || '').trim()
    switch (c) {
      case '001': out.salario += amount; break
      case '025': out.insalubridade += amount; break
      case '501': out.inss += amount; break
      case '504': out.irrf += amount; break
      case '549': out.unimed += amount; break
      case '062': out.quinquenio += amount; break
      case '100': out.plantoes += amount; break
      case '104': out.quinquenio += amount; break
      case '110': out.gratificacao += amount; break
      case '002': out.salario_familia += amount; break
      case '038': out.atestado += amount; break
      case '060': out.trienio_3 += amount; break
      case '551': out.emprestimo_consignado += amount; break
      case '028': out.ferias += amount; break
      case '029': out.adicional_ferias_terco += amount; break
      case '503': out.inss_ferias += amount; break
      case '512': out.antecipacao_ferias += amount; break
      case '107': out.diferenca_salario += amount; break
      case '011': out.decimo_1_in += amount; break
      case '514': out.decimo_1_out += amount; break
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

// Import holerite pages: { sheetId, pages: [{ collaborator_id, data: base64 }], overwrite }
app.post('/api/holerites/import', async (req, res) => {
  try {
    const { sheetId, pages = [], overwrite = true } = req.body || {}
    if (!sheetId || !Array.isArray(pages) || pages.length === 0) {
      return res.status(400).json({ error: 'sheetId e pages são obrigatórios' })
    }

    // Ensure entry types
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
    const t13p1Out = await getOrCreateEntryType(admin, '1ª Parcela - 13º Salário', 'out')
    const t13p2 = await getOrCreateEntryType(admin, '13º Salário', 'in')

    const results = []
    for (const p of pages) {
      const { collaborator_id, data } = p || {}
      if (!collaborator_id || !data) continue
      const buf = Buffer.from(String(data).replace(/^data:.*;base64,/, ''), 'base64')
      const parsed = await pdfParse(buf)
      const vals = extractMappedValues(parsed.text)

      // Upload holerite PDF to storage (service role bypasses RLS)
      try {
        const bucket = admin.storage.from('holerites')
        const path = `${sheetId}/${collaborator_id}.pdf`
        await bucket.upload(path, buf, { contentType: 'application/pdf', upsert: true })
      } catch (e) {
        // proceed even if upload fails, but record error
        console.warn('storage upload failed', e)
      }

      // Find sheet_item_id
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
        { type: t13p1, amount: vals.decimo_1_in, note: 'Holerite' },
        { type: t13p1Out, amount: vals.decimo_1_out, note: 'Holerite' },
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
      // audit per collaborator imported
      try {
        const actorId = req.header('x-actor-id') || null
        const actorEmail = req.header('x-actor-email') || null
        await admin.from('audit_logs').insert({
          action: 'holerite:import',
          actor_id: actorId,
          actor_email: actorEmail,
          target_id: item.id,
          details: { sheet_id: sheetId, collaborator_id, entries: ops.map(o => ({ entry_type_id: o.type.id, amount: o.amount })) },
        })
      } catch (logErr) { console.warn('audit log failed', logErr) }
    }
    res.json({ ok: true, results })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message || 'falha ao importar holerites' })
  }
})

const port = Number(process.env.PORT || 3001)
app.listen(port, () => {
  console.log(`Admin API listening on http://localhost:${port}`)
})
