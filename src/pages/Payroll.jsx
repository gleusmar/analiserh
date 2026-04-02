import { Fragment, useEffect, useMemo, useState } from 'react'
import { Download, FileDown, Trash2, Upload, UserMinus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { listCollaboratorsSimple, listPayrollEntryTypes, listPayrollSheets, createPayrollSheet, listPayrollSheetItems, listPayrollEntriesForSheet, createPayrollEntry, deletePayrollEntry, updatePayrollSheet, deletePayrollSheet, upsertPlantaoEntry, listShiftFunctions, listShiftAssignments, listShiftRateOverrides, addPayrollSheetItems, getHoleriteUrl, deleteHolerite, uploadHolerite } from '../lib/db'

function ymOf(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}` }
function parseYM(ym) { const [y,m] = String(ym||'').split('-').map(Number); return { y, m } }
function firstLastOfYM(ym) { const { y, m } = parseYM(ym); if (!y || !m) return { from: null, to: null }; const from = new Date(y, m-1, 1); const to = new Date(y, m, 0); const pad = (n)=>String(n).padStart(2,'0'); return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(to.getDate())}` } }
function formatDateBR(d) { const dt = d instanceof Date ? d : new Date(d); const dd = String(dt.getDate()).padStart(2,'0'); const mm = String(dt.getMonth()+1).padStart(2,'0'); const yyyy = dt.getFullYear(); return `${dd}/${mm}/${yyyy}` }
function csvEscape(value) {
  const str = value === null || value === undefined ? '' : String(value)
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export default function Payroll() {
  const { role, profile, user } = useAuth()
  const canAdmin = role === 'admin' || role === 'super'
  const [sheets, setSheets] = useState([])
  const [selectedSheetId, setSelectedSheetId] = useState('')

  const [items, setItems] = useState([]) // sheet items (collaborators)
  const [entriesByItem, setEntriesByItem] = useState({}) // { sheet_item_id: [entries] }
  const [types, setTypes] = useState([])

  const [collaborators, setCollaborators] = useState([])
  const [openCreate, setOpenCreate] = useState(false)
  const [sheetName, setSheetName] = useState('')
  const [sheetYearMonth, setSheetYearMonth] = useState(ymOf(new Date()))
  const [selectedCols, setSelectedCols] = useState({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [expanded, setExpanded] = useState({}) // { sheet_item_id: bool }

  // Sorting & filter
  const [orderBy, setOrderBy] = useState('name') // name | concent_id | inc | out | total
  const [orderDir, setOrderDir] = useState('asc') // asc | desc
  const [q, setQ] = useState('')

  // Import modal state
  const [openImport, setOpenImport] = useState(false)
  const [importSheetId, setImportSheetId] = useState('')
  const [importPreview, setImportPreview] = useState([]) // [{ item_id, collaborator_id, name, concent_id, total }]
  const [importSel, setImportSel] = useState({}) // { item_id: bool }
  const [importLoading, setImportLoading] = useState(false)
  const [importYearMonth, setImportYearMonth] = useState(ymOf(new Date()))

  // Export modal state
  const [openExport, setOpenExport] = useState(false)
  const [exportNrDocto, setExportNrDocto] = useState('')
  const [exportIssueDate, setExportIssueDate] = useState(formatDateBR(new Date()))
  const [exportMoveDate, setExportMoveDate] = useState(formatDateBR(new Date()))
  const [exportDueDate, setExportDueDate] = useState(formatDateBR(new Date()))

  // Holerites import
  const [openSlip, setOpenSlip] = useState(false)
  const [slipPages, setSlipPages] = useState([]) // [{ idx, blob, collaborator_id, selected }]
  const [slipLoading, setSlipLoading] = useState(false)

  // Upload de holerite individual (perfil user)
  const [uploadingHolerite, setUploadingHolerite] = useState(false)

  // Presença de holerite por colaborador na folha atual
  const [hasHolerite, setHasHolerite] = useState({}) // { collaborator_id: bool }

  // Add collaborators to existing sheet
  const [openAddCols, setOpenAddCols] = useState(false)
  const [addCandidates, setAddCandidates] = useState([]) // [{ id, name, status, concent_id }]
  const [addSel, setAddSel] = useState({}) // { collaborator_id: bool }
  const [addLoading, setAddLoading] = useState(false)

  async function loadBase() {
    setLoading(true); setError(null)
    try {
      const [t, sh] = await Promise.all([
        listPayrollEntryTypes(),
        listPayrollSheets(),
      ])
      setTypes(t || [])
      setSheets(sh || [])
      const first = (sh||[])[0]?.id || ''
      setSelectedSheetId(prev => prev || first)
    } catch (e) { setError(e.message || 'Erro ao carregar folhas') } finally { setLoading(false) }
  }

  async function onRemoveItemFromSheet(collaboratorId) {
    if (!selectedSheetId) return
    if (!confirm('Retirar este colaborador da folha? Esta ação também removerá o holerite dele, se existir.')) return
    try {
      const r = await fetch('/api/sheets/remove-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.id ? { 'x-actor-id': user.id } : {}),
          ...(user?.email ? { 'x-actor-email': user.email } : {}),
        },
        body: JSON.stringify({ sheetId: selectedSheetId, collaborator_id: collaboratorId }),
      })
      if (!r.ok) throw new Error(await r.text())
      // Update UI: remove sheet item and its entries
      setItems(list => list.filter(it => it.collaborator_id !== collaboratorId))
      setEntriesByItem(map => {
        const next = { ...map }
        for (const [k, v] of Object.entries(next)) {
          const itemId = Number(k)
          const it = (items || []).find(x => x.id === itemId)
          if (it && it.collaborator_id === collaboratorId) delete next[k]
        }
        return next
      })
      alert('Colaborador removido da folha')
    } catch (e) {
      alert(e.message || 'Falha ao retirar colaborador da folha')
    }
  }

  async function openAddCollaborators() {
    setOpenAddCols(true)
    try {
      setAddLoading(true)
      const all = await listCollaboratorsSimple()
      const currentIds = new Set((items||[]).map(it => it.collaborator_id))
      const cands = (all||[]).filter(c => c.status !== 'inactive' && !currentIds.has(c.id))
      setAddCandidates(cands)
      const init = {}
      cands.forEach(c => { init[c.id] = false })
      setAddSel(init)
    } catch (e) { alert(e.message || 'Falha ao carregar colaboradores') }
    finally { setAddLoading(false) }
  }

  async function onConfirmAddCollaborators() {
    if (!selectedSheetId) return
    const ids = Object.entries(addSel).filter(([,v])=>!!v).map(([k])=>k)
    if (!ids.length) { alert('Selecione ao menos um colaborador'); return }
    try {
      setAddLoading(true)
      await addPayrollSheetItems(selectedSheetId, ids)
      setOpenAddCols(false)
      setAddCandidates([])
      setAddSel({})
      await loadSheet(selectedSheetId)
    } catch (e) { alert(e.message || 'Falha ao adicionar colaboradores') }
    finally { setAddLoading(false) }
  }

  async function onChooseHolerites(file) {
    if (!file) return
    try {
      setSlipLoading(true)
      const { PDFDocument } = await import('pdf-lib')
      const buf = await file.arrayBuffer()
      const src = await PDFDocument.load(buf)
      const pageCount = src.getPageCount()
      const out = []
      const toBase64 = (blob) => new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = reject; fr.readAsDataURL(blob) })
      for (let i=0;i<pageCount;i++) {
        const dst = await PDFDocument.create()
        const [copied] = await dst.copyPages(src, [i])
        dst.addPage(copied)
        const bytes = await dst.save()
        const blob = new Blob([bytes], { type: 'application/pdf' })
        out.push({ idx: i+1, blob, collaborator_id: '', selected: true })
      }
      // Auto-map no servidor usando nomes do PDF
      try {
        const pagesPayload = []
        for (const p of out) { pagesPayload.push({ data: await toBase64(p.blob) }) }
        const resp = await fetch('/api/holerites/auto-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetId: selectedSheetId, pages: pagesPayload }) })
        if (resp.ok) {
          const { mappings } = await resp.json()
          const mapped = out.map((p, idx) => ({ ...p, collaborator_id: mappings?.[idx]?.collaborator_id || '' }))
          setSlipPages(mapped)
        } else {
          setSlipPages(out)
        }
      } catch (_) {
        setSlipPages(out)
      }
    } catch (e) {
      alert(e.message || 'Falha ao processar PDF')
    } finally {
      setSlipLoading(false)
    }
  }

  async function onConfirmSlips() {
    if (!selectedSheetId) { alert('Selecione uma folha'); return }
    const picks = slipPages.filter(p => p.selected && p.collaborator_id)
    if (!picks.length) { alert('Selecione ao menos uma página e um colaborador'); return }
    try {
      setSlipLoading(true)
      // Convert to base64 and send to server to create entries
      const toBase64 = (blob) => new Promise((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(fr.result)
        fr.onerror = reject
        fr.readAsDataURL(blob)
      })
      const payloadPages = []
      for (const p of picks) {
        const dataUrl = await toBase64(p.blob)
        payloadPages.push({ collaborator_id: p.collaborator_id, data: dataUrl })
      }
      await fetch('/api/holerites/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(user?.id ? { 'x-actor-id': user.id } : {}), ...(user?.email ? { 'x-actor-email': user.email } : {}) },
        body: JSON.stringify({ sheetId: selectedSheetId, pages: payloadPages, overwrite: true }),
      }).then(async r => { if (!r.ok) { const t = await r.text(); throw new Error(t || 'Falha ao importar lançamentos do holerite') }})
      await loadSheet(selectedSheetId)
      setOpenSlip(false)
      setSlipPages([])
      alert('Holerites enviados')
    } catch (e) { alert(e.message || 'Falha ao enviar holerites') } finally { setSlipLoading(false) }
  }

  async function onDownloadHolerite(collaboratorId) {
    try {
      const url = await getHoleriteUrl(selectedSheetId, collaboratorId)
      if (!url) { alert('Holerite não encontrado'); return }
      window.open(url, '_blank')
    } catch (e) { alert(e.message || 'Falha ao baixar holerite') }
  }

  async function onRemoveHolerite(collaboratorId) {
    if (!selectedSheetId) return
    if (!confirm('Remover o holerite deste colaborador?')) return
    try {
      await deleteHolerite(selectedSheetId, collaboratorId)
      alert('Holerite removido')
    } catch (e) { alert(e.message || 'Falha ao remover holerite') }
  }

  async function onUploadSingleHolerite(collaboratorId, file) {
    if (!selectedSheetId || !file) return
    try {
      setUploadingHolerite(true)
      await uploadHolerite(selectedSheetId, collaboratorId, file)
      alert('Holerite enviado')
    } catch (e) {
      alert(e.message || 'Falha ao enviar holerite')
    } finally {
      setUploadingHolerite(false)
    }
  }

  async function loadSheet(sheetId) {
    if (!sheetId) { setItems([]); setEntriesByItem({}); return }
    try {
      const [its, ents] = await Promise.all([
        listPayrollSheetItems(sheetId),
        listPayrollEntriesForSheet(sheetId),
      ])
      setItems(its || [])
      const map = {}
      ;(ents || []).forEach(e => {
        if (!map[e.sheet_item_id]) map[e.sheet_item_id] = []
        map[e.sheet_item_id].push(e)
      })
      setEntriesByItem(map)

      // Verificar quais colaboradores possuem holerite armazenado para esta folha
      const checks = await Promise.all((its || []).map(async it => {
        try {
          const url = await getHoleriteUrl(sheetId, it.collaborator_id)
          return { collaborator_id: it.collaborator_id, has: !!url }
        } catch (_) {
          return { collaborator_id: it.collaborator_id, has: false }
        }
      }))
      const hasMap = {}
      checks.forEach(c => { hasMap[c.collaborator_id] = c.has })
      setHasHolerite(hasMap)
    } catch (e) {
      setError(e.message || 'Erro ao carregar itens da folha')
    }
  }

  useEffect(()=>{ loadBase() }, [])
  useEffect(()=>{ loadSheet(selectedSheetId) }, [selectedSheetId])

  const totalsByItem = useMemo(() => {
    const res = {}
    items.forEach(it => {
      const list = entriesByItem[it.id] || []
      const inc = list.filter(x => x.payroll_entry_types?.kind === 'in').reduce((s,x)=>s + Number(x.amount||0), 0)
      const out = list.filter(x => x.payroll_entry_types?.kind === 'out').reduce((s,x)=>s + Number(x.amount||0), 0)
      res[it.id] = { inc, out, total: inc - out }
    })
    return res
  }, [items, entriesByItem])

  const itemsSortedByName = useMemo(() => {
    return (items || []).slice().sort((a, b) => {
      const an = a.collaborators?.name || ''
      const bn = b.collaborators?.name || ''
      return an.localeCompare(bn, 'pt', { sensitivity: 'base' })
    })
  }, [items])

  async function openCreateSheet() {
    setOpenCreate(true); setSheetName(`Folha ${ymOf(new Date())}`); setSheetYearMonth(ymOf(new Date()))
    try {
      const cols = await listCollaboratorsSimple()
      const active = (cols||[]).filter(c => c.status !== 'inactive')
      setCollaborators(active)
      const initSel = {}
      active.forEach(c => { initSel[c.id] = true })
      setSelectedCols(initSel)
    } catch (e) { setError(e.message || 'Erro ao carregar colaboradores') }
  }

  async function onConfirmCreateSheet() {
    const selectedIds = Object.entries(selectedCols).filter(([,v])=>!!v).map(([k])=>k)
    if (!sheetName.trim() || selectedIds.length === 0) { alert('Informe um nome e selecione ao menos um colaborador.'); return }
    setSaving(true)
    try {
      const sheet = await createPayrollSheet(sheetName.trim(), sheetYearMonth, selectedIds)
      setOpenCreate(false)
      setSheetName('')
      await loadBase()
      setSelectedSheetId(sheet.id)
    } catch (e) { alert(e.message || 'Falha ao criar folha') }
    finally { setSaving(false) }
  }

  function toggleExpanded(itemId) { setExpanded(s => ({ ...s, [itemId]: !s[itemId] })) }

  function formatBRL(n) { return Number(n||0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
  function sortByKey(list) {
    const dir = orderDir === 'asc' ? 1 : -1
    return [...list].sort((a,b) => {
      const av = orderBy==='name' ? (a.collaborators?.name||'')
        : orderBy==='concent_id' ? (a.collaborators?.concent_id||'')
        : orderBy==='inc' ? (totalsByItem[a.id]?.inc||0)
        : orderBy==='out' ? (totalsByItem[a.id]?.out||0)
        : (totalsByItem[a.id]?.total||0)
      const bv = orderBy==='name' ? (b.collaborators?.name||'')
        : orderBy==='concent_id' ? (b.collaborators?.concent_id||'')
        : orderBy==='inc' ? (totalsByItem[b.id]?.inc||0)
        : orderBy==='out' ? (totalsByItem[b.id]?.out||0)
        : (totalsByItem[b.id]?.total||0)
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir
      return (av - bv) * dir
    })
  }
  const selectedSheet = useMemo(
    () => sheets.find(s => String(s.id) === String(selectedSheetId)) || null,
    [sheets, selectedSheetId],
  )
  const isClosed = !!selectedSheet?.closed_at
  const detailColSpan = canAdmin ? 6 : 5
  const filteredItems = useMemo(() => {
    const baseAll = items || []
    const myColId = profile?.collaborator_id || null
    const base = canAdmin ? baseAll : baseAll.filter(it => it.collaborator_id === myColId)
    const ql = q.trim().toLowerCase()
    const filt = ql ? base.filter(it => (it.collaborators?.name||'').toLowerCase().includes(ql)) : base
    return sortByKey(filt)
  }, [items, q, orderBy, orderDir, totalsByItem, canAdmin, profile])
  const grandTotal = useMemo(() => (items||[]).reduce((s, it) => s + (totalsByItem[it.id]?.total || 0), 0), [items, totalsByItem])

  function onExportBB() {
    if (!selectedSheetId || !selectedSheet) {
      alert('Selecione uma folha para exportar.')
      return
    }
    const bbItems = (items || []).filter(it => (it.collaborators?.bank_code || '').trim() === '001')
    if (!bbItems.length) {
      alert('Não há colaboradores com Banco 001 nesta folha.')
      return
    }

    try {
      const header = ['CPF', '', '', 'VALOR']
      const lines = [header.join(';')]

      bbItems.forEach(it => {
        const cpf = it.collaborators?.cpf || ''
        const totals = totalsByItem[it.id] || { total: 0 }
        const total = Number(totals.total || 0)
        const valor = total.toFixed(2) // 2 casas decimais
        const row = [cpf, '', '', valor].join(';')
        lines.push(row)
      })

      // Duplicar a última linha de dados para contornar problema de leitura no sistema de destino
      if (lines.length > 1) {
        const lastDataRow = lines[lines.length - 1]
        lines.push(lastDataRow)
      }

      const content = lines.join('\r\n')
      const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bb_${selectedSheet.year_month || 'folha'}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Erro ao exportar BB', e)
      alert(e.message || 'Falha ao exportar arquivo para o Banco do Brasil')
    }
  }

  function toggleOrder(key) {
    if (orderBy === key) setOrderDir(d => d==='asc'?'desc':'asc')
    else { setOrderBy(key); setOrderDir('asc') }
  }

  function openExportSheet() {
    if (!selectedSheetId) {
      alert('Selecione uma folha para exportar.')
      return
    }
    const today = formatDateBR(new Date())
    setExportNrDocto('')
    setExportIssueDate(today)
    setExportMoveDate(today)
    setExportDueDate(today)
    setOpenExport(true)
  }

  function onConfirmExport() {
    if (!selectedSheetId || !selectedSheet) {
      alert('Selecione uma folha para exportar.')
      return
    }
    if (!exportNrDocto.trim() || !exportIssueDate.trim() || !exportMoveDate.trim() || !exportDueDate.trim()) {
      alert('Preencha todos os campos para exportar a folha.')
      return
    }

    try {
      const baseItems = filteredItems || []
      if (!baseItems.length) {
        alert('Não há colaboradores na folha (ou no filtro atual) para exportar.')
        return
      }

      const header = 'Empresa;Filial;Emitente;Esp. Docto;Série;Nr. Docto;Parcela;Dt. Emissão;Dt. Movimento;Valor do Saldo;Dt. Vencto;Tipo Rec/Desp;Portador;Carteira;Histórico'
      const lines = [header]

      baseItems.forEach(it => {
        const col = it.collaborators
        const totals = totalsByItem[it.id] || { total: 0 }
        const total = Number(totals.total || 0)
        const saldo = total.toFixed(2) // 2 casas decimais, ponto como separador

        const row = [
          '1', // Empresa
          '1', // Filial
          col?.concent_id || '', // Emitente (ID Concent)
          'FP', // Esp. Docto
          'M', // Série
          exportNrDocto.trim(), // Nr. Docto
          '1', // Parcela
          exportIssueDate.trim(), // Dt. Emissão
          exportMoveDate.trim(), // Dt. Movimento
          saldo, // Valor do Saldo
          exportDueDate.trim(), // Dt. Vencto
          '301', // Tipo Rec/Desp
          '', // Portador
          '', // Carteira
          '', // Histórico
        ].map(csvEscape).join(';')

        lines.push(row)
      })

      const csv = lines.join('\r\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `folha_${selectedSheet.year_month || 'export'}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setOpenExport(false)
    } catch (e) {
      console.error('Erro ao exportar folha', e)
      alert(e.message || 'Falha ao exportar a folha')
    }
  }

  async function addEntry(itemId, form, setForm) {
    try {
      if (isClosed) { alert('Folha encerrada: não é possível lançar.'); return }
      if (!form.entry_type_id) return
      const raw = String(form.amount||'').replace('.', '').replace(',', '.')
      const amount = parseFloat(raw)
      if (!Number.isFinite(amount)) { alert('Informe um valor válido.'); return }
      const created = await createPayrollEntry(itemId, form.entry_type_id, amount, form.note || '')
      setEntriesByItem(m => ({ ...m, [itemId]: [...(m[itemId]||[]), created] }))
      setForm({ entry_type_id: '', amount: '', note: '' })
    } catch (e) { alert(e.message || 'Falha ao adicionar lançamento') }
  }

  async function removeEntry(itemId, entryId) {
    if (!confirm('Remover este lançamento?')) return
    try {
      if (isClosed) { alert('Folha encerrada: não é possível remover.'); return }
      await deletePayrollEntry(entryId)
      setEntriesByItem(m => ({ ...m, [itemId]: (m[itemId]||[]).filter(x => x.id !== entryId) }))
    } catch (e) { alert(e.message || 'Falha ao remover lançamento') }
  }

  async function onRenameSheet() {
    const s = selectedSheet
    if (!s) return
    const nn = prompt('Novo nome da folha:', s.name)
    if (!nn || !nn.trim()) return
    try {
      const updated = await updatePayrollSheet(s.id, { name: nn.trim() })
      setSheets(arr => arr.map(x => x.id===s.id ? updated : x))
    } catch (e) { alert(e.message || 'Falha ao renomear') }
  }

  async function onDeleteSheet() {
    const s = selectedSheet
    if (!s) return
    if (!confirm('Excluir esta folha e todos os seus lançamentos e holerites associados?')) return
    try {
      // cleanup holerites for this sheet
      try { await fetch('/api/holerites/cleanup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetId: s.id }) }) } catch (_) {}
      await deletePayrollSheet(s.id)
      await loadBase()
      setSelectedSheetId('')
      setItems([]); setEntriesByItem({})
    } catch (e) { alert(e.message || 'Falha ao excluir') }
  }

  async function onCloseSheet() {
    const s = selectedSheet
    if (!s) return
    if (!confirm('Encerrar a folha? Após encerrar, não será possível incluir/editar/excluir lançamentos.')) return
    try {
      const updated = await updatePayrollSheet(s.id, { closed_at: new Date().toISOString() })
      setSheets(arr => arr.map(x => x.id===s.id ? updated : x))
    } catch (e) { alert(e.message || 'Falha ao encerrar') }
  }

  async function loadImportPreview(sheetId, ymOverride) {
    try {
      setImportLoading(true)
      const target = (sheets||[]).find(s => s.id === sheetId)
      if (!target) { setImportPreview([]); setImportSel({}); return }
      const ym = ymOverride || target.year_month
      const { from, to } = firstLastOfYM(ym)
      const [fn, ov, asg, its] = await Promise.all([
        listShiftFunctions(),
        listShiftRateOverrides(ym),
        listShiftAssignments(from, to),
        listPayrollSheetItems(sheetId),
      ])
      const fnMap = {}
      ;(fn||[]).forEach(f => { fnMap[f.id] = f })
      const ovMap = {}
      ;(ov||[]).forEach(o => { ovMap[o.shift_function_id] = Number(o.value||0) })
      const totalsByCol = {}
      ;(asg||[]).forEach(a => {
        if (!a.remunerated) return
        const base = fnMap[a.shift_function_id]?.base_value || 0
        const val = ovMap[a.shift_function_id] ?? base
        const n = Number(val||0)
        totalsByCol[a.collaborator_id] = (totalsByCol[a.collaborator_id]||0) + n
      })
      const preview = (its||[]).map(it => ({
        item_id: it.id,
        collaborator_id: it.collaborator_id,
        name: it.collaborators?.name || '-',
        concent_id: it.collaborators?.concent_id || '-',
        total: Number(totalsByCol[it.collaborator_id]||0),
      }))
      const sel = {}
      preview.forEach(p => { sel[p.item_id] = p.total > 0 })
      setImportPreview(preview)
      setImportSel(sel)
    } finally {
      setImportLoading(false)
    }
  }

  function openImportSheet() {
    const sid = selectedSheetId || ''
    setImportSheetId(sid)
    const defYM = (sheets.find(s=>s.id===sid)?.year_month) || ymOf(new Date())
    setImportYearMonth(defYM)
    setOpenImport(true)
    if (sid) loadImportPreview(sid, defYM)
  }

  async function onConfirmImport() {
    const sid = importSheetId
    if (!sid) { alert('Selecione uma folha'); return }
    const pick = importPreview.filter(p => importSel[p.item_id])
    if (!pick.length) { alert('Selecione ao menos um colaborador'); return }
    try {
      setImportLoading(true)
      await Promise.all(pick.map(p => upsertPlantaoEntry(p.item_id, Number(p.total||0))))
      setOpenImport(false)
      await loadSheet(selectedSheetId)
    } catch (e) { alert(e.message || 'Falha ao importar') } finally { setImportLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex pt-2 items-center justify-between">
        <h1 className="text-sm md:text-2xl text-center font-semibold">Folha Mensal</h1>
        {canAdmin && (
          <div className="inline-flex items-center gap-2">
            <button onClick={openCreateSheet} className="text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white px-1 py-1">Criar Folha</button>
            <button onClick={openImportSheet} disabled={!selectedSheetId} className="text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-1 py-1 disabled:opacity-50">Importar Plantões</button>
            <button onClick={()=>setOpenSlip(true)} disabled={!selectedSheetId} className="text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-1 py-1 disabled:opacity-50">Importar Holerites</button>
            <button
              onClick={openExportSheet}
              disabled={!selectedSheetId}
              className="text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-1 py-1 disabled:opacity-50 inline-flex items-center justify-center gap-1"
            >
              <span className="hidden sm:inline">Exportar Folha</span>
              <Download className="size-4" />
            </button>
            <button
              onClick={onExportBB}
              disabled={!selectedSheetId}
              className="text-xs rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white px-1 py-1 disabled:opacity-50 inline-flex items-center justify-center gap-1"
            >
              <span className="hidden sm:inline">Exportar BB</span>
              <Download className="size-4" />
            </button>
          </div>
        )}
      </div>

      {error && <div className="text-red-600 bg-red-50 rounded-xl px-3 py-2 text-sm">{error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <select value={selectedSheetId} onChange={(e)=>setSelectedSheetId(e.target.value)} className="rounded-xl border border-neutral-200 px-3 py-2.5 min-w-64">
          <option value="">Selecione uma folha</option>
          {sheets.map(s => (<option key={s.id} value={s.id}>{s.name} ({s.year_month})</option>))}
        </select>
        {selectedSheetId && canAdmin && (
          <>
            <button onClick={onRenameSheet} className="px-3 py-2 text-xs rounded-lg border border-neutral-200">Editar nome</button>
            <button onClick={onCloseSheet} disabled={isClosed} className="px-3 py-2 text-xs rounded-lg border border-neutral-200 disabled:opacity-50">Encerrar folha</button>
            <button onClick={onDeleteSheet} className="px-3 py-2 text-xs rounded-lg border border-red-200 text-red-600">Excluir</button>
            <button onClick={openAddCollaborators} disabled={!selectedSheetId || isClosed} className="px-3 py-2 text-xs rounded-lg border border-neutral-200 disabled:opacity-50">Adicionar colaboradores</button>
            {isClosed && <span className="text-xs px-2 py-1 rounded bg-neutral-200/60">Encerrada</span>}
          </>
        )}
      </div>

      {selectedSheetId && (
        <div className="flex items-center gap-3">
          {canAdmin && (
            <div className="text-sm text-neutral-700 font-medium">Total geral: {formatBRL(grandTotal)}</div>
          )}
          <input placeholder="Filtrar por nome" value={q} onChange={(e)=>setQ(e.target.value)} className="mx-auto rounded-xl border border-neutral-200 px-3 py-2.5"/>
        </div>
      )}
      {!canAdmin && !profile?.collaborator_id && (
        <div className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">Seu usuário não está vinculado a um colaborador. Solicite ao administrador para associar seu perfil.</div>
      )}

      {selectedSheetId && (
        <>
          {/* Desktop: tabela com possível rolagem horizontal */}
          <div className="hidden md:block overflow-x-auto rounded-xl bg-white text-neutral-900">
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr>
                  <th className="py-2 cursor-pointer" onClick={()=>toggleOrder('concent_id')}>ID</th>
                  {canAdmin && (
                    <th className="py-2 cursor-pointer" onClick={()=>toggleOrder('name')}>Nome</th>
                  )}
                  <th className="py-2 cursor-pointer" onClick={()=>toggleOrder('inc')}>Recebimentos</th>
                  <th className="py-2 cursor-pointer" onClick={()=>toggleOrder('out')}>Descontos</th>
                  <th className="py-2 cursor-pointer" onClick={()=>toggleOrder('total')}>Total</th>
                  <th className="py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(it => {
                  const col = it.collaborators
                  const totals = totalsByItem[it.id] || { inc:0, out:0, total:0 }
                  const isBB = (col?.bank_code || '').trim() === '001'
                  const rowColor = isBB ? 'bg-amber-50 hover:bg-amber-100' : 'bg-green-50 hover:bg-green-100'
                  const hasSlip = !!hasHolerite[it.collaborator_id]
                  return (
                    <Fragment key={it.id}>
                      <tr onClick={()=>toggleExpanded(it.id)} className={`border-t border-neutral-200 cursor-pointer ${rowColor} text-neutral-900`}>
                        <td className="py-1 px-1">{col?.concent_id || '-'}</td>
                        {canAdmin && (
                          <td className="py-2 px-1 font-medium">{col?.name || '-'}</td>
                        )}
                        <td className="py-2 px-1">{formatBRL(totals.inc)}</td>
                        <td className="py-2 px-1">{formatBRL(totals.out)}</td>
                        <td className="py-2 px-1 font-semibold">{formatBRL(totals.total)}</td>
                        <td className="py-2 px-1">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={(e)=>{ e.stopPropagation(); if (hasSlip) onDownloadHolerite(it.collaborator_id) }}
                              disabled={!hasSlip}
                              className={
                                "w-7 h-7 grid place-items-center rounded-md text-white " +
                                (hasSlip ? 'bg-blue-600 hover:bg-blue-700' : 'bg-neutral-300 cursor-not-allowed')
                              }
                              title="Holerite"
                            >
                              <FileDown className="size-4" />
                            </button>
                            {canAdmin && (
                              <label
                                className={`w-7 h-7 grid place-items-center rounded-md bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer ${uploadingHolerite ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title="Incluir Holerite"
                                onClick={(e)=>e.stopPropagation()}
                              >
                                <Upload className="size-4" />
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  className="hidden"
                                  disabled={uploadingHolerite}
                                  onChange={async (e) => {
                                    const file = e.target.files && e.target.files[0]
                                    if (!file) return
                                    await onUploadSingleHolerite(it.collaborator_id, file)
                                    e.target.value = ''
                                  }}
                                />
                              </label>
                            )}
                            {canAdmin && (
                              <>
                                <button onClick={(e)=>{ e.stopPropagation(); onRemoveHolerite(it.collaborator_id) }} className="w-7 h-7 grid place-items-center rounded-md bg-red-600 hover:bg-red-700 text-white" title="Remover Holerite">
                                  <Trash2 className="size-4" />
                                </button>
                                <button onClick={(e)=>{ e.stopPropagation(); onRemoveItemFromSheet(it.collaborator_id) }} className="w-7 h-7 grid place-items-center rounded-md bg-amber-500 hover:bg-amber-600 text-white" title="Retirar da Folha">
                                  <UserMinus className="size-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded[it.id] && (
                        <tr>
                          <td colSpan={detailColSpan} className="bg-neutral-50 p-3 text-neutral-900">
                            <div className="space-y-3">
                              <div className="text-sm text-neutral-500">Lançamentos</div>
                              <div className="space-y-1 pl-[10%] md:pl-[40%]">
                                {(entriesByItem[it.id]||[]).slice().sort((a,b)=>{
                                  const ka = a.payroll_entry_types?.kind === 'in' ? 0 : 1
                                  const kb = b.payroll_entry_types?.kind === 'in' ? 0 : 1
                                  return ka - kb
                                }).map(en => (
                                  <div key={en.id} className={"flex items-center justify-between rounded-lg border border-neutral-200 text-neutral-900 px-2 py-1" + (en.payroll_entry_types?.kind==='out' ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50')}>
                                    <div className="text-xs">
                                      <span className="font-medium">{en.payroll_entry_types?.name || '-'}</span>
                                      <span className="ml-2 text-neutral-500">{en.note || ''}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className={"text-xs " + (en.payroll_entry_types?.kind==='out' ? 'text-red-600' : 'text-emerald-600')}>
                                        {en.payroll_entry_types?.kind==='out' ? '-' : '+'} {formatBRL(en.amount)}
                                      </div>
                                      {canAdmin && !isClosed && (
                                        <button onClick={()=>removeEntry(it.id, en.id)} className="px-2 py-1 text-xs rounded-lg border border-red-200 text-red-600">X</button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {canAdmin && !isClosed && <AddEntryForm types={types} onSubmit={(f)=>addEntry(it.id, f.form, f.setForm)} />}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: cartões por colaborador, sem rolagem lateral */}
          <div className="md:hidden space-y-3">
            {filteredItems.map(it => {
              const col = it.collaborators
              const totals = totalsByItem[it.id] || { inc:0, out:0, total:0 }
              const isBB = (col?.bank_code || '').trim() === '001'
              const baseColor = isBB ? 'bg-amber-50' : 'bg-green-50'
              const hasSlip = !!hasHolerite[it.collaborator_id]
              return (
                <div
                  key={it.id}
                  className={`rounded-xl border border-neutral-200 ${baseColor} text-neutral-900`}
                >
                  <button
                    type="button"
                    onClick={()=>toggleExpanded(it.id)}
                    className="w-full text-left px-3 pt-2 pb-1"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{col?.name || '-'}</div>
                        <div className="text-[11px] text-neutral-600">ID: {col?.concent_id || '-'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] text-neutral-600">Total</div>
                        <div className="text-sm font-semibold">{formatBRL(totals.total)}</div>
                      </div>
                    </div>
                  </button>
                  <div className="px-3 pb-2 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-neutral-700">
                      <div>Recebimentos: <span className="font-medium text-emerald-700">{formatBRL(totals.inc)}</span></div>
                      <div>Descontos: <span className="font-medium text-red-600">{formatBRL(totals.out)}</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={()=>{ if (hasSlip) onDownloadHolerite(it.collaborator_id) }}
                        disabled={!hasSlip}
                        className={
                          "w-8 h-8 grid place-items-center rounded-md text-white " +
                          (hasSlip ? 'bg-blue-600 hover:bg-blue-700' : 'bg-neutral-300 cursor-not-allowed')
                        }
                        title="Holerite"
                      >
                        <FileDown className="size-4" />
                      </button>
                      {canAdmin && (
                        <label
                          className={`w-8 h-8 grid place-items-center rounded-md bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer ${uploadingHolerite ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Incluir Holerite"
                        >
                          <Upload className="size-4" />
                          <input
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            disabled={uploadingHolerite}
                            onChange={async (e) => {
                              const file = e.target.files && e.target.files[0]
                              if (!file) return
                              await onUploadSingleHolerite(it.collaborator_id, file)
                              e.target.value = ''
                            }}
                          />
                        </label>
                      )}
                      {canAdmin && (
                        <>
                          <button onClick={()=>onRemoveHolerite(it.collaborator_id)} className="w-8 h-8 grid place-items-center rounded-md bg-red-600 hover:bg-red-700 text-white" title="Remover Holerite">
                            <Trash2 className="size-4" />
                          </button>
                          <button onClick={()=>onRemoveItemFromSheet(it.collaborator_id)} className="w-8 h-8 grid place-items-center rounded-md bg-amber-500 hover:bg-amber-600 text-white" title="Retirar da Folha">
                            <UserMinus className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {expanded[it.id] && (
                    <div className="px-3 pb-3 border-t border-neutral-200 bg-neutral-50">
                      <div className="text-[11px] text-neutral-500 mt-2 mb-1">Lançamentos</div>
                      <div className="space-y-1">
                        {(entriesByItem[it.id]||[]).slice().sort((a,b)=>{
                          const ka = a.payroll_entry_types?.kind === 'in' ? 0 : 1
                          const kb = b.payroll_entry_types?.kind === 'in' ? 0 : 1
                          return ka - kb
                        }).map(en => (
                          <div
                            key={en.id}
                            className={"flex items-center justify-between rounded-lg border border-neutral-200 px-2 py-1 " + (en.payroll_entry_types?.kind==='out' ? 'text-red-600 bg-red-50' : 'text-emerald-700 bg-emerald-50')}
                          >
                            <span className="text-[11px] font-medium truncate mr-2">{en.payroll_entry_types?.name || '-'}</span>
                            <div className="flex items-center gap-2">
                              <span className={"text-[11px] font-semibold " + (en.payroll_entry_types?.kind==='out' ? 'text-red-600' : 'text-emerald-700')}>
                                {en.payroll_entry_types?.kind==='out' ? '-' : '+'} {formatBRL(en.amount)}
                              </span>
                              {canAdmin && !isClosed && (
                                <button onClick={()=>removeEntry(it.id, en.id)} className="px-2 py-1 text-[10px] rounded-lg border border-red-200 text-red-600">X</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {canAdmin && !isClosed && (
                        <div className="mt-2">
                          <AddEntryForm types={types} onSubmit={(f)=>addEntry(it.id, f.form, f.setForm)} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {openCreate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-2xl p-6 border bg-neutral-50 text-neutral-900 border-neutral-200">
            <h2 className="text-lg font-semibold mb-4">Criar Folha</h2>
            <div className="space-y-4">
              <input placeholder="Nome da folha" value={sheetName} onChange={(e)=>setSheetName(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-3 py-2.5"/>
              <label className="text-sm flex items-center gap-2">
                <span className="text-neutral-500">Mês</span>
                <input type="month" value={sheetYearMonth} onChange={(e)=>setSheetYearMonth(e.target.value)} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
              </label>
              <div className="text-sm text-neutral-500">Colaboradores</div>
              <div className="max-h-64 overflow-y-auto rounded-xl border p-3 bg-white border-neutral-200">
                {collaborators.map(c => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!selectedCols[c.id]} onChange={(e)=>setSelectedCols(s=>({ ...s, [c.id]: e.target.checked }))} />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={()=>setOpenCreate(false)} className="px-3 py-2 text-xs rounded-lg border border-neutral-200">Cancelar</button>
                <button onClick={onConfirmCreateSheet} disabled={saving} className="px-3 py-2 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50">Criar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {openImport && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-4xl rounded-2xl p-6 bg-neutral-50 border border-neutral-200">
            <h2 className="text-lg font-semibold mb-4">Importar Plantões</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-500">Enviar para</span>
                <select value={importSheetId} onChange={async (e)=>{ const v=e.target.value; setImportSheetId(v); if (v) await loadImportPreview(v, importYearMonth) }} className="rounded-xl border border-neutral-200 px-3 py-2.5 min-w-64">
                  <option value="">Selecione uma folha</option>
                  {sheets.map(s => (<option key={s.id} value={s.id}>{s.name} ({s.year_month})</option>))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-500">Mês a importar</span>
                <input type="month" value={importYearMonth} onChange={async (e)=>{ const v=e.target.value; setImportYearMonth(v); if (importSheetId) await loadImportPreview(importSheetId, v) }} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
              </div>
              {importSheetId && (
                <div className="max-h-80 overflow-y-auto rounded-xl border border-neutral-200">
                  <table className="w-full text-sm">
                    <thead className="text-left text-neutral-500">
                      <tr>
                        <th className="py-2 w-10"></th>
                        <th className="py-2">ID Concent</th>
                        <th className="py-2">Colaborador</th>
                        <th className="py-2">Total Plantões</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map(p => (
                        <tr key={p.item_id} className="border-t border-neutral-200">
                          <td className="py-2 text-center"><input type="checkbox" checked={!!importSel[p.item_id]} onChange={(e)=>setImportSel(s=>({ ...s, [p.item_id]: e.target.checked }))}/></td>
                          <td className="py-2">{p.concent_id}</td>
                          <td className="py-2">{p.name}</td>
                          <td className="py-2">{formatBRL(p.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={()=>setOpenImport(false)} className="px-3 py-2 text-xs rounded-lg border border-neutral-200">Cancelar</button>
                <button onClick={onConfirmImport} disabled={importLoading || !importSheetId} className="px-3 py-2 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">Importar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {openExport && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl p-6 border bg-neutral-50 text-neutral-900 border-neutral-200">
            <h2 className="text-lg font-semibold mb-4">Exportar Folha (CSV)</h2>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block mb-1 text-neutral-600">Nr. Docto</label>
                <input
                  value={exportNrDocto}
                  onChange={(e)=>setExportNrDocto(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2.5"
                  placeholder="Número do documento"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block mb-1 text-neutral-600">Dt. Emissão</label>
                  <input
                    value={exportIssueDate}
                    onChange={(e)=>setExportIssueDate(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2.5"
                    placeholder="dd/mm/aaaa"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-neutral-600">Dt. Movimento</label>
                  <input
                    value={exportMoveDate}
                    onChange={(e)=>setExportMoveDate(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2.5"
                    placeholder="dd/mm/aaaa"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-neutral-600">Dt. Vencto</label>
                  <input
                    value={exportDueDate}
                    onChange={(e)=>setExportDueDate(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2.5"
                    placeholder="dd/mm/aaaa"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={()=>setOpenExport(false)}
                  className="px-3 py-2 text-xs rounded-lg border border-neutral-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={onConfirmExport}
                  className="px-3 py-2 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Exportar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {openSlip && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-5xl rounded-2xl p-6 border bg-neutral-50 text-neutral-900 border-neutral-200">
            <h2 className="text-lg font-semibold mb-4">Importar Holerites (PDF único)</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input type="file" accept="application/pdf" onChange={(e)=>onChooseHolerites(e.target.files?.[0])} />
                <button type="button" onClick={async ()=>{ try { const r = await fetch('/holerites.pdf'); if (!r.ok) throw new Error('Arquivo de exemplo não encontrado em /holerites.pdf'); const b = await r.blob(); await onChooseHolerites(b) } catch(e){ alert(e.message || 'Falha ao carregar exemplo') } }} className="px-3 py-2 text-xs rounded-lg border border-neutral-200">Carregar exemplo</button>
              </div>
              {slipPages.length>0 && (
                <div className="max-h-[60vh] overflow-y-auto rounded-xl border bg-white border-neutral-200">
                  <table className="w-full text-sm">
                    <thead className="text-left text-neutral-500">
                      <tr>
                        <th className="py-2 w-10"></th>
                        <th className="py-2 w-16">Página</th>
                        <th className="py-2">Colaborador</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slipPages.map((p,idx)=>(
                        <tr key={idx} className="border-t border-neutral-200">
                          <td className="py-2 text-center"><input type="checkbox" checked={p.selected} onChange={(e)=>setSlipPages(arr=>arr.map((x,i)=>i===idx?{...x,selected:e.target.checked}:x))}/></td>
                          <td className="py-2">{p.idx}</td>
                          <td className="py-2">
                            <select value={p.collaborator_id} onChange={(e)=>setSlipPages(arr=>arr.map((x,i)=>i===idx?{...x,collaborator_id:e.target.value}:x))} className={`rounded-xl border border-neutral-200 px-2 py-1 min-w-64 ${p.collaborator_id ? 'bg-green-100' : ''}`}>
                              <option value="">Selecione</option>
                              {itemsSortedByName.map(it => (
                                <option key={it.collaborator_id} value={it.collaborator_id}>{it.collaborators?.name} — {it.collaborators?.concent_id}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={()=>{setOpenSlip(false); setSlipPages([])}} className="px-3 py-2 text-xs rounded-lg border border-neutral-200">Cancelar</button>
                <button onClick={onConfirmSlips} disabled={slipLoading || !slipPages.length} className="px-3 py-2 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50">Enviar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {openAddCols && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-2xl p-6 border bg-neutral-50 text-neutral-900 border-neutral-200">
            <h2 className="text-lg font-semibold mb-4">Adicionar colaboradores à folha</h2>
            <div className="space-y-3">
              <div className="text-sm text-neutral-500">Selecione os colaboradores que deseja incluir</div>
              <div className="max-h-80 overflow-y-auto rounded-xl border p-3 bg-white border-neutral-200">
                {addLoading && <div className="text-sm text-neutral-500">Carregando...</div>}
                {!addLoading && addCandidates.length === 0 && (
                  <div className="text-sm text-neutral-500">Nenhum colaborador disponível</div>
                )}
                {!addLoading && addCandidates.map(c => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!addSel[c.id]} onChange={(e)=>setAddSel(s=>({ ...s, [c.id]: e.target.checked }))} />
                    <span>{c.name} — {c.concent_id}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={()=>{ setOpenAddCols(false); setAddCandidates([]); setAddSel({}) }} className="px-3 py-2 text-xs rounded-lg border border-neutral-200">Cancelar</button>
                <button onClick={onConfirmAddCollaborators} disabled={addLoading || !addCandidates.length} className="px-3 py-2 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50">Adicionar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AddEntryForm({ types, onSubmit }) {
  const [form, setForm] = useState({ entry_type_id: '', amount: '', note: '' })
  return (
    <form
      onSubmit={(e)=>{ e.preventDefault(); onSubmit({ form, setForm }) }}
      className="flex flex-wrap items-center gap-2"
    >
      <select
        value={form.entry_type_id}
        onChange={(e)=>setForm(f=>({ ...f, entry_type_id: e.target.value }))}
        className="rounded-xl border border-neutral-200 px-3 py-2.5 w-full sm:w-auto"
      >
        <option value="">Tipo</option>
        {types.map(t => (
          <option key={t.id} value={t.id}>{t.name} ({t.kind==='out'?'desconto':'recebimento'})</option>
        ))}
      </select>
      <input
        placeholder="Observação"
        value={form.note}
        onChange={(e)=>setForm(f=>({ ...f, note: e.target.value }))}
        className="rounded-xl border border-neutral-200 px-3 py-2.5 flex-1 min-w-[120px]"
      />
      <input
        placeholder="Valor"
        value={form.amount}
        onChange={(e)=>setForm(f=>({ ...f, amount: e.target.value }))}
        className="rounded-xl border border-neutral-200 px-3 py-2.5 w-28 sm:w-32"
        inputMode="decimal"
      />
      <button
        type="submit"
        className="text-xs rounded-lg border border-neutral-200 px-3 py-2"
      >
        Adicionar
      </button>
    </form>
  )
}
