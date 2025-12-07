export function onlyDigits(v = '') {
  return String(v || '').replace(/\D/g, '')
}

export function maskCPF(v = '') {
  const d = onlyDigits(v).slice(0, 11)
  const p1 = d.slice(0, 3)
  const p2 = d.slice(3, 6)
  const p3 = d.slice(6, 9)
  const p4 = d.slice(9, 11)
  let out = ''
  if (p1) out += p1
  if (p2) out += (out ? '.' : '') + p2
  if (p3) out += (out ? '.' : '') + p3
  if (p4) out += (out ? '-' : '') + p4
  return out
}

export function validateCPF(v = '') {
  const d = onlyDigits(v)
  if (d.length !== 11) return false
  if (/^(\d)\1+$/.test(d)) return false
  const calc = (base) => {
    let sum = 0
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i], 10) * (base.length + 1 - i)
    const mod = sum % 11
    return mod < 2 ? 0 : 11 - mod
  }
  const d1 = calc(d.slice(0, 9))
  const d2 = calc(d.slice(0, 9) + String(d1))
  return d1 === parseInt(d[9], 10) && d2 === parseInt(d[10], 10)
}

export function maskCEP(v = '') {
  const d = onlyDigits(v).slice(0, 8)
  const p1 = d.slice(0, 5)
  const p2 = d.slice(5, 8)
  return p2 ? `${p1}-${p2}` : p1
}

export function formatDateISO(d) {
  if (!d) return ''
  try {
    const dt = new Date(d)
    if (Number.isNaN(dt.getTime())) return ''
    const yyyy = dt.getFullYear()
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    const dd = String(dt.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  } catch {
    return ''
  }
}

export function formatBRL(value) {
  if (value === null || value === undefined || value === '') return ''
  const num = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  if (Number.isNaN(num)) return ''
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function parseBRL(masked) {
  if (!masked) return 0
  // remove tudo exceto dígitos e vírgula/ponto e normaliza vírgula para ponto
  const s = String(masked).replace(/[^0-9,.-]/g, '').replace(',', '.')
  const n = Number(s)
  return Number.isNaN(n) ? 0 : Number(n.toFixed(2))
}

export function formatDateBR(d) {
  if (!d) return ''
  try {
    const dt = new Date(d)
    if (Number.isNaN(dt.getTime())) return ''
    return dt.toLocaleDateString('pt-BR')
  } catch {
    return ''
  }
}

export function maskPhone(v = '') {
  const d = onlyDigits(v).slice(0, 11)
  if (d.length <= 10) {
    // (00) 0000-0000
    const p1 = d.slice(0, 2)
    const p2 = d.slice(2, 6)
    const p3 = d.slice(6, 10)
    let out = ''
    if (p1) out += `(${p1})`
    if (p2) out += (out ? ' ' : '') + p2
    if (p3) out += (p2 ? '-' : '') + p3
    return out
  } else {
    // (00) 00000-0000
    const p1 = d.slice(0, 2)
    const p2 = d.slice(2, 7)
    const p3 = d.slice(7, 11)
    let out = ''
    if (p1) out += `(${p1})`
    if (p2) out += (out ? ' ' : '') + p2
    if (p3) out += (p2 ? '-' : '') + p3
    return out
  }
}
