export async function createUser({ email, password, role = 'user' }, actor) {
  try {
    const res = await fetch('/api/admin/users', {
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
