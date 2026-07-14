const { createWorker } = require('tesseract.js')
const toLines = (t) => String(t || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
const parseDate = (s) => {
  const m = String(s || '').match(/(\d{2})\s*[/]?\s*(\d{2})\s*[/]?\s*(\d{4})/)
  if (m) return `${m[1]}/${m[2]}/${m[3]}`
  return s
}
const normalizeValue = (int, dec) => `${int},${dec}`
const postProcessOcrText = (t) => {
  let s = String(t || '')
  s = s.replace(/(\bU)\n([cC]c?)\s+/g, '$1 $2 ')
  s = s.replace(/(\b[cC]c?\s+\d{1,3}[.,]?\d{0,2})\n(\d{1,3}(?:[.,]\d{2,3})?)\s+(\d{1,3}[.,]\d{2,3})/g, '$1$2 $3')
  s = s.replace(/(\b[cC]c?\s+\d{1,3}[.,]\d{2,3}\s+\d{1,3}[.,]?)\n(\d{2,3})/g, '$1$2')
  return s
}
const parseTissTextOnly = (fullText) => {
  const header = {}
  const exams = []
  const pages = postProcessOcrText(String(fullText || '')).split(/\f|\n--- PAGE ---\n/)
  for (const pageText of pages) {
    const pageLines = toLines(pageText)
    if (pageLines.length === 0) continue
    const reqLine = pageLines.find(l => /(?:2[-–—]N\s*|No\.?\s*|da Guia Principal)\s*(\d{6,})/i.test(l)) || pageLines[0]
    const reqM = reqLine.match(/(\d{6,})/)
    if (reqM && !header.numero_requisicao) header.numero_requisicao = reqM[1]
    const opLine = pageLines.find(l => /SULAMERICA/i.test(l))
    if (opLine) {
      const m = opLine.match(/(\d{6})\s+SULAMERICA\s*(.*)/i)
      if (m) { header.registro_ANS = m[1]; header.nome_operadora = `SULAMERICA ${m[2]}`.trim() }
    }
    const authLabel = pageLines.findIndex(l => /Data da Autoriza/i.test(l))
    if (authLabel >= 0 && pageLines[authLabel + 1]) header.data_autorizacao = parseDate(pageLines[authLabel + 1])
    else if (pageLines[2]) header.data_autorizacao = parseDate(pageLines[2])
    const cartLine = pageLines.find(l => /(\d{18,})\s+(\d{2}[/\s]\d{2}[/\s]\d{4})\s+(.+)/.test(l))
    if (cartLine) {
      const m = cartLine.match(/(\d{18,})\s+(\d{2}[/\s]\d{2}[/\s]\d{4})\s+(.+)/)
      header.numero_carteira = m[1]
      header.validade_carteira = parseDate(m[2])
      header.beneficiario_nome = m[3].trim()
    }
    const crmLine = pageLines.find(l => /CRM\s+([A-Z]{2})\s+([\d.]+)/i.test(l))
    if (crmLine && !header.numero_conselho) {
      const m = crmLine.match(/CRM\s+([A-Z]{2})\s+([\d.]+)/i)
      if (m) { header.conselho_profissional = 'CRM'; header.uf_conselho = m[1]; header.numero_conselho = m[2].replace(/\D/g, '') }
    }
    const authorized = {}; const executed = {}
    for (const line of pageLines) {
      const m2 = line.match(/^\s*[\d\s\-:.]*16\s+(\d{8,})\s+([A-Z][A-Z0-9\s\-.]+?)\s+(\d+)\s+(\d+)\s*$/i)
      if (m2) authorized[m2[1]] = m2[2].trim()
    }
    for (const line of pageLines) {
      const m = line.match(/(?:^|[\s:])(?:\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\s+\d{2}:\d{2}\s+)?(?:16|1\s+6|91)\s+(\d{8,})\s+([A-Z][A-Z0-9\s\-.]+?)\s+(?:[oO0]?[\dlL1]{0,2}\s+)?[Uu]\s*(?:[Cc][Cc]?)?\s+(\d{1,3})[\s.,](\d{2,3})\s+(\d{1,3})[\s.,](\d{2,3})/i)
      if (m) {
        executed[m[1]] = { description: m[2].trim(), value: normalizeValue(m[3], m[4]), value_total: normalizeValue(m[5], m[6]) }
      }
    }
    const allCodes = new Set([...Object.keys(authorized), ...Object.keys(executed)])
    for (const code of allCodes) {
      exams.push({ code, description: authorized[code] || executed[code]?.description || '', value: executed[code]?.value || '', value_total: executed[code]?.value_total || '', quantity: 1, date: '' })
    }
  }
  return { header, exams }
}
;(async () => {
  const files = ['/tmp/139746/p300-1-rot-thresh250.png', '/tmp/139746/p300-2-rot-thresh250.png', '/tmp/139746/p300-3-rot-thresh250.png']
  const worker = await createWorker('por', 1, { logger: m => {} })
  await worker.setParameters({ tessedit_pageseg_mode: '3' })
  const parts = []
  for (const f of files) {
    const { data } = await worker.recognize(f)
    parts.push(data.text)
  }
  await worker.terminate()
  const fullText = parts.join('\n\n--- PAGE ---\n\n')
  console.log(JSON.stringify(parseTissTextOnly(fullText), null, 2))
})()
