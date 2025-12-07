import { supabase } from './supabase'

export async function ensureProfile(user) {
  if (!user) return
  const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
  if (existing) return existing
  const payload = { id: user.id, email: user.email, role: 'user' }
  await supabase.from('profiles').insert(payload)
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
    .select('id, email, role, status, created_at')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function listProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role, status, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function listProfilesPaged({ q = '', role, status, page = 1, pageSize = 10, orderBy = 'created_at', direction = 'asc' } = {}) {
  let query = supabase
    .from('profiles')
    .select('id, email, role, status, created_at', { count: 'exact' })

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
