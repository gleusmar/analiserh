// Status Matcher: classifica lançamentos em
// 'matched' (conciliado), 'exact' (valor+data batem — candidato a conciliação),
// 'partial' (valor bate, data distante ou múltiplos candidatos) e 'none'.

function dayOf(d) {
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10)
}

function dateDiffDays(a, b) {
  const da = new Date(dayOf(a)); const db = new Date(dayOf(b))
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return Infinity
  return Math.abs(Math.round((da - db) / 86400000))
}

// Retorna { internal: Map<id,state>, external: Map<id,state>, suggestions: Map<externalId, internalId[]> }
export function classifyMatchStates(internalEntries, externalEntries) {
  const internal = new Map()
  const external = new Map()
  const suggestions = new Map()

  const unmatchedInternal = (internalEntries || []).filter(e => e.status === 'unmatched')
  const unmatchedExternal = (externalEntries || []).filter(e => e.status === 'unmatched')

  // indexa internos por valor (centavos assinados)
  const byAmount = new Map()
  for (const e of unmatchedInternal) {
    const k = String(e.amount_cents)
    if (!byAmount.has(k)) byAmount.set(k, [])
    byAmount.get(k).push(e)
  }

  for (const e of unmatchedExternal) {
    const candidates = byAmount.get(String(e.amount_cents)) || []
    const sameDay = candidates.filter(c => dateDiffDays(c.entry_date, e.occurred_at) === 0)
    let state
    if (sameDay.length === 1 && candidates.length === 1) state = 'exact'
    else if (candidates.length > 0) state = 'partial'
    else state = 'none'
    external.set(e.id, state)
    if (candidates.length) suggestions.set(e.id, candidates.map(c => c.id))
  }

  const extByAmount = new Map()
  for (const e of unmatchedExternal) {
    const k = String(e.amount_cents)
    if (!extByAmount.has(k)) extByAmount.set(k, [])
    extByAmount.get(k).push(e)
  }
  for (const e of unmatchedInternal) {
    const candidates = extByAmount.get(String(e.amount_cents)) || []
    const sameDay = candidates.filter(c => dateDiffDays(e.entry_date, c.occurred_at) === 0)
    let state
    if (sameDay.length === 1 && candidates.length === 1) state = 'exact'
    else if (candidates.length > 0) state = 'partial'
    else state = 'none'
    internal.set(e.id, state)
  }

  for (const e of (internalEntries || [])) {
    if (e.status === 'matched') internal.set(e.id, 'matched')
    if (e.status === 'ignored') internal.set(e.id, 'ignored')
  }
  for (const e of (externalEntries || [])) {
    if (e.status === 'matched') external.set(e.id, 'matched')
    if (e.status === 'ignored') external.set(e.id, 'ignored')
  }

  return { internal, external, suggestions }
}

// Pares 1:1 seguros para auto-conciliação: mesmo valor e mesmo dia, sem ambiguidade
export function findAutoMatchPairs(internalEntries, externalEntries) {
  const unmatchedInternal = (internalEntries || []).filter(e => e.status === 'unmatched')
  const unmatchedExternal = (externalEntries || []).filter(e => e.status === 'unmatched')

  const byAmount = new Map()
  for (const e of unmatchedInternal) {
    const k = String(e.amount_cents)
    if (!byAmount.has(k)) byAmount.set(k, [])
    byAmount.get(k).push(e)
  }

  const usedInternal = new Set()
  const pairs = []
  for (const e of unmatchedExternal) {
    const candidates = (byAmount.get(String(e.amount_cents)) || [])
      .filter(c => !usedInternal.has(c.id) && dateDiffDays(c.entry_date, e.occurred_at) === 0)
    if (candidates.length === 1) {
      usedInternal.add(candidates[0].id)
      pairs.push({ internal: candidates[0], external: e })
    }
  }
  return pairs
}
