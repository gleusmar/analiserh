const ADMIN_API_BASE = (import.meta.env.VITE_ADMIN_API_URL || '/api').replace(/\/$/, '')

function adminUrl(path) {
  return `${ADMIN_API_BASE}${path}`
}

export async function createUser({ email, password, role = 'user' }, actor) {
  try {
    const res = await fetch(adminUrl('/admin/users'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(actor?.id ? { 'x-actor-id': actor.id } : {}),
        ...(actor?.email ? { 'x-actor-email': actor.email } : {}),
      },
      body: JSON.stringify({ email, password, role }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data?.error || data?.message || 'Falha ao criar usuário (backend não configurado)')
    }
    return data
  } catch (e) {
    throw e
  }
}

export async function updateUserEmail(profileId, email, actor) {
  const body = { profile_id: profileId, email }
  const res = await fetch(adminUrl('/admin/profiles/update-email'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(actor?.id ? { 'x-actor-id': actor.id } : {}),
      ...(actor?.email ? { 'x-actor-email': actor.email } : {}),
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || data?.message || 'Falha ao atualizar e-mail do usuário')
  }
  return data
}

export async function linkProfileCollaborator(profileId, collaboratorId, actor) {
  const body = { profile_id: profileId, collaborator_id: collaboratorId || null }
  const res = await fetch(adminUrl('/admin/profiles/link-collaborator'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(actor?.id ? { 'x-actor-id': actor.id } : {}),
      ...(actor?.email ? { 'x-actor-email': actor.email } : {}),
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || data?.message || 'Falha ao vincular colaborador')
  }
  return data
}

export async function resetUserPassword(profileId, password, actor) {
  const body = { profile_id: profileId, password }
  const res = await fetch(adminUrl('/admin/profiles/reset-password'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(actor?.id ? { 'x-actor-id': actor.id } : {}),
      ...(actor?.email ? { 'x-actor-email': actor.email } : {}),
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || data?.message || 'Falha ao resetar senha do usuário')
  }
  return data
}
