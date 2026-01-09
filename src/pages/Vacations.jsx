import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { listVacations, createVacation, updateVacation, deleteVacation, listCollaboratorsSimple } from '../lib/db'
import { FileDown, Pencil, Trash2 } from 'lucide-react'

function ymdParts(s) {
  if (!s) return null
  const [y, m, d] = String(s).split('-').map(Number)
  if (!y || !m || !d) return null
  return { y, m, d }
}
function dateFromYMD(s) {
  const p = ymdParts(s)
  if (!p) return null
  return new Date(p.y, p.m - 1, p.d)
}
function formatDateBR(s) {
  const p = ymdParts(s)
  if (!p) return ''
  return String(p.d).padStart(2, '0') + '/' + String(p.m).padStart(2, '0') + '/' + p.y
}

function formatBRL(n) {
  if (n === null || n === undefined) return '-'
  const v = Number(n)
  if (isNaN(v)) return '-'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function parseBRLToNumber(text) {
  if (text === null || text === undefined) return null
  const s = String(text).trim().replace(/\s+/g, '')
  if (!s) return null
  // Accept both comma and dot as decimal separator
  const normalized = s.replace(/\./g, '').replace(',', '.')
  const v = parseFloat(normalized)
  return isNaN(v) ? null : v
}

function groupByYear(vs) {
  const out = {}
  ;(vs||[]).forEach(v => {
    const p = ymdParts(v.start_date)
    const y = p ? p.y : new Date(v.start_date).getFullYear()
    if (!out[y]) out[y] = []
    out[y].push(v)
  })
  const years = Object.keys(out).map(Number).sort((a,b)=>b-a)
  return { years, byYear: out }
}

export default function Vacations() {
  const { role, profile } = useAuth()
  const canAdmin = role === 'admin' || role === 'super' || role === 'gestor-plantoes'

  const [q, setQ] = useState('')
  const [vacations, setVacations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [collabs, setCollabs] = useState([])

  const [form, setForm] = useState({ collaborator_id: '', start_date: '', end_date: '', period: '', remuneration: '' })
  const [file, setFile] = useState(null)
  const [hasReceipt, setHasReceipt] = useState(false)

  const onlyMine = role === 'user'
  const myColId = profile?.collaborator_id || null

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [vs, cs] = await Promise.all([
        listVacations({ onlyMine, myCollaboratorId: myColId }),
        canAdmin ? listCollaboratorsSimple() : Promise.resolve([]),
      ])
      setVacations(vs || [])
      setCollabs((cs||[]).filter(c => c.status !== 'inactive'))
    } catch (e) {
      setError(e.message || 'Erro ao carregar férias')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [role, profile])

  const filtered = useMemo(() => {
    const text = (q || '').trim().toLowerCase()
    if (!text) return vacations
    return (vacations||[]).filter(v => {
      const name = (v.collaborators?.name || '').toLowerCase()
      const conc = (v.collaborators?.concent_id || '').toLowerCase()
      const per = (v.period || '').toLowerCase()
      return name.includes(text) || conc.includes(text) || per.includes(text)
    })
  }, [q, vacations])

  function openCreate() {
    setEditing(null)
    setForm({ collaborator_id: '', start_date: '', end_date: '', period: '', remuneration: '' })
    setFile(null)
    setHasReceipt(false)
    setModalOpen(true)
  }
  async function openEdit(v) {
    setEditing(v)
    setForm({
      collaborator_id: v.collaborator_id,
      start_date: v.start_date,
      end_date: v.end_date,
      period: v.period || '',
      remuneration: v.remuneration ?? '',
    })
    setFile(null)
    setModalOpen(true)
    setHasReceipt(false)
    try {
      const r = await fetch(`/api/vacations/url?vacationId=${v.id}`)
      if (r.ok) {
        const j = await r.json()
        setHasReceipt(!!j?.url)
      }
    } catch (_) {}
  }

  const days = useMemo(() => {
    if (!form.start_date || !form.end_date) return ''
    const s = dateFromYMD(form.start_date)
    const e = dateFromYMD(form.end_date)
    if (!s || !e) return ''
    const d = Math.max(1, Math.round((e - s)/86400000) + 1)
    return d
  }, [form.start_date, form.end_date])

  async function save() {
    if (!form.collaborator_id || !form.start_date || !form.end_date) {
      alert('Selecione colaborador, data de saída e data de retorno')
      return
    }
    try {
      const remNumber = parseBRLToNumber(form.remuneration)
      const payload = { ...form, remuneration: remNumber }
      let rec
      if (editing) {
        rec = await updateVacation(editing.id, payload)
      } else {
        rec = await createVacation(payload)
      }
      if (file) {
        const b64 = await readAsBase64(file)
        const r = await fetch('/api/vacations/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vacationId: rec.id, fileData: b64, contentType: file.type || 'application/pdf' }),
        })
        if (!r.ok) throw new Error(await r.text())
        setHasReceipt(true)
      }
      setModalOpen(false)
      setEditing(null)
      setForm({ collaborator_id: '', start_date: '', end_date: '', period: '', remuneration: '' })
      setFile(null)
      await load()
    } catch (e) {
      alert(e.message || 'Falha ao salvar')
    }
  }

  async function remove(v) {
    if (!confirm('Remover este registro de férias?')) return
    try {
      await deleteVacation(v.id)
      await load()
    } catch (e) {
      alert(e.message || 'Falha ao remover')
    }
  }

  function collaboratorById(id) { return (collabs || []).find(c => String(c.id) === String(id)) || null }
  const selectedCollab = collaboratorById(form.collaborator_id)

  async function downloadReceipt(vacationId) {
    try {
      const r = await fetch(`/api/vacations/url?vacationId=${vacationId}`)
      if (!r.ok) throw new Error('Falha ao gerar link')
      const j = await r.json()
      if (j?.url) window.open(j.url, '_blank')
      else alert('Recibo não disponível')
    } catch (e) {
      alert(e.message || 'Falha ao baixar recibo')
    }
  }

  async function removeReceipt() {
    if (!editing) return
    if (!confirm('Remover o recibo anexado a estas férias?')) return
    try {
      const r = await fetch('/api/vacations/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacationId: editing.id }),
      })
      if (!r.ok) throw new Error(await r.text())
      setHasReceipt(false)
      setFile(null)
      alert('Recibo removido')
    } catch (e) {
      alert(e.message || 'Falha ao remover recibo')
    }
  }

  const { years, byYear } = useMemo(() => groupByYear(vacations), [vacations])

  function computeVacationDays(v) {
    if (v == null) return ''
    if (v.days !== undefined && v.days !== null) return v.days
    const s = dateFromYMD(v.start_date)
    const e = dateFromYMD(v.end_date)
    if (!s || !e) return ''
    const d = Math.max(1, Math.round((e - s) / 86400000) + 1)
    return d
  }

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Férias</h1>
        {canAdmin && (
          <button onClick={openCreate} className="px-2 py-1 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">Nova Férias</button>
        )}
      </div>
      <div className="md:hidden">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Buscar por nome, ID Concent ou período" className="w-full rounded-xl border border-neutral-200 px-2 py-1 text-xs" />
      </div>
      <div className="hidden md:flex items-center">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Buscar por nome, ID Concent ou período" className="rounded-xl border border-neutral-200 px-3 py-2 text-sm w-72" />
      </div>

      {error && (
        <div className="text-red-600 bg-red-50 rounded-xl px-3 py-2 text-sm">{error}</div>
      )}

      {onlyMine ? (
        <div className="space-y-2">
          {filtered.map(v => (
            <div key={v.id} className="rounded-xl border border-neutral-200 p-3 flex items-center justify-between hover:bg-neutral-50 transition-colors">
              <div className="space-y-1">
                <div className="text-sm font-semibold">
                  De {formatDateBR(v.start_date)} a {formatDateBR(v.end_date)} ({computeVacationDays(v)} dias)
                </div>
                <div className="text-xs text-neutral-500">Período: {v.period || '-'} | Remuneração: {formatBRL(v.remuneration)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="w-7 h-7 grid place-items-center rounded-md bg-blue-600 hover:bg-blue-700 text-white" onClick={()=>downloadReceipt(v.id)} title="Recibo">
                  <FileDown className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {groupByYear(filtered).years.map(y => (
            <div key={y} className="space-y-2">
              <div className="text-sm font-semibold text-neutral-600">{y}</div>
              <div className="hidden md:grid grid-cols-12 gap-2 text-xs text-neutral-500">
                <div className="col-span-2">ID Concent</div>
                <div className="col-span-3">Colaborador</div>
                <div className="col-span-1">Qtd Dias</div>
                <div className="col-span-2">Saída</div>
                <div className="col-span-2">Retorno</div>
                <div className="col-span-1">Remuneração</div>
                <div className="col-span-1 text-right pr-1">Ações</div>
              </div>
              <div className="space-y-2">
                {(groupByYear(filtered).byYear[y]||[]).map(v => (
                  <div key={v.id} className="rounded-xl border border-neutral-200 p-3 grid grid-cols-1 md:grid-cols-12 gap-2 items-center hover:bg-neutral-50 transition-colors">
                    <div className="md:col-span-2 px-2 text-sm font-semibold flex items-center justify-between">
                      <span>{v.collaborators?.concent_id || '-'}</span>
                      <span className="flex items-center gap-2 md:hidden">
                        <button className="w-7 h-7 grid place-items-center rounded-md bg-blue-600 hover:bg-blue-700 text-white" onClick={()=>downloadReceipt(v.id)} title="Recibo">
                          <FileDown className="size-4" />
                        </button>
                        {canAdmin && (
                          <>
                            <button className="w-7 h-7 grid place-items-center rounded-md bg-emerald-600 hover:bg-emerald-700 text-white" onClick={()=>openEdit(v)} title="Editar">
                              <Pencil className="size-4" />
                            </button>
                            <button className="w-7 h-7 grid place-items-center rounded-md bg-red-600 hover:bg-red-700 text-white" onClick={()=>remove(v)} title="Remover">
                              <Trash2 className="size-4" />
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                    <div className="md:col-span-3 px-2 text-sm">{v.collaborators?.name || '-'}</div>
                    <div className="md:col-span-1 px-2 text-sm">{computeVacationDays(v)} dias</div>
                    {/* Desktop: datas em colunas separadas */}
                    <div className="hidden md:block md:col-span-2 px-2 text-sm">{formatDateBR(v.start_date)}</div>
                    <div className="hidden md:block md:col-span-2 px-2 text-sm">{formatDateBR(v.end_date)}</div>
                    {/* Mobile: datas combinadas em uma linha */}
                    <div className="md:hidden px-2 text-xs text-neutral-700">
                      De {formatDateBR(v.start_date)} a {formatDateBR(v.end_date)}
                    </div>
                    <div className="md:col-span-1 px-2 text-sm">{formatBRL(v.remuneration)}</div>
                    <div className="md:col-span-1 px-2 hidden md:flex items-center gap-2 justify-end">
                      <button className="w-7 h-7 grid place-items-center rounded-md bg-blue-600 hover:bg-blue-700 text-white" onClick={()=>downloadReceipt(v.id)} title="Recibo">
                        <FileDown className="size-4" />
                      </button>
                      {canAdmin && (
                        <>
                          <button className="w-7 h-7 grid place-items-center rounded-md bg-emerald-600 hover:bg-emerald-700 text-white" onClick={()=>openEdit(v)} title="Editar">
                            <Pencil className="size-4" />
                          </button>
                          <button className="w-7 h-7 grid place-items-center rounded-md bg-red-600 hover:bg-red-700 text-white" onClick={()=>remove(v)} title="Remover">
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-white border border-neutral-200 p-4 space-y-3">
            <div className="text-sm font-semibold">{editing ? 'Editar Férias' : 'Nova Férias'}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs mb-1">Colaborador</label>
                <select disabled={!canAdmin} value={form.collaborator_id} onChange={(e)=>setForm(f=>({ ...f, collaborator_id: e.target.value }))} className="w-full rounded-xl border border-neutral-200 px-2 py-1 text-sm">
                  <option value="">Selecione</option>
                  {collabs.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1">ID Concent</label>
                <input value={selectedCollab?.concent_id || ''} readOnly className="w-full rounded-xl border border-neutral-200 px-2 py-1 text-sm bg-neutral-50" />
              </div>
              <div>
                <label className="block text-xs mb-1">Período Aquisitivo</label>
                <input value={form.period} onChange={(e)=>setForm(f=>({ ...f, period: e.target.value }))} className="w-full rounded-xl border border-neutral-200 px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs mb-1">Data de Saída</label>
                <input type="date" required value={form.start_date} onChange={(e)=>setForm(f=>({ ...f, start_date: e.target.value }))} className="w-full rounded-xl border border-neutral-200 px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs mb-1">Data de Retorno</label>
                <input type="date" required value={form.end_date} onChange={(e)=>setForm(f=>({ ...f, end_date: e.target.value }))} className="w-full rounded-xl border border-neutral-200 px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs mb-1">Qtde de dias</label>
                <input value={days} readOnly className="w-full rounded-xl border border-neutral-200 px-2 py-1 text-sm bg-neutral-50" />
              </div>
              <div>
                <label className="block text-xs mb-1">Remuneração</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={form.remuneration}
                  onChange={(e)=>setForm(f=>({ ...f, remuneration: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-200 px-2 py-1 text-sm"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="block text-xs mb-1">Recibo (PDF)</label>
                <input type="file" accept="application/pdf" onChange={(e)=>setFile(e.target.files?.[0] || null)} className="w-full text-sm" />
                {editing && hasReceipt && (
                  <div className="flex items-center justify-between text-[11px] text-neutral-600">
                    <span>Um recibo já está anexado a este registro.</span>
                    <button type="button" onClick={removeReceipt} className="text-red-600 hover:underline">
                      Remover recibo
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={()=>{ setModalOpen(false); setEditing(null); }} className="px-3 py-1.5 text-xs rounded-lg border border-neutral-200">Cancelar</button>
              <button onClick={save} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
