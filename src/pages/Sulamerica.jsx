import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.js?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export default function Sulamerica() {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()
  const [toast, setToast] = useState(null)
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [rawText, setRawText] = useState('')
  const [showDebug, setShowDebug] = useState(false)

  const toLines = (t) => String(t || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)

  const normalize = (s) => String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const getField = (lines, rawLabel, valueRe, opts = {}) => {
    const { fallbackIdxOffset = 1, maxLength = 120, onSameLine = false } = opts
    const labelVariants = Array.isArray(rawLabel) ? rawLabel : [rawLabel]
    const labelRegexes = labelVariants.map(l => new RegExp(normalize(l).replace(/\s+/g, '\\s+'), 'i'))

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const normLine = normalize(line)
      const matchedLabel = labelRegexes.find(re => re.test(normLine))
      if (!matchedLabel) continue

      if (valueRe) {
        const m = line.match(valueRe)
        if (m && m[1] !== undefined) return m[1].trim()
      }

      const matchIdx = normLine.search(matchedLabel)
      if (matchIdx !== -1) {
        const labelEndInNorm = matchIdx + matchedLabel.source.replace(/\\s\+/g, ' ').length
        const normParts = normLine.split(/\s+/)
        const lineParts = line.split(/\s+/)
        const wordIdx = normLine.slice(0, labelEndInNorm).trim().split(/\s+/).length
        const after = lineParts.slice(wordIdx).join(' ').trim()
        if (after && after.length <= maxLength && !onSameLine) return after
        if (after && onSameLine) return after
      }

      const next = lines[i + fallbackIdxOffset]
      if (next) return next.trim()
    }
    return ''
  }

  const parseExamLine = (line) => {
    const date = ''
    let remaining = line
    const dateMatch = remaining.match(/^(\d{2}\/\d{2}\/\d{4})\s+/)
    if (dateMatch) {
      remaining = remaining.slice(dateMatch[0].length).trim()
    }
    // Tenta formato: codigo descricao quantidade valor
    const m1 = remaining.match(/^(\d{3,})\s+(.+?)\s+(\d+)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/)
    if (m1) {
      return {
        date: dateMatch ? dateMatch[1] : '',
        code: m1[1].trim(),
        description: m1[2].trim(),
        quantity: Number(m1[3]) || 0,
        value: m1[4].trim(),
      }
    }
    // Tenta capturar valor no final, quantidade antes, e descricao no meio
    const valMatch = remaining.match(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/)
    if (valMatch) {
      const beforeVal = remaining.slice(0, valMatch.index).trim()
      const qtyMatch = beforeVal.match(/(\d+)\s+([^\d]+)$/) || beforeVal.match(/(\d+)\s*$/)
      if (qtyMatch) {
        const qty = Number(qtyMatch[1])
        const descAndCode = beforeVal.slice(0, beforeVal.lastIndexOf(qtyMatch[1])).trim()
        const codeMatch = descAndCode.match(/^(\d{3,})\s+(.*)$/) || descAndCode.match(/^(\d{3,})$/)
        const code = codeMatch ? codeMatch[1] : ''
        const description = codeMatch ? codeMatch[2].trim() : descAndCode
        if (description && qty) {
          return {
            date: dateMatch ? dateMatch[1] : '',
            code,
            description,
            quantity: qty,
            value: valMatch[1].trim(),
          }
        }
      }
    }
    return null
  }

  const parseTiss = (fullText) => {
    const pages = String(fullText || '').split(/\f/)
    const allLines = toLines(fullText)
    const firstPageLines = toLines(pages[0] || fullText)

    const header = {
      registro_ANS: getField(firstPageLines, ['registro ans', 'registroans'], /(\d{6})/),
      codigo_operadora: getField(firstPageLines, ['codigo na operadora', 'codigo operadora'], /(\S+)/),
      nome_contratado: getField(firstPageLines, ['nome do contratado', 'contratado'], null, { maxLength: 80 }),
      numero_requisicao: getField(firstPageLines, ['no da requisicao', 'numero da requisicao', 'requisicao'], /(\S+)/),
      data_autorizacao: getField(firstPageLines, ['data da autorizacao', 'autorizacao'], /(\d{2}\/\d{2}\/\d{4})/),
      numero_carteira: getField(firstPageLines, ['numero da carteira', 'carteira'], /(\S+)/),
      validade_carteira: getField(firstPageLines, ['validade da carteira', 'validade'], /(\d{2}\/\d{2}\/\d{4})/),
      beneficiario_nome: getField(firstPageLines, ['nome do beneficiario', 'beneficiario'], null, { maxLength: 80 })
        || getField(firstPageLines, ['nome'], null, { maxLength: 80 }),
      cns: getField(firstPageLines, ['cartao nacional de saude', 'cns'], /(\d[\d\. ]{10,})/),
      atendimento_RN: getField(firstPageLines, ['atendimento rn'], /(sim|nao|nao|n\/a)/i),
      profissional_nome: getField(firstPageLines, ['nome do profissional solicitante', 'profissional solicitante'], null, { maxLength: 80 }),
      conselho_profissional: getField(firstPageLines, ['conselho profissional'], /(CRM|COREN|CRO|CRP|CRF|CREFITO|CREFONO|CBO|OUTROS)/i),
      numero_conselho: getField(firstPageLines, ['numero no conselho'], /(\S+)/),
      uf_conselho: getField(firstPageLines, ['uf'], /([A-Z]{2})/),
      cbos: getField(firstPageLines, ['cbos'], /(\d{4}-?\d{2})/),
      indicacao_clinica: getField(allLines, ['indicacao clinica'], null, { maxLength: 500 }),
      tipo_atendimento: getField(allLines, ['tipo de atendimento'], /(eletivo|urgencia|emergencia|outros|ambulatorial)/i),
      indicacao_acidente: getField(allLines, ['indicacao de acidente'], /(trabalho|transito|outros|nao|nao|nenhuma)/i),
      tipo_consulta: getField(allLines, ['tipo de consulta'], /(primeira|seguimento|pre natal|pos op|eletiva)/i),
    }

    const examLines = []
    const headerPatterns = [
      /codigo\s+descricao/i,
      /data\s+codigo\s+descricao/i,
      /procedimento\s+realizado/i,
      /codigo\s+procedimento/i,
    ]

    const parsePageForExams = (pageText) => {
      const lines = toLines(pageText)
      let inTable = false
      for (const line of lines) {
        const norm = normalize(line)
        if (!inTable && headerPatterns.some(re => re.test(line) || re.test(norm))) {
          inTable = true
          continue
        }
        if (!inTable) continue
        if (/observacoes/i.test(norm) || /totais?/i.test(norm) || /assinatura/i.test(norm)) break
        const parsed = parseExamLine(line)
        if (parsed) {
          examLines.push(parsed)
        }
      }
    }

    pages.forEach((p) => {
      if (!p) return
      parsePageForExams(p)
    })

    return { header, exams: examLines }
  }

  const extractTextFromPdf = async (arrayBuffer) => {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const pageTexts = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const items = (textContent.items || [])
        .filter(item => item && typeof item.str === 'string' && item.str.trim())
        .map(item => {
          const tx = item.transform || []
          return {
            text: item.str,
            x: Number(tx[4] || 0),
            y: Number(tx[5] || 0),
            width: Number(item.width || 0),
            height: Number(item.height || 0),
          }
        })

      // Agrupa por linha baseado na posicao Y (com tolerancia)
      const rows = []
      const tolerance = 3
      for (const item of items) {
        let row = rows.find(r => Math.abs(r.y - item.y) <= tolerance)
        if (!row) {
          row = { y: item.y, items: [] }
          rows.push(row)
        }
        row.items.push(item)
      }

      rows.sort((a, b) => a.y - b.y)
      for (const row of rows) {
        row.items.sort((a, b) => a.x - b.x)
      }

      const lines = rows.map(row => {
        let line = ''
        let lastX = null
        for (const item of row.items) {
          if (lastX !== null && item.x - lastX > 5) {
            line += ' '
          } else if (lastX !== null && item.x - lastX > 0) {
            line += ' '
          }
          line += item.text
          lastX = item.x + item.width
        }
        return line
      })

      pageTexts.push(lines.join('\n'))
    }
    return pageTexts.join('\f')
  }

  useEffect(() => {
    if (loading) return
    // Se o perfil ainda não foi carregado, não decidir ainda
    if (!profile) return
    if (profile.can_access_sulamerica) return
    setToast({ title: 'Acesso restrito', message: 'Você não tem permissão para acessar o portal SulAmérica.' })
    const timer = setTimeout(() => {
      // Redirecionar para o domínio principal de RH
      window.location.href = 'https://rh.analiselabclinico.com.br'
    }, 2500)
    return () => clearTimeout(timer)
  }, [loading, profile, navigate])

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-neutral-500">Carregando...</div>
  }

  // Enquanto o perfil não estiver carregado, evitar piscar tela de acesso negado
  if (!profile) {
    return <div className="min-h-screen grid place-items-center text-neutral-500">Carregando...</div>
  }

  if (!profile.can_access_sulamerica) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-white">
        {toast && (
          <div className="fixed bottom-4 right-4 bg-red-500 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
            <div className="font-semibold mb-0.5">{toast.title}</div>
            <div>{toast.message}</div>
          </div>
        )}
      </div>
    )
  }

  const onFileChange = (e) => {
    const f = e.target.files?.[0] || null
    setFile(f)
    setResult(null)
    setError('')
  }

  const readFileAsArrayBuffer = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = (err) => reject(err)
    reader.readAsArrayBuffer(f)
  })

  const onImport = async (e) => {
    e.preventDefault()
    if (!file) {
      setError('Selecione um arquivo PDF no padrão TISS para continuar.')
      return
    }
    try {
      setImporting(true)
      setError('')
      setResult(null)
      setRawText('')
      const arrayBuffer = await readFileAsArrayBuffer(file)
      const fullText = await extractTextFromPdf(arrayBuffer)
      setRawText(fullText)
      const parsed = parseTiss(fullText)
      setResult(parsed)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Falha ao importar PDF')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <h1 className="text-2xl font-semibold">Portal SulAmérica</h1>
        <p className="mt-2 text-sm text-neutral-600">Importe o PDF da guia TISS para visualizar os dados extraídos.</p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700 space-y-4">
        <form className="space-y-4" onSubmit={onImport}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-800">Arquivo da guia TISS (PDF)</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={onFileChange}
              className="block w-full text-sm text-neutral-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-neutral-300 file:text-sm file:font-medium file:bg-neutral-50 file:text-neutral-800 hover:file:bg-neutral-100"
            />
            <p className="text-xs text-neutral-500">Selecione o PDF padronizado da guia médica de plano de saúde SulAmérica.</p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={importing}
              className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {importing ? 'Importando...' : 'Importar PDF'}
            </button>
            {rawText && (
              <button
                type="button"
                onClick={() => setShowDebug(s => !s)}
                className="text-xs text-neutral-500 hover:text-neutral-700 underline"
              >
                {showDebug ? 'Ocultar texto bruto' : 'Ver texto bruto extraído'}
              </button>
            )}
          </div>
        </form>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
            <h2 className="text-base font-semibold mb-3">Dados da guia</h2>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs md:text-sm">
              <div>
                <dt className="font-medium text-neutral-800">Registro ANS</dt>
                <dd>{result.header?.registro_ANS || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Código na Operadora</dt>
                <dd>{result.header?.codigo_operadora || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Nome do Contratado</dt>
                <dd>{result.header?.nome_contratado || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Nº da Requisição</dt>
                <dd>{result.header?.numero_requisicao || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Data da Autorização</dt>
                <dd>{result.header?.data_autorizacao || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Número da Carteira</dt>
                <dd>{result.header?.numero_carteira || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Validade da Carteira</dt>
                <dd>{result.header?.validade_carteira || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Nome do Beneficiário</dt>
                <dd>{result.header?.beneficiario_nome || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Cartão Nacional de Saúde (CNS)</dt>
                <dd>{result.header?.cns || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Atendimento RN</dt>
                <dd>{result.header?.atendimento_RN || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Profissional Solicitante</dt>
                <dd>{result.header?.profissional_nome || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Conselho Profissional</dt>
                <dd>{result.header?.conselho_profissional || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Número no Conselho</dt>
                <dd>{result.header?.numero_conselho || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">UF do Conselho</dt>
                <dd>{result.header?.uf_conselho || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">CBOS</dt>
                <dd>{result.header?.cbos || '\u2014'}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="font-medium text-neutral-800">Indicação Clínica</dt>
                <dd>{result.header?.indicacao_clinica || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Tipo de Atendimento</dt>
                <dd>{result.header?.tipo_atendimento || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Indicação de Acidente</dt>
                <dd>{result.header?.indicacao_acidente || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Tipo de Consulta</dt>
                <dd>{result.header?.tipo_consulta || '\u2014'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
            <h2 className="text-base font-semibold mb-3">Exames</h2>
            {(!result.exams || result.exams.length === 0) ? (
              <p className="text-xs text-neutral-500">Nenhum exame encontrado no PDF.</p>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-xs md:text-sm border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-700">
                      <th className="border border-neutral-200 px-2 py-1 text-left">Data</th>
                      <th className="border border-neutral-200 px-2 py-1 text-left">Código</th>
                      <th className="border border-neutral-200 px-2 py-1 text-left">Descrição</th>
                      <th className="border border-neutral-200 px-2 py-1 text-right">Quantidade</th>
                      <th className="border border-neutral-200 px-2 py-1 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.exams.map((ex, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                        <td className="border border-neutral-200 px-2 py-1 whitespace-nowrap">{ex.date || '\u2014'}</td>
                        <td className="border border-neutral-200 px-2 py-1 whitespace-nowrap">{ex.code || '\u2014'}</td>
                        <td className="border border-neutral-200 px-2 py-1">{ex.description || '\u2014'}</td>
                        <td className="border border-neutral-200 px-2 py-1 text-right">{ex.quantity ?? '\u2014'}</td>
                        <td className="border border-neutral-200 px-2 py-1 text-right">{ex.value || '\u2014'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {showDebug && rawText && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
          <h2 className="text-base font-semibold mb-3">Texto bruto extraído do PDF</h2>
          <pre className="text-xs bg-neutral-50 border border-neutral-200 rounded-lg p-2 overflow-auto max-h-96 whitespace-pre-wrap">
            {rawText}
          </pre>
        </div>
      )}
    </div>
  )
}
