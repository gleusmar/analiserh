// xlsx é pesada — carregada sob demanda apenas no momento da importação
async function loadXLSX() {
  return await import('xlsx')
}

// ---------------------------------------------------------
// Dinheiro: sempre inteiros em centavos. Nunca usar float.
// ---------------------------------------------------------

// Converte "R$ 79.882,05" | "-250,00" | "Grátis" | number -> centavos (int) ou null
export function brlToCents(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value * 100)
  }
  let s = String(value).trim()
  if (!s) return null
  if (/gr[aá]tis/i.test(s)) return 0
  const neg = s.includes('-')
  s = s.replace(/[^\d.,]/g, '')
  if (!s) return null
  // formato BR: '.' milhar, ',' decimal
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const [intPart, decPart = ''] = s.split('.')
  const cents = BigInt(intPart || '0') * 100n + BigInt((decPart + '00').slice(0, 2))
  return Number(neg ? -cents : cents)
}

export function centsToBRL(cents) {
  if (cents === null || cents === undefined || cents === '') return ''
  const n = Number(cents) / 100
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function centsToInput(cents) {
  if (cents === null || cents === undefined) return ''
  return (Number(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ---------------------------------------------------------
// Datas
// ---------------------------------------------------------

// "31/12/2025 11:12" | Date | excel serial -> ISO string ou null
export function parseSheetDate(value) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  if (typeof value === 'number' && Number.isFinite(value)) {
    // excel serial (dias desde 1899-12-30)
    const ms = Math.round((value - 25569) * 86400 * 1000)
    return new Date(ms).toISOString()
  }
  const s = String(value).trim()
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (m) {
    const [, d, mo, y, h = '0', mi = '0', se = '0'] = m
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se))
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
  }
  const dt = new Date(s)
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
}

export function formatDateTimeBR(iso) {
  if (!iso) return ''
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ---------------------------------------------------------
// Esquemas de importação
// ---------------------------------------------------------

export const STONE_SCHEME_CONFIG = {
  map: {
    'Movimentação': 'movimentacao',
    'Tipo': 'tipo',
    'Valor': 'valor',
    'Saldo antes': 'saldo_antes',
    'Saldo depois': 'saldo_depois',
    'Tarifa': 'tarifa',
    'Data': 'data',
    'Nosso Número': 'nosso_numero',
    'Situação': 'situacao',
    'Destino': 'destino',
    'Destino Documento': 'destino_doc',
    'Destino Instituição': 'destino_inst',
    'Destino Agência': 'destino_agencia',
    'Destino Conta': 'destino_conta',
    'Origem': 'origem',
    'Origem Documento': 'origem_doc',
    'Origem Instituição': 'origem_inst',
    'Origem Agência': 'origem_agencia',
    'Origem Conta': 'origem_conta',
  },
  counterpart: { debit: 'destino', credit: 'origem' },
}

export function normalizeMovimentacao(v) {
  const s = String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (s.startsWith('deb')) return 'Débito'
  if (s.startsWith('cred')) return 'Crédito'
  return String(v || '').trim()
}

function isUnknown(v) {
  const s = String(v || '').trim().toLowerCase()
  return !s || s === 'desconhecido' || s === '-'
}

// Monta a linha normalizada a partir dos campos mapeados do esquema
export function buildEntry(mapped, config, bankId) {
  const movimentacao = normalizeMovimentacao(mapped.movimentacao)
  const tipo = String(mapped.tipo || '').trim() || null
  const occurred_at = parseSheetDate(mapped.data)
  const amount_cents = brlToCents(mapped.valor)
  if (!occurred_at || amount_cents === null || !movimentacao) return null

  const isCredit = movimentacao === 'Crédito'
  const side = isCredit ? (config?.counterpart?.credit || 'origem') : (config?.counterpart?.debit || 'destino')

  let counterpart = mapped[side] ?? null
  let counterpart_doc = mapped[`${side}_doc`] ?? null
  let counterpart_institution = mapped[`${side}_inst`] ?? null

  if (isUnknown(counterpart)) {
    counterpart = tipo === 'Recebível de Cartão' ? 'Recebível de Cartão' : (counterpart || null)
    if (isUnknown(counterpart)) counterpart = null
  }
  if (isUnknown(counterpart_doc)) counterpart_doc = null
  if (isUnknown(counterpart_institution)) counterpart_institution = null

  const balance_before_cents = brlToCents(mapped.saldo_antes)
  const balance_after_cents = brlToCents(mapped.saldo_depois)

  const entry = {
    bank_id: bankId,
    occurred_at,
    movimentacao,
    tipo,
    amount_cents,
    balance_before_cents,
    balance_after_cents,
    fee_cents: brlToCents(mapped.tarifa) ?? 0,
    situacao: String(mapped.situacao || '').trim() || null,
    counterpart,
    counterpart_doc,
    counterpart_institution,
    nosso_numero: String(mapped.nosso_numero || '').trim() || null,
    raw: mapped,
  }
  entry.fingerprint = buildFingerprint(entry)
  return entry
}

// Chave de deduplicação: data + valores de saldo + tipo + contraparte.
// Saldos antes/depois são únicos por lançamento no extrato, o que torna
// praticamente impossível confundir duas transações legítimas iguais.
export function buildFingerprint(e) {
  return [
    e.occurred_at,
    e.amount_cents,
    e.balance_before_cents ?? '',
    e.balance_after_cents ?? '',
    e.tipo ?? '',
    e.counterpart ?? '',
    e.nosso_numero ?? '',
  ].join('|')
}

// Lê a planilha (arrayBuffer) e aplica o esquema. Retorna { entries, errors, totalRows }
export async function parseStatementFile(arrayBuffer, schemeConfig, bankId) {
  const XLSX = await loadXLSX()
  const config = schemeConfig || STONE_SCHEME_CONFIG
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false })
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return { entries: [], errors: ['Planilha vazia'], totalRows: 0 }

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
  const map = config.map || {}
  const headers = Object.keys(map)

  // localiza a linha de cabeçalho nas primeiras 10 linhas
  let headerIdx = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i].map((c) => String(c).trim())
    const hits = headers.filter((h) => row.includes(h)).length
    if (hits >= Math.min(3, headers.length)) { headerIdx = i; break }
  }
  if (headerIdx < 0) return { entries: [], errors: ['Cabeçalho não encontrado para este esquema'], totalRows: 0 }

  const headerRow = rows[headerIdx].map((c) => String(c).trim())
  const colIndex = {}
  headerRow.forEach((h, i) => {
    if (map[h] && colIndex[map[h]] === undefined) colIndex[map[h]] = i
  })

  const entries = []
  const errors = []
  const seen = new Set()

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every((c) => c === '' || c === null || c === undefined)) continue
    const mapped = {}
    for (const [field, idx] of Object.entries(colIndex)) mapped[field] = row[idx]
    const entry = buildEntry(mapped, config, bankId)
    if (!entry) {
      errors.push(`Linha ${i + 1}: dados insuficientes (data/valor/movimentação)`)
      continue
    }
    if (seen.has(entry.fingerprint)) continue // duplicado dentro do próprio arquivo
    seen.add(entry.fingerprint)
    entries.push(entry)
  }

  return { entries, errors, totalRows: rows.length - headerIdx - 1 }
}
