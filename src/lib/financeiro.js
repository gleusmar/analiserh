import { supabase } from './supabase'

// ---------------------------------------------------------
// Bancos
// ---------------------------------------------------------

export async function listFinBanks() {
  const { data, error } = await supabase
    .from('fin_banks')
    .select('id, name, logo_url, agency, account, active, created_at')
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function getFinBank(id) {
  const { data, error } = await supabase
    .from('fin_banks')
    .select('id, name, logo_url, agency, account, active, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createFinBank(payload) {
  const { data, error } = await supabase
    .from('fin_banks')
    .insert({ name: payload.name, logo_url: payload.logo_url || null, agency: payload.agency || null, account: payload.account || null })
    .select('id, name, logo_url, agency, account, active')
    .single()
  if (error) throw error
  return data
}

export async function updateFinBank(id, patch) {
  const { data, error } = await supabase
    .from('fin_banks')
    .update(patch)
    .eq('id', id)
    .select('id, name, logo_url, agency, account, active')
    .single()
  if (error) throw error
  return data
}

export async function finBankHasEntries(bankId) {
  const [ext, int_] = await Promise.all([
    supabase.from('fin_statement_entries').select('id', { count: 'exact', head: true }).eq('bank_id', bankId),
    supabase.from('fin_internal_entries').select('id', { count: 'exact', head: true }).eq('bank_id', bankId),
  ])
  if (ext.error) throw ext.error
  if (int_.error) throw int_.error
  return (ext.count || 0) > 0 || (int_.count || 0) > 0
}

export async function deleteFinBank(bankId) {
  if (await finBankHasEntries(bankId)) {
    throw new Error('Este banco possui lançamentos importados e não pode ser excluído. Inative-o.')
  }
  const { error } = await supabase.from('fin_banks').delete().eq('id', bankId)
  if (error) throw error
  return true
}

export async function uploadFinBankLogo(bankId, file) {
  const ext = (file.name?.split('.').pop() || 'png').toLowerCase()
  const path = `${bankId}.${ext}`
  const bucket = supabase.storage.from('fin-logos')
  const { error } = await bucket.upload(path, file, { upsert: true, contentType: file.type || 'image/png' })
  if (error) throw error
  const { data } = bucket.getPublicUrl(path)
  return data?.publicUrl || null
}

// ---------------------------------------------------------
// Esquemas de importação
// ---------------------------------------------------------

export async function listFinSchemes() {
  const { data, error } = await supabase
    .from('fin_import_schemes')
    .select('id, bank_id, name, config, created_at')
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createFinScheme(payload) {
  const { data, error } = await supabase
    .from('fin_import_schemes')
    .insert({ name: payload.name, bank_id: payload.bank_id || null, config: payload.config || {} })
    .select('id, bank_id, name, config')
    .single()
  if (error) throw error
  return data
}

export async function updateFinScheme(id, patch) {
  const { data, error } = await supabase
    .from('fin_import_schemes')
    .update(patch)
    .eq('id', id)
    .select('id, bank_id, name, config')
    .single()
  if (error) throw error
  return data
}

export async function deleteFinScheme(id) {
  const { error } = await supabase.from('fin_import_schemes').delete().eq('id', id)
  if (error) throw error
  return true
}

// ---------------------------------------------------------
// Extrato (lançamentos externos)
// ---------------------------------------------------------

const ENTRY_COLS = 'id, bank_id, import_id, occurred_at, movimentacao, tipo, amount_cents, balance_before_cents, balance_after_cents, fee_cents, situacao, counterpart, counterpart_doc, counterpart_institution, nosso_numero, status, reconciliation_id'

export async function listStatementEntries(bankId) {
  const all = []
  const step = 1000
  for (let from = 0; ; from += step) {
    const { data, error } = await supabase
      .from('fin_statement_entries')
      .select(ENTRY_COLS)
      .eq('bank_id', bankId)
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + step - 1)
    if (error) throw error
    all.push(...(data || []))
    if (!data || data.length < step) break
  }
  return all
}

// Insere ignorando duplicados pela fingerprint. Retorna { inserted }
export async function insertStatementEntries(entries, { bankId, importId }) {
  const rows = entries.map((e) => ({ ...e, bank_id: bankId, import_id: importId }))
  let inserted = 0
  const chunk = 500
  for (let i = 0; i < rows.length; i += chunk) {
    const { data, error } = await supabase
      .from('fin_statement_entries')
      .upsert(rows.slice(i, i + chunk), { onConflict: 'bank_id,fingerprint', ignoreDuplicates: true })
      .select('id')
    if (error) throw error
    inserted += (data || []).length
  }
  return { inserted }
}

export async function createStatementImport({ bank_id, scheme_id, filename, total_rows, inserted_rows, skipped_rows }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('fin_statement_imports')
    .insert({ bank_id, scheme_id, filename, total_rows, inserted_rows, skipped_rows, imported_by: user?.id || null })
    .select('id')
    .single()
  if (error) throw error
  return data
}

export async function updateStatementImport(id, patch) {
  const { error } = await supabase
    .from('fin_statement_imports')
    .update(patch)
    .eq('id', id)
  if (error) throw error
  return true
}

export async function setStatementEntryStatus(id, status) {
  const { error } = await supabase
    .from('fin_statement_entries')
    .update({ status })
    .eq('id', id)
    .eq('status', 'unmatched')
  if (error) throw error
  return true
}

// ---------------------------------------------------------
// Lançamentos internos
// ---------------------------------------------------------

export async function listInternalEntries(bankId) {
  const { data, error } = await supabase
    .from('fin_internal_entries')
    .select('id, bank_id, entry_date, description, amount_cents, status, reconciliation_id, note, created_at')
    .eq('bank_id', bankId)
    .order('entry_date', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createInternalEntry({ bank_id, entry_date, description, amount_cents, note }) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('fin_internal_entries')
    .insert({ bank_id, entry_date, description, amount_cents, note: note || null, created_by: user?.id || null })
    .select('id, bank_id, entry_date, description, amount_cents, status, note, created_at')
    .single()
  if (error) throw error
  return data
}

export async function deleteInternalEntry(id) {
  const { error } = await supabase
    .from('fin_internal_entries')
    .delete()
    .eq('id', id)
    .eq('status', 'unmatched')
  if (error) throw error
  return true
}

// ---------------------------------------------------------
// Conciliação (RPCs atômicas)
// ---------------------------------------------------------

export async function reconcileEntries(bankId, internalIds, externalIds, reason = null) {
  const { data, error } = await supabase.rpc('fin_reconcile', {
    p_bank_id: bankId,
    p_internal_ids: internalIds,
    p_external_ids: externalIds,
    p_reason: reason,
  })
  if (error) throw error
  return data
}

export async function undoReconciliation(logId) {
  const { data, error } = await supabase.rpc('fin_undo_reconciliation', { p_log_id: logId })
  if (error) throw error
  return data
}

export async function listReconciliationLogs(bankId) {
  const { data, error } = await supabase
    .from('reconciliation_logs')
    .select('id, bank_id, user_id, user_email, internal_ids, external_ids, internal_total_cents, external_total_cents, discrepancy_cents, discrepancy_reason, status, undone_at, created_at')
    .eq('bank_id', bankId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
