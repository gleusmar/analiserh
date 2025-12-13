import { supabase } from './supabase'

export async function ensureProfile(user) {
  if (!user) return
  const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (existing) return existing
  const payload = { id: user.id, email: user.email, role: 'user' }
  await supabase.from('profiles').insert(payload)
}

export async function clearMustChangePassword() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')
  const { data, error } = await supabase
    .from('profiles')
    .update({ must_change_password: false })
    .eq('id', user.id)
    .select('id, must_change_password')
    .single()
  if (error) throw error
  return data
}

// Collaborators CRUD
export async function listCollaboratorsPaged({ q = '', page = 1, pageSize = 10, orderBy = 'name', direction = 'asc' } = {}) {
  let query = supabase
    .from('collaborators')
    .select('*', { count: 'exact' })

  if (q) query = query.or(`name.ilike.%${q}%,cpf.ilike.%${q}%,concent_id.ilike.%${q}%`)

  const ascending = direction === 'asc'
  if (orderBy !== 'function' && orderBy !== 'concent_id') {
    query = query.order(orderBy, { ascending })
  }
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

// Storage: Holerites (PDFs)
export async function uploadHolerite(sheetId, collaboratorId, file) {
  const bucket = supabase.storage.from('holerites')
  const path = `${sheetId}/${collaboratorId}.pdf`
  const { error } = await bucket.upload(path, file, { contentType: 'application/pdf', upsert: true })
  if (error) throw error
  return true
}

export async function getHoleriteUrl(sheetId, collaboratorId, expiresInSeconds = 3600) {
  const bucket = supabase.storage.from('holerites')
  const path = `${sheetId}/${collaboratorId}.pdf`
  const { data, error } = await bucket.createSignedUrl(path, expiresInSeconds)
  if (error) return null
  return data?.signedUrl || null
}

// Shift (Plantões) helpers
export async function listShiftFunctions() {
  const { data, error } = await supabase
    .from('shift_functions')
    .select('id, name, base_value, sort_order, created_at')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createShiftFunction(payload) {
  const { data, error } = await supabase
    .from('shift_functions')
    .insert({ name: payload.name, base_value: payload.base_value || 0, sort_order: payload.sort_order ?? null })
    .select('id, name, base_value, sort_order, created_at')
    .single()
  if (error) throw error
  return data
}

// Payroll: entry types (lançamentos)
export async function listPayrollEntryTypes() {
  const { data, error } = await supabase
    .from('payroll_entry_types')
    .select('id, name, kind, created_at')
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createPayrollEntryType(payload) {
  const { data, error } = await supabase
    .from('payroll_entry_types')
    .insert({ name: payload.name, kind: payload.kind })
    .select('id, name, kind, created_at')
    .single()
  if (error) throw error
  return data
}

export async function updatePayrollEntryType(id, payload) {
  const { data, error } = await supabase
    .from('payroll_entry_types')
    .update({ name: payload.name, kind: payload.kind })
    .eq('id', id)
    .select('id, name, kind, created_at')
    .single()
  if (error) throw error
  return data
}

export async function deletePayrollEntryType(id) {
  const { error } = await supabase.from('payroll_entry_types').delete().eq('id', id)
  if (error) throw error
  return true
}

// Payroll: sheets & items & entries
export async function listPayrollSheets(yearMonth) {
  let q = supabase.from('payroll_sheets').select('id, name, year_month, created_at, closed_at').order('created_at', { ascending: false })
  if (yearMonth) q = q.eq('year_month', yearMonth)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function createPayrollSheet(name, yearMonth, collaboratorIds = []) {
  const { data: sheet, error } = await supabase
    .from('payroll_sheets')
    .insert({ name, year_month: yearMonth })
    .select('id, name, year_month, closed_at')
    .single()
  if (error) throw error
  if (collaboratorIds.length) {
    const items = collaboratorIds.map(cid => ({ sheet_id: sheet.id, collaborator_id: cid }))
    const { error: e2 } = await supabase.from('payroll_sheet_items').insert(items)
    if (e2) throw e2
  }
  try { await logAudit('sheet:create', { target_id: sheet.id, details: { name, year_month: yearMonth, collaborator_ids: collaboratorIds } }) } catch (_) {}
  return sheet
}

export async function listPayrollSheetItems(sheetId) {
  const { data, error } = await supabase
    .from('payroll_sheet_items')
    .select('id, sheet_id, collaborator_id, collaborators(name, concent_id, bank_code)')
    .eq('sheet_id', sheetId)
    .order('id', { ascending: true })
  if (error) throw error
  return data || []
}

export async function addPayrollSheetItems(sheetId, collaboratorIds = []) {
  if (!sheetId || !Array.isArray(collaboratorIds) || collaboratorIds.length === 0) return []
  const items = collaboratorIds.map(cid => ({ sheet_id: sheetId, collaborator_id: cid }))
  const { data, error } = await supabase
    .from('payroll_sheet_items')
    .insert(items)
    .select('id, sheet_id, collaborator_id')
  if (error) throw error
  try { await logAudit('sheet:items:add', { target_id: sheetId, details: { collaborator_ids: collaboratorIds } }) } catch (_) {}
  return data || []
}

export async function listPayrollEntriesForSheet(sheetId) {
  const { data, error } = await supabase
    .from('payroll_entries')
    .select('id, sheet_item_id, entry_type_id, amount, note, payroll_entry_types(name, kind), payroll_sheet_items!inner(sheet_id)')
    .eq('payroll_sheet_items.sheet_id', sheetId)
  if (error) throw error
  return data || []
}

export async function listPayrollEntriesForItem(sheetItemId) {
  const { data, error } = await supabase
    .from('payroll_entries')
    .select('id, sheet_item_id, entry_type_id, amount, note, payroll_entry_types(name, kind)')
    .eq('sheet_item_id', sheetItemId)
    .order('id', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createPayrollEntry(sheetItemId, entryTypeId, amount, note) {
  const { data, error } = await supabase
    .from('payroll_entries')
    .insert({ sheet_item_id: sheetItemId, entry_type_id: entryTypeId, amount, note })
    .select('id, sheet_item_id, entry_type_id, amount, note, payroll_entry_types(name, kind)')
    .single()
  if (error) throw error
  try { await logAudit('entry:create', { target_id: data.id, details: { sheet_item_id: sheetItemId, entry_type_id: entryTypeId, amount, note } }) } catch (_) {}
  return data
}

export async function updatePayrollEntry(id, patch) {
  const { data, error } = await supabase
    .from('payroll_entries')
    .update(patch)
    .eq('id', id)
    .select('id, sheet_item_id, entry_type_id, amount, note')
    .single()
  if (error) throw error
  try { await logAudit('entry:update', { target_id: id, details: { patch } }) } catch (_) {}
  return data
}

export async function deletePayrollEntry(id) {
  const { error } = await supabase.from('payroll_entries').delete().eq('id', id)
  if (error) throw error
  try { await logAudit('entry:delete', { target_id: id }) } catch (_) {}
  return true
}

// Payroll: manage sheets and consolidated 'Plantões' entries
export async function updatePayrollSheet(id, patch) {
  const { data, error } = await supabase
    .from('payroll_sheets')
    .update(patch)
    .eq('id', id)
    .select('id, name, year_month, created_at, closed_at')
    .single()
  if (error) throw error
  try { await logAudit('sheet:update', { target_id: id, details: { patch } }) } catch (_) {}
  return data
}

export async function deletePayrollSheet(id) {
  const { error } = await supabase.from('payroll_sheets').delete().eq('id', id)
  if (error) throw error
  try { await logAudit('sheet:delete', { target_id: id }) } catch (_) {}
  return true
}

export async function getOrCreateEntryType(name, kind = 'in') {
  // Try fetch by unique name
  const { data: existing, error: selErr } = await supabase
    .from('payroll_entry_types')
    .select('id, name, kind')
    .eq('name', name)
    .maybeSingle()
  if (selErr) throw selErr
  if (existing) {
    if (existing.kind !== kind) {
      const { data, error } = await supabase
        .from('payroll_entry_types')
        .update({ kind })
        .eq('id', existing.id)
        .select('id, name, kind')
        .single()
      if (error) throw error
      return data
    }
    return existing
  }
  const { data, error } = await supabase
    .from('payroll_entry_types')
    .insert({ name, kind })
    .select('id, name, kind')
    .single()
  if (error) throw error
  return data
}

export async function upsertPlantaoEntry(sheet_item_id, amount) {
  // Ensure the consolidated entry type exists as 'in'
  const t = await getOrCreateEntryType('Plantões', 'in')
  // Remove previous consolidated entries for this item
  const { error: delErr } = await supabase
    .from('payroll_entries')
    .delete()
    .eq('sheet_item_id', sheet_item_id)
    .eq('entry_type_id', t.id)
  if (delErr) throw delErr
  // Insert the new consolidated value
  const { data, error } = await supabase
    .from('payroll_entries')
    .insert({ sheet_item_id, entry_type_id: t.id, amount, note: 'Plantões' })
    .select('id, sheet_item_id, entry_type_id, amount, note, payroll_entry_types(name, kind)')
    .single()
  if (error) throw error
  try { await logAudit('plantao:upsert', { target_id: data.id, details: { sheet_item_id, amount } }) } catch (_) {}
  return data
}

export async function updateShiftFunction(id, payload) {
  const { data, error } = await supabase
    .from('shift_functions')
    .update({ name: payload.name, base_value: payload.base_value, sort_order: payload.sort_order })
    .eq('id', id)
    .select('id, name, base_value, sort_order, created_at')
    .single()
  if (error) throw error
  return data
}

export async function updateShiftFunctionOrder(id, sort_order) {
  const { data, error } = await supabase
    .from('shift_functions')
    .update({ sort_order })
    .eq('id', id)
    .select('id, name, base_value, sort_order, created_at')
    .single()
  if (error) throw error
  return data
}

export async function deleteShiftFunction(id) {
  const { error } = await supabase.from('shift_functions').delete().eq('id', id)
  if (error) throw error
  return true
}

export async function updateShiftPositions(dateISO, orderedIds) {
  if (!Array.isArray(orderedIds)) return true
  const updates = orderedIds.map((id, idx) =>
    supabase.from('shift_assignments').update({ position: idx }).eq('id', id)
  )
  const results = await Promise.all(updates)
  const err = results.find(r => r.error)
  if (err && err.error) throw err.error
  try { await logAudit('shift:reorder', { details: { date: dateISO, orderedIds } }) } catch (_) {}
  return true
}

export async function listShiftAssignments(fromISO, toISO) {
  const { data, error } = await supabase
    .from('shift_assignments')
    .select('id, date, shift_function_id, collaborator_id, remunerated, position')
    .gte('date', fromISO)
    .lte('date', toISO)
    .order('date', { ascending: true })
    .order('position', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createShiftAssignment(payload) {
  const { data, error } = await supabase
    .from('shift_assignments')
    .insert({
      date: payload.date,
      shift_function_id: payload.shift_function_id,
      collaborator_id: payload.collaborator_id,
      remunerated: payload.remunerated !== false,
      position: null,
    })
    .select('id, date, shift_function_id, collaborator_id, remunerated')
    .single()
  if (error) throw error
  try { await logAudit('shift:create', { target_id: data.id, details: { ...payload } }) } catch (_) {}
  return data
}

export async function updateShiftAssignment(id, patch) {
  const { data, error } = await supabase
    .from('shift_assignments')
    .update(patch)
    .eq('id', id)
    .select('id, date, shift_function_id, collaborator_id, remunerated')
    .single()
  if (error) throw error
  try { await logAudit('shift:update', { target_id: id, details: { patch } }) } catch (_) {}
  return data
}

export async function deleteShiftAssignment(id) {
  const { error } = await supabase.from('shift_assignments').delete().eq('id', id)
  if (error) throw error
  try { await logAudit('shift:delete', { target_id: id }) } catch (_) {}
  return true
}

// Monthly overrides for shift function values
export async function listShiftRateOverrides(yearMonth) {
  const { data, error } = await supabase
    .from('shift_rate_overrides')
    .select('id, year_month, shift_function_id, value')
    .eq('year_month', yearMonth)
  if (error) throw error
  return data || []
}

export async function upsertShiftRateOverride(yearMonth, shift_function_id, value) {
  const { data, error } = await supabase
    .from('shift_rate_overrides')
    .upsert({ year_month: yearMonth, shift_function_id, value }, { onConflict: 'year_month,shift_function_id' })
    .select('id, year_month, shift_function_id, value')
    .single()
  if (error) throw error
  try { await logAudit('shift:rate:upsert', { target_id: data.id, details: { year_month: yearMonth, shift_function_id, value } }) } catch (_) {}
  return data
}

export async function listCollaboratorsSimple() {
  const { data, error } = await supabase
    .from('collaborators')
    .select('id, name, status, concent_id')
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function listAuditLogsForTarget(targetId, limit = 50) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, actor_email, target_email, details, created_at')
    .eq('target_id', targetId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function createCollaborator(payload) {
  const { data: { user: actor } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('collaborators')
    .insert({ ...payload, created_by: actor?.id || null })
    .select('*')
    .single()
  if (error) throw error
  await logAudit('collaborator:create', { actor_id: actor?.id, actor_email: actor?.email, target_id: data.id, target_email: null, details: { name: data.name, cpf: data.cpf } })
  return data
}

export async function updateCollaborator(id, patch) {
  const { data: { user: actor } } = await supabase.auth.getUser()
  const { data: before, error: selErr } = await supabase
    .from('collaborators')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (selErr) throw selErr
  const { data, error } = await supabase
    .from('collaborators')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  const changed = {}
  Object.keys(patch || {}).forEach((k) => {
    changed[k] = [before ? before[k] : undefined, data ? data[k] : undefined]
  })
  await logAudit('collaborator:update', { actor_id: actor?.id, actor_email: actor?.email, target_id: id, details: { changed } })
  return data
}

export async function deleteCollaborator(id) {
  const { data: { user: actor } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('collaborators')
    .delete()
    .eq('id', id)
  if (error) throw error
  await logAudit('collaborator:delete', { actor_id: actor?.id, actor_email: actor?.email, target_id: id })
  return true
}

// Functions (job roles) CRUD
export async function listFunctions() {
  const { data, error } = await supabase
    .from('functions')
    .select('id, name, created_at')
    .order('name', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createFunction(payload) {
  const { data: { user: actor } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('functions')
    .insert({ name: payload.name, created_by: actor?.id || null })
    .select('id, name, created_at')
    .single()
  if (error) throw error
  await logAudit('function:create', { actor_id: actor?.id, actor_email: actor?.email, target_id: data.id, details: { name: data.name } })
  return data
}

export async function updateFunction(id, payload) {
  const { data: { user: actor } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('functions')
    .update({ name: payload.name })
    .eq('id', id)
    .select('id, name, created_at')
    .single()
  if (error) throw error
  await logAudit('function:update', { actor_id: actor?.id, actor_email: actor?.email, target_id: id, details: { name: data?.name } })
  return data
}

export async function deleteFunction(id) {
  const { data: { user: actor } } = await supabase.auth.getUser()
  const { error } = await supabase.from('functions').delete().eq('id', id)
  if (error) throw error
  await logAudit('function:delete', { actor_id: actor?.id, actor_email: actor?.email, target_id: id })
  return true
}

export async function fetchMyProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role, status, created_at, collaborator_id, must_change_password')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function listProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role, status, created_at, collaborator_id, must_change_password')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function listProfilesPaged({ q = '', role, status, page = 1, pageSize = 10, orderBy = 'created_at', direction = 'asc' } = {}) {
  let query = supabase
    .from('profiles')
    .select('id, email, role, status, created_at, collaborator_id', { count: 'exact' })

  if (q) query = query.ilike('email', `%${q}%`)
  if (role && role !== 'all') query = query.eq('role', role)
  if (status && status !== 'all') query = query.eq('status', status)

  const ascending = direction === 'asc'
  query = query.order(orderBy, { ascending })

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}

export async function updateProfileRole(userId, role) {
  const { data: { user: actor } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select('id, email, role')
    .maybeSingle()
  if (error) throw error
  await logAudit('profile:role:update', {
    target_id: userId,
    target_email: data?.email,
    from: undefined,
    to: role,
    actor_id: actor?.id,
    actor_email: actor?.email,
  })
  return data
}

export async function updateProfileStatus(userId, status) {
  const { data: { user: actor } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', userId)
    .select('id, email, status')
    .maybeSingle()
  if (error) throw error
  await logAudit('profile:status:update', {
    target_id: userId,
    target_email: data?.email,
    to: status,
    actor_id: actor?.id,
    actor_email: actor?.email,
  })
  return data
}

function randomToken(len = 32) {
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function createInvitation(email, role) {
  const token = randomToken(32)
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('invitations')
    .insert({ email, role, token, status: 'pending', invited_by: user?.id || null })
    .select('id, email, role, token, status, created_at')
    .single()
  if (error) throw error
  await logAudit('invite:create', {
    target_email: email,
    to: role,
    actor_id: user?.id,
    actor_email: user?.email,
    token,
  })
  return data
}

export async function listInvitations() {
  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, role, token, status, created_at, accepted_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function revokeInvitation(id) {
  const { data: { user: actor } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', id)
    .select('id, status')
    .single()
  if (error) throw error
  await logAudit('invite:revoke', {
    target_id: id,
    actor_id: actor?.id,
    actor_email: actor?.email,
  })
  return data
}

export async function getInvitationByToken(token) {
  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, role, token, status')
    .eq('token', token)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function markInvitationAccepted(token, userId) {
  const { data, error } = await supabase
    .from('invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString(), accepted_by: userId })
    .eq('token', token)
    .select('id, status, accepted_at')
    .single()
  if (error) throw error
  return data
}

export async function acceptInvitationAndPromote(token, user) {
  const invite = await getInvitationByToken(token)
  if (!invite || invite.status !== 'pending') throw new Error('Convite inválido ou indisponível')
  if (user.email !== invite.email) throw new Error('E-mail do usuário não corresponde ao convite')
  await ensureProfile(user)
  await markInvitationAccepted(token, user.id)
  await logAudit('invite:accept', {
    target_email: user.email,
    to: invite.role,
    token,
  })
  return invite
}

export async function logAudit(action, details = {}) {
  // details may include: actor_id, actor_email, target_id, target_email, from, to, token
  const { data: { user } } = await supabase.auth.getUser()
  const payload = {
    action,
    actor_id: details.actor_id || user?.id || null,
    actor_email: details.actor_email || user?.email || null,
    target_id: details.target_id || null,
    target_email: details.target_email || null,
    details,
  }
  const { error } = await supabase.from('audit_logs').insert(payload)
  if (error) {
    // swallow errors to not block UX, but log to console for dev
    console.warn('audit log error', error)
  }
}

export async function listAuditLogs(limit = 50) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, actor_email, target_email, details, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function listAuditLogsPaged({ q = '', action, page = 1, pageSize = 20 } = {}) {
  let query = supabase
    .from('audit_logs')
    .select('id, action, actor_email, target_email, details, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (action && action !== 'all') query = query.eq('action', action)
  if (q) query = query.or(`actor_email.ilike.%${q}%,target_email.ilike.%${q}%`)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) throw error
  return { data, count }
}
