import { useEffect, useMemo, useState } from 'react'
import { listCollaboratorsSimple, listPayrollEntryTypes, listPayrollSheets, createPayrollSheet, listPayrollSheetItems, listPayrollEntriesForSheet, createPayrollEntry, deletePayrollEntry, updatePayrollSheet, deletePayrollSheet, upsertPlantaoEntry, listShiftFunctions, listShiftAssignments, listShiftRateOverrides } from '../lib/db'

function ymOf(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}` }
function parseYM(ym) { const [y,m] = String(ym||'').split('-').map(Number); return { y, m } }
function firstLastOfYM(ym) { const { y, m } = parseYM(ym); if (!y || !m) return { from: null, to: null }; const from = new Date(y, m-1, 1); const to = new Date(y, m, 0); const pad = (n)=>String(n).padStart(2,'0'); return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(to.getDate())}` } }

export default function Payroll() {
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
  const selectedSheet = useMemo(() => sheets.find(s=>s.id===selectedSheetId) || null, [sheets, selectedSheetId])
  const isClosed = !!selectedSheet?.closed_at
  const filteredItems = useMemo(() => {
    const base = items || []
    const ql = q.trim().toLowerCase()
    const filt = ql ? base.filter(it => (it.collaborators?.name||'').toLowerCase().includes(ql)) : base
    return sortByKey(filt)
  }, [items, q, orderBy, orderDir, totalsByItem])

  function toggleOrder(key) {
    if (orderBy === key) setOrderDir(d => d==='asc'?'desc':'asc')
    else { setOrderBy(key); setOrderDir('asc') }
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
    if (!confirm('Excluir esta folha e todos os seus lançamentos?')) return
    try {
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Folha Mensal</h1>
        <div className="inline-flex items-center gap-2">
          <button onClick={openCreateSheet} className="text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white px-3 py-2">Criar Folha</button>
          <button onClick={openImportSheet} disabled={!selectedSheetId} className="text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 disabled:opacity-50">Importar Plantões</button>
        </div>
      </div>

      {error && <div className="text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30 rounded-xl px-3 py-2 text-sm">{error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <select value={selectedSheetId} onChange={(e)=>setSelectedSheetId(e.target.value)} className="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2.5 min-w-64">
          <option value="">Selecione uma folha</option>
          {sheets.map(s => (<option key={s.id} value={s.id}>{s.name} ({s.year_month})</option>))}
        </select>
        {selectedSheetId && (
          <>
            <button onClick={onRenameSheet} className="px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800">Editar nome</button>
            <button onClick={onCloseSheet} disabled={isClosed} className="px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 disabled:opacity-50">Encerrar folha</button>
            <button onClick={onDeleteSheet} className="px-3 py-2 text-xs rounded-lg border border-red-200 text-red-600 dark:border-red-900">Excluir</button>
            {isClosed && <span className="text-xs px-2 py-1 rounded bg-neutral-200/60 dark:bg-neutral-800">Encerrada</span>}
          </>
        )}
        <input placeholder="Filtrar por nome" value={q} onChange={(e)=>setQ(e.target.value)} className="ml-auto rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2.5"/>
      </div>

      {selectedSheetId && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="py-2 cursor-pointer" onClick={()=>toggleOrder('concent_id')}>ID Concent</th>
                <th className="py-2 cursor-pointer" onClick={()=>toggleOrder('name')}>Nome</th>
                <th className="py-2 cursor-pointer" onClick={()=>toggleOrder('inc')}>Recebimentos</th>
                <th className="py-2 cursor-pointer" onClick={()=>toggleOrder('out')}>Descontos</th>
                <th className="py-2 cursor-pointer" onClick={()=>toggleOrder('total')}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(it => {
                const col = it.collaborators
                const totals = totalsByItem[it.id] || { inc:0, out:0, total:0 }
                return (
                  <>
                    <tr key={it.id} className="border-t border-neutral-200 dark:border-neutral-800 cursor-pointer" onClick={()=>toggleExpanded(it.id)}>
                      <td className="py-2">{col?.concent_id || '-'}</td>
                      <td className="py-2 font-medium">{col?.name || '-'}</td>
                      <td className="py-2">{formatBRL(totals.inc)}</td>
                      <td className="py-2">{formatBRL(totals.out)}</td>
                      <td className="py-2 font-semibold">{formatBRL(totals.total)}</td>
                    </tr>
                    {expanded[it.id] && (
                      <tr>
                        <td colSpan={5} className="bg-neutral-50 dark:bg-neutral-900 p-3">
                          <div className="space-y-3">
                            <div className="text-sm text-neutral-500">Lançamentos</div>
                            <div className="space-y-1" style={{ paddingLeft: '40%' }}>
                              {(entriesByItem[it.id]||[]).slice().sort((a,b)=>{
                                const ka = a.payroll_entry_types?.kind === 'in' ? 0 : 1
                                const kb = b.payroll_entry_types?.kind === 'in' ? 0 : 1
                                return ka - kb
                              }).map(en => (
                                <div key={en.id} className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-800 px-2 py-1">
                                  <div className="text-xs">
                                    <span className="font-medium">{en.payroll_entry_types?.name || '-'}</span>
                                    <span className="ml-2 text-neutral-500">{en.note || ''}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className={"text-xs " + (en.payroll_entry_types?.kind==='out' ? 'text-red-600' : 'text-green-600')}>
                                      {en.payroll_entry_types?.kind==='out' ? '-' : '+'} {formatBRL(en.amount)}
                                    </div>
                                    {!isClosed && (
                                      <button onClick={()=>removeEntry(it.id, en.id)} className="px-2 py-1 text-xs rounded-lg border border-red-200 text-red-600 dark:border-red-900">X</button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                            {!isClosed && <AddEntryForm types={types} onSubmit={(f)=>addEntry(it.id, f.form, f.setForm)} />}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {openCreate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-2xl p-6 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <h2 className="text-lg font-semibold mb-4">Criar Folha</h2>
            <div className="space-y-4">
              <input placeholder="Nome da folha" value={sheetName} onChange={(e)=>setSheetName(e.target.value)} className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2.5"/>
              <label className="text-sm flex items-center gap-2">
                <span className="text-neutral-500">Mês</span>
                <input type="month" value={sheetYearMonth} onChange={(e)=>setSheetYearMonth(e.target.value)} className="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2.5"/>
              </label>
              <div className="text-sm text-neutral-500">Colaboradores</div>
              <div className="max-h-64 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
                {collaborators.map(c => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!selectedCols[c.id]} onChange={(e)=>setSelectedCols(s=>({ ...s, [c.id]: e.target.checked }))} />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={()=>setOpenCreate(false)} className="px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800">Cancelar</button>
                <button onClick={onConfirmCreateSheet} disabled={saving} className="px-3 py-2 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50">Criar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {openImport && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-4xl rounded-2xl p-6 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <h2 className="text-lg font-semibold mb-4">Importar Plantões</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-500">Enviar para</span>
                <select value={importSheetId} onChange={async (e)=>{ const v=e.target.value; setImportSheetId(v); if (v) await loadImportPreview(v, importYearMonth) }} className="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2.5 min-w-64">
                  <option value="">Selecione uma folha</option>
                  {sheets.map(s => (<option key={s.id} value={s.id}>{s.name} ({s.year_month})</option>))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-500">Mês a importar</span>
                <input type="month" value={importYearMonth} onChange={async (e)=>{ const v=e.target.value; setImportYearMonth(v); if (importSheetId) await loadImportPreview(importSheetId, v) }} className="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2.5"/>
              </div>
              {importSheetId && (
                <div className="max-h-80 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
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
                        <tr key={p.item_id} className="border-t border-neutral-200 dark:border-neutral-800">
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
                <button onClick={()=>setOpenImport(false)} className="px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800">Cancelar</button>
                <button onClick={onConfirmImport} disabled={importLoading || !importSheetId} className="px-3 py-2 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50">Importar</button>
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
    <form onSubmit={(e)=>{ e.preventDefault(); onSubmit({ form, setForm }) }} className="flex flex-wrap items-center gap-2">
      <select value={form.entry_type_id} onChange={(e)=>setForm(f=>({ ...f, entry_type_id: e.target.value }))} className="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2.5">
        <option value="">Tipo</option>
        {types.map(t => <option key={t.id} value={t.id}>{t.name} ({t.kind==='out'?'desconto':'recebimento'})</option>)}
      </select>
      <input placeholder="Valor" value={form.amount} onChange={(e)=>setForm(f=>({ ...f, amount: e.target.value }))} className="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2.5 w-40" inputMode="decimal"/>
      <input placeholder="Observação" value={form.note} onChange={(e)=>setForm(f=>({ ...f, note: e.target.value }))} className="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2.5 flex-1"/>
      <button type="submit" className="text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2">Adicionar</button>
    </form>
  )
}
