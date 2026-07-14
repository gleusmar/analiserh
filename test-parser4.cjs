const { createWorker } = require('tesseract.js')
const toLines = (t) => String(t || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
const parseDate = (s) => {
  const m = String(s || '').match(/(\d{2})\s*([\/\s]?)\s*(\d{2})\s*([\/\s]?)\s*(\d{4})/)
  if (m) return `${m[1]}/${m[3]}/${m[5]}`
  return s
}
const normalizeValue = (int, dec) => `${int},${dec}`
const parseTissTextOnly = (fullText) => {
  const header = {}
  const exams = []
  const pages = String(fullText || '').split(/\f|\n--- PAGE ---\n/)
  for (const pageText of pages) {
    const pageLines = toLines(pageText)
    if (pageLines.length === 0) continue
    if (!header.numero_requisicao && /\d{6,}/.test(pageLines[0] || '')) {
      header.numero_requisicao = pageLines[0].match(/(\d{6,})/)?.[1] || ''
    }
    if (!header.registro_ANS && pageLines[1]) {
      const m = pageLines[1].match(/(\d{6})/)
      header.registro_ANS = m ? m[1] : ''
      header.nome_operadora = pageLines[1].replace(/\d{6}/, '').replace(/[^A-Z\s]/gi, '').trim()
    }
    if (!header.data_autorizacao && pageLines[2]) {
      header.data_autorizacao = parseDate(pageLines[2])
    }
    if (!header.numero_carteira && pageLines[3]) {
      const m = pageLines[3].match(/^(\S+)\s+(\d{2}\s*[\/\s]\s*\d{2}\s*[\/\s]\s*\d{4})\s+(.+)$/)
      if (m) {
        header.numero_carteira = m[1].trim()
        header.validade_carteira = parseDate(m[2])
        header.beneficiario_nome = m[3].trim()
      } else {
        const parts = pageLines[3].split(/\s{2,}/)
        if (parts.length >= 3) {
          header.numero_carteira = parts[0].trim()
          header.validade_carteira = parseDate(parts[1])
          header.beneficiario_nome = parts.slice(2).join(' ').trim()
        } else {
          const tokens = pageLines[3].split(/\s+/)
          if (tokens.length >= 5) {
            header.numero_carteira = tokens[0]
            header.validade_carteira = parseDate(`${tokens[1]} ${tokens[2]} ${tokens[3]}`)
            header.beneficiario_nome = tokens.slice(4).join(' ')
          }
        }
      }
    }
    const crmLine = pageLines.find(l => /CRM\s+\d+\s+[A-Z]{2}\s+\d+/i.test(l))
    if (crmLine && !header.numero_conselho) {
      const m = crmLine.match(/CRM\s+\d+\s+([A-Z]{2})\s+(\d+)/i)
      if (m) {
        header.conselho_profissional = 'CRM'
        header.uf_conselho = m[1]
        header.numero_conselho = m[2]
      }
    }
    const authorized = {}
    const executed = {}
    for (const line of pageLines) {
      const m2 = line.match(/^\s*[\d\s\-:\.]*16\s+(\d{8,})\s+([A-Z][A-Z0-9\s\-\.]+?)\s+(\d+)\s+(\d+)\s*$/i)
      if (m2) {
        authorized[m2[1]] = m2[2].trim()
      }
    }
    for (const line of pageLines) {
      const m = line.match(/(?:^|[\s:])(?:\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\s+\d{2}:\d{2}\s+)?(?:16|1\s+6|91)\s+(\d{8,})\s+([A-Z][A-Z0-9\s\-\.]+?)\s+(?:[oO0]?[\dlL1]{0,2}\s+)?[Uu]\s*(?:[Cc][Cc]?)?\s+(\d{1,3})[\s.,](\d{2,3})\s+(\d{1,3})[\s.,](\d{2,3})/i)
      if (m) {
        executed[m[1]] = {
          description: m[2].trim(),
          value: normalizeValue(m[3], m[4]),
          value_total: normalizeValue(m[5], m[6])
        }
      }
    }
    const allCodes = new Set([...Object.keys(authorized), ...Object.keys(executed)])
    for (const code of allCodes) {
      exams.push({
        code,
        description: authorized[code] || executed[code]?.description || '',
        value: executed[code]?.value || '',
        value_total: executed[code]?.value_total || '',
        quantity: 1,
        date: ''
      })
    }
  }
  return { header, exams }
}
const postProcess = (t) => {
  let s = t
  s = s.replace(/(\bU)\n([cC]c?)\s+/g, '$1 $2 ')
  s = s.replace(/(\b[cC]c?\s+\d{1,3}[.,]?\d{0,2})\n(\d{1,3}(?:[.,]\d{2,3})?)\s+(\d{1,3}[.,]\d{2,3})/g, '$1$2 $3')
  s = s.replace(/(\b[cC]c?\s+\d{1,3}[.,]\d{2,3}\s+\d{1,3}[.,]?)\n(\d{2,3})/g, '$1$2')
  return s
}
(async () => {
  const worker = await createWorker('por', 1, { logger: m => {} })
  await worker.setParameters({ tessedit_pageseg_mode: '3' })
  const { data } = await worker.recognize('/tmp/139746/p2-300-2-rot.png')
  const text = postProcess(data.text)
  console.log('--- RAW TEXT ---')
  console.log(text.slice(0, 3000))
  console.log('--- PARSED ---')
  console.log(JSON.stringify(parseTissTextOnly(text), null, 2))
  await worker.terminate()
})()
