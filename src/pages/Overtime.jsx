import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { listCollaboratorsSimple, listPayrollSheets, listOvertimeEntries, getOvertimeBalance, createOvertimeEntry, updateOvertimeEntry, deleteOvertimeEntry } from '../lib/db'
import { Plus, Pencil, Trash2 } from 'lucide-react'

function ymOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function parseYM(ym) {
  const [y, m] = String(ym || '').split('-').map(Number)
  return { y, m }
}

function firstLastOfYM(ym) {
  const { y, m } = parseYM(ym)
  if (!y || !m) return { from: null, to: null }
  const from = new Date(y, m - 1, 1)
  const to = new Date(y, m, 0)
  const pad = n => String(n).padStart(2, '0')
  return {
    from: `${y}-${pad(m)}-01`,
    to: `${y}-${pad(m)}-${pad(to.getDate())}`,
  }
}

function formatDateBR(s) {
  if (!s) return ''
  const str = String(s)
  // Se vier como YYYY-MM-DD (date do banco), tratamos como data "pura" sem fuso horário
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const [, yyyy, mm, dd] = m
    return `${dd}/${mm}/${yyyy}`
  }

  // Fallback para outros formatos válidos entendidos pelo Date
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function minutesToHHMM(minutes) {
  const m = Number(minutes || 0)
  const sign = m < 0 ? '-' : ''
  const abs = Math.abs(m)
  const h = Math.floor(abs / 60)
  const min = abs % 60
  return `${sign}${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function formatMinutesShort(minutes) {
  const m = Number(minutes || 0)
  const sign = m < 0 ? '-' : ''
  const abs = Math.abs(m)
  const h = Math.floor(abs / 60)
  const min = abs % 60
  if (min === 0) return `${sign}${h}h`
  return `${sign}${h}h ${String(min).padStart(2, '0')}min`
}

function parseHoursToMinutes(text) {
  if (!text) return null
  const s = String(text).trim()
  if (!s) return null
  if (s.includes(':')) {
    const [hStr, mStr] = s.split(':')
    const h = parseInt(hStr, 10)
    const m = parseInt(mStr || '0', 10)
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null
    return h * 60 + m
  }
  const normalized = s.replace('.', ',')
  const parts = normalized.split(',')
  const h = parseInt(parts[0] || '0', 10)
  let m = 0
  if (parts[1]) {
    const frac = parseFloat(`0,${parts[1]}`.replace(',', '.'))
    if (Number.isFinite(frac)) m = Math.round(frac * 60)
  }
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

function parseDecimalToNumber(text) {
  if (text === null || text === undefined) return null
  const s = String(text).trim().replace(/\s+/g, '')
  if (!s) return null
  const normalized = s.replace(/\./g, '').replace(',', '.')
  const v = parseFloat(normalized)
  return Number.isNaN(v) ? null : v
}

function formatBRL(n) {
  if (n === null || n === undefined) return '-'
  const v = Number(n)
  if (Number.isNaN(v)) return '-'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function Overtime() {
  const { role, profile } = useAuth()
  const canManage = role === 'admin' || role === 'super' || role === 'gestor-plantoes'
  const isUser = role === 'user'
  const myColId = profile?.collaborator_id || null

  const [collabs, setCollabs] = useState([])
  const [sheets, setSheets] = useState([])

  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState('')
  const [yearMonth, setYearMonth] = useState('')

  const [entries, setEntries] = useState([])
  const [balance, setBalance] = useState({ minutes: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    collaborator_id: '',
    date: '',
    kind: 'worked',
    hours: '',
    sheet_id: '',
    hour_value: '',
    note: '',
  })
  const [summaryOrder, setSummaryOrder] = useState('name') // 'name' | 'balance'

  useEffect(() => {
    async function loadBase() {
      setLoading(true)
      setError(null)
      try {
        let cs = []
        let sh = []
        if (canManage) {
          const [cRes, sRes] = await Promise.all([
            listCollaboratorsSimple(),
            listPayrollSheets(),
          ])
          cs = (cRes || []).filter(c => c.status !== 'inactive')
          sh = sRes || []
        }
        setCollabs(cs)
        setSheets(sh)

        if (isUser && myColId) {
          setSelectedCollaboratorId(String(myColId))
        } else if (canManage && !selectedCollaboratorId) {
          // Para gestores/admin/super, começar na visão de todos os colaboradores
          setSelectedCollaboratorId('__all__')
        }
      } catch (e) {
        setError(e.message || 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }
    loadBase()
  }, [canManage, isUser, myColId])

  useEffect(() => {
    async function loadData() {
      if (!selectedCollaboratorId) {
        setEntries([])
        setBalance({ minutes: 0 })
        return
      }
      setLoading(true)
      setError(null)
      try {
        if (!isUser && selectedCollaboratorId === '__all__') {
          // Visão global: todos os lançamentos, sem filtro de mês
          const es = await listOvertimeEntries()
          setEntries(es || [])
          setBalance({ minutes: 0 })
        } else {
          const [es, bal] = await Promise.all([
            // Histórico completo do colaborador, sem filtro de mês
            listOvertimeEntries({ collaboratorId: selectedCollaboratorId }),
            getOvertimeBalance(selectedCollaboratorId),
          ])
          setEntries(es || [])
          setBalance(bal || { minutes: 0 })
        }
      } catch (e) {
        setError(e.message || 'Erro ao carregar banco de horas')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [selectedCollaboratorId])

  const isAllSelection = !isUser && selectedCollaboratorId === '__all__'

  const balanceLabel = useMemo(() => {
    if (isAllSelection) return 'Visão geral: todos os colaboradores'
    const m = balance?.minutes || 0
    const hStr = formatMinutesShort(m)
    if (m > 0) return `Saldo: ${hStr} (positivo)`
    if (m < 0) return `Saldo: ${hStr} (negativo)`
    return 'Saldo: 00:00'
  }, [balance, isAllSelection])

  const balanceColor = useMemo(() => {
    if (isAllSelection) return 'text-neutral-700 bg-neutral-50'
    const m = balance?.minutes || 0
    if (m > 0) return 'text-emerald-700 bg-emerald-50'
    if (m < 0) return 'text-red-700 bg-red-50'
    return 'text-neutral-700 bg-neutral-50'
  }, [balance, isAllSelection])

  const selectedCollaborator = useMemo(
    () => (collabs || []).find(c => String(c.id) === String(selectedCollaboratorId)) || null,
    [collabs, selectedCollaboratorId],
  )

  const monthlySummary = useMemo(() => {
    const acc = { worked: 0, time_off: 0, paid: 0 }
    if (!Array.isArray(entries)) return acc
    for (const e of entries) {
      const m = Math.abs(e.minutes || 0)
      if (e.kind === 'worked') acc.worked += m
      else if (e.kind === 'time_off') acc.time_off += m
      else if (e.kind === 'paid') acc.paid += m
    }
    return acc
  }, [entries])

  const perCollaboratorSummary = useMemo(() => {
    if (!isAllSelection || !Array.isArray(entries)) return []
    const map = new Map()
    for (const e of entries) {
      const id = e.collaborator_id
      if (!id) continue
      let item = map.get(id)
      if (!item) {
        item = {
          collaborator_id: id,
          name: e.collaborators?.name || 'Sem nome',
          concent_id: e.collaborators?.concent_id || '',
          worked: 0,
          time_off: 0,
          paid: 0,
        }
        map.set(id, item)
      }
      const m = Math.abs(e.minutes || 0)
      if (e.kind === 'worked') item.worked += m
      else if (e.kind === 'time_off') item.time_off += m
      else if (e.kind === 'paid') item.paid += m
    }
    const arr = Array.from(map.values())
    if (summaryOrder === 'balance') {
      return arr.sort((a, b) => {
        const sa = a.worked - a.time_off - a.paid
        const sb = b.worked - b.time_off - b.paid
        return sb - sa
      })
    }
    return arr.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [entries, isAllSelection, summaryOrder])

  const tableEntries = useMemo(() => {
    if (!yearMonth) return entries
    const { from, to } = firstLastOfYM(yearMonth)
    if (!from || !to) return entries
    return (entries || []).filter(e => {
      const d = String(e.date || '')
      return d >= from && d <= to
    })
  }, [entries, yearMonth])

  function openCreate() {
    let baseColId = ''
    if (isUser && myColId) {
      baseColId = String(myColId)
    } else if (!isAllSelection && selectedCollaboratorId) {
      baseColId = String(selectedCollaboratorId)
    } else if (collabs[0]) {
      baseColId = String(collabs[0].id)
    }
    setEditing(null)
    setForm({
      collaborator_id: baseColId,
      // Data de hoje em formato local YYYY-MM-DD, sem depender de fuso horário/UTC
      date: (() => {
        const today = new Date()
        const yyyy = today.getFullYear()
        const mm = String(today.getMonth() + 1).padStart(2, '0')
        const dd = String(today.getDate()).padStart(2, '0')
        return `${yyyy}-${mm}-${dd}`
      })(),
      kind: 'worked',
      hours: '',
      sheet_id: '',
      hour_value: '',
      note: '',
    })
    setModalOpen(true)
  }

  function openEdit(entry) {
    setEditing(entry)
    setForm({
      collaborator_id: String(entry.collaborator_id),
      date: entry.date,
      kind: entry.kind,
      hours: minutesToHHMM(entry.minutes),
      sheet_id: entry.sheet_id ? String(entry.sheet_id) : '',
      hour_value: entry.hour_value != null ? String(entry.hour_value) : '',
      note: entry.note || '',
    })
    setModalOpen(true)
  }

  async function onDelete(entry) {
    if (!canManage) return
    if (!window.confirm('Remover este lançamento de horas extras? Isso também removerá o lançamento correspondente na folha, se houver.')) return
    try {
      await deleteOvertimeEntry(entry.id)
      if (!isUser && selectedCollaboratorId === '__all__') {
        const es = await listOvertimeEntries()
        setEntries(es || [])
        setBalance({ minutes: 0 })
      } else {
        const [es, bal] = await Promise.all([
          listOvertimeEntries({ collaboratorId: selectedCollaboratorId }),
          getOvertimeBalance(selectedCollaboratorId),
        ])
        setEntries(es || [])
        setBalance(bal || { minutes: 0 })
      }
    } catch (e) {
      alert(e.message || 'Falha ao remover horas extras')
    }
  }

  async function save() {
    if (!canManage) return
    if (!form.collaborator_id || !form.date || !form.kind) {
      alert('Preencha colaborador, data e tipo.')
      return
    }
    if (!isUser && form.collaborator_id === '__all__') {
      alert('Selecione um colaborador específico para lançar horas.')
      return
    }
    const minutes = parseHoursToMinutes(form.hours)
    if (!minutes || minutes <= 0) {
      alert('Informe uma quantidade de horas válida (ex: 4, 4:30).')
      return
    }

    let sheet_id = null
    let hourValueNumber = null
    if (form.kind === 'paid') {
      if (!form.sheet_id) {
        alert('Selecione a folha em que as horas serão remuneradas.')
        return
      }
      const hv = parseDecimalToNumber(form.hour_value)
      if (!hv || hv <= 0) {
        alert('Informe um valor de hora válido.')
        return
      }
      sheet_id = form.sheet_id
      hourValueNumber = hv
    }

    const payload = {
      collaborator_id: form.collaborator_id,
      date: form.date,
      kind: form.kind,
      minutes,
      sheet_id,
      hour_value: hourValueNumber,
      note: form.note || null,
    }

    try {
      setSaving(true)
      if (editing) {
        await updateOvertimeEntry(editing.id, payload)
      } else {
        await createOvertimeEntry(payload)
      }
      setModalOpen(false)
      setEditing(null)
      if (!isUser && selectedCollaboratorId === '__all__') {
        const es = await listOvertimeEntries()
        setEntries(es || [])
        setBalance({ minutes: 0 })
      } else {
        const [es, bal] = await Promise.all([
          listOvertimeEntries({ collaboratorId: selectedCollaboratorId }),
          getOvertimeBalance(selectedCollaboratorId),
        ])
        setEntries(es || [])
        setBalance(bal || { minutes: 0 })
      }
    } catch (e) {
      alert(e.message || 'Falha ao salvar horas extras')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex pt-2 items-center justify-between">
        <h1 className="text-sm md:text-2xl text-center font-semibold">Horas Extras / Banco de Horas</h1>
        {canManage && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">Lançar horas</span>
          </button>
        )}
      </div>

      {error && <div className="text-red-600 bg-red-50 rounded-xl px-3 py-2 text-sm">{error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        {!isUser && (
          <select
            value={selectedCollaboratorId}
            onChange={e => setSelectedCollaboratorId(e.target.value)}
            className="rounded-xl border border-neutral-200 px-3 py-2.5 min-w-64"
          >
            <option value="">Selecione um colaborador</option>
            <option value="__all__">Todos os colaboradores</option>
            {collabs.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.concent_id}
              </option>
            ))}
          </select>
        )}
        {isUser && selectedCollaborator && (
          <div className="text-sm text-neutral-700">
            {selectedCollaborator.name} — {selectedCollaborator.concent_id}
          </div>
        )}
        <input
          type="month"
          value={yearMonth}
          onChange={e => setYearMonth(e.target.value)}
          className="rounded-xl border border-neutral-200 px-3 py-2.5"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-4 items-start">
        <div className="space-y-4">
          {loading && <div className="text-sm text-neutral-500">Carregando...</div>}

          {!loading && selectedCollaboratorId && (
            <div className="overflow-x-auto rounded-xl bg-white text-neutral-900">
              <table className="w-full text-sm">
                <thead className="text-left text-neutral-500">
                  <tr>
                    <th className="py-2 px-2">Data</th>
                    {isAllSelection && <th className="py-2 px-2">Colaborador</th>}
                    <th className="py-2 px-2">Tipo</th>
                    <th className="py-2 px-2">Horas</th>
                    <th className="py-2 px-2">Folha</th>
                    <th className="py-2 px-2">Valor</th>
                    <th className="py-2 px-2">Observação</th>
                    {canManage && <th className="py-2 px-2">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {tableEntries.length === 0 && (
                    <tr>
                      <td colSpan={(canManage ? 7 : 6) + (isAllSelection ? 1 : 0)} className="py-4 px-2 text-center text-sm text-neutral-500">
                        Nenhum lançamento de horas extras neste período.
                      </td>
                    </tr>
                  )}
                  {tableEntries.map(e => {
                    const kindLabel = e.kind === 'worked' ? 'Trabalhadas' : e.kind === 'time_off' ? 'Folga' : 'Remuneração'
                    const kindColor =
                      e.kind === 'worked'
                        ? 'text-emerald-700 bg-emerald-50'
                        : e.kind === 'time_off'
                          ? 'text-amber-700 bg-amber-50'
                          : 'text-blue-700 bg-blue-50'
                    const sheetLabel = e.payroll_sheets ? `${e.payroll_sheets.name} (${e.payroll_sheets.year_month})` : '-'
                    const hoursStr = formatMinutesShort(e.minutes)
                    return (
                      <tr key={e.id} className="border-t border-neutral-200">
                        <td className="py-1.5 px-2 text-xs">{formatDateBR(e.date)}</td>
                        {isAllSelection && (
                          <td className="py-1.5 px-2 text-xs truncate max-w-[180px]">
                            {e.collaborators?.name || 'Sem nome'}
                            {e.collaborators?.concent_id ? ` — ${e.collaborators.concent_id}` : ''}
                          </td>
                        )}
                        <td className="py-1.5 px-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${kindColor}`}>
                            {kindLabel}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-sm font-semibold">{hoursStr}</td>
                        <td className="py-1.5 px-2 text-xs truncate max-w-[180px]">{e.kind === 'paid' ? sheetLabel : '-'}</td>
                        <td className="py-1.5 px-2 text-xs">{e.kind === 'paid' ? formatBRL(e.amount) : '-'}</td>
                        <td className="py-1.5 px-2 text-xs text-neutral-700 truncate max-w-[220px]">{e.note || ''}</td>
                        {canManage && (
                          <td className="py-1.5 px-2">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(e)}
                                className="w-7 h-7 grid place-items-center rounded-md border border-neutral-200 hover:bg-neutral-100"
                                title="Editar"
                              >
                                <Pencil className="size-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDelete(e)}
                                className="w-7 h-7 grid place-items-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                                title="Excluir"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-20">
          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-sm text-neutral-900 shadow-sm min-h-[260px] lg:min-h-[320px]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Resumo do banco de horas</h2>
              {isAllSelection && (
                <div className="inline-flex items-center gap-1 text-[10px] text-neutral-500">
                  <span>Ordenar por:</span>
                  <button
                    type="button"
                    onClick={() => setSummaryOrder('name')}
                    className={`px-2 py-0.5 rounded-full border text-[10px] ${summaryOrder === 'name' ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : 'border-neutral-200 bg-white'}`}
                  >
                    Nome
                  </button>
                  <button
                    type="button"
                    onClick={() => setSummaryOrder('balance')}
                    className={`px-2 py-0.5 rounded-full border text-[10px] ${summaryOrder === 'balance' ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : 'border-neutral-200 bg-white'}`}
                  >
                    Saldo
                  </button>
                </div>
              )}
            </div>
            {!isUser && !selectedCollaboratorId && !isAllSelection && (
              <p className="text-xs text-neutral-500">Selecione um colaborador para visualizar o resumo.</p>
            )}

            {isAllSelection && (
              <div className="space-y-3">
                <div className={`text-sm md:text-xl px-3 py-2 rounded-xl inline-flex items-center font-semibold ${balanceColor}`}>
                  {balanceLabel}
                </div>
                <div className="border-t border-neutral-100 pt-3 mt-1 space-y-2">
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase">Colaboradores (histórico completo)</div>
                  {perCollaboratorSummary.length === 0 && (
                    <p className="text-xs text-neutral-500">Nenhum lançamento neste período.</p>
                  )}
                  {perCollaboratorSummary.length > 0 && (
                    <div className="mt-1 space-y-1 max-h-72 overflow-auto pr-1">
                      {perCollaboratorSummary.map(row => (
                        (() => {
                          const saldoMin = (row.worked || 0) - (row.time_off || 0) - (row.paid || 0)
                          const saldoStr = formatMinutesShort(saldoMin)
                          const saldoColor = saldoMin > 0 ? 'text-emerald-700' : saldoMin < 0 ? 'text-red-700' : 'text-neutral-700'
                          return (
                        <div key={row.collaborator_id} className="grid grid-col-2 border border-neutral-100 rounded-xl px-2 py-1.5 bg-neutral-50">
                          <div>
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-medium text-neutral-800 truncate">{row.name}</span>
                              {row.concent_id && (
                                <span className="text-[10px] text-neutral-500">{row.concent_id}</span>
                              )}
                            </div>
                            <div className="mt-1 grid grid-cols-3 gap-1 text-[11px]">
                              <div className="flex flex-col">
                                <span className="text-neutral-500">Trabalhadas</span>
                                <span className="font-mono text-emerald-700">{formatMinutesShort(row.worked)}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-neutral-500">Folga</span>
                                <span className="font-mono text-amber-700">{formatMinutesShort(row.time_off)}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-neutral-500">Remuneradas</span>
                                <span className="font-mono text-blue-700">{formatMinutesShort(row.paid)}</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <div className="mt-1 flex items-center justify-between text-[11px]">
                              <span className="text-neutral-500">Saldo</span>
                              <span className={`font-mono font-semibold text-2xl ${saldoColor}`}>{saldoStr}h</span>
                            </div>
                          </div>  
                        </div>
                          )
                        })()
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isAllSelection && selectedCollaboratorId && selectedCollaborator && (
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium">{selectedCollaborator.name}</div>
                  <div className="text-[11px] text-neutral-500">ID: {selectedCollaborator.concent_id}</div>
                </div>

                <div className={`text-sm md:text-xl px-3 py-2 rounded-xl inline-flex items-center font-semibold ${balanceColor}`}>
                  {balanceLabel}
                </div>

                <div className="border-t border-neutral-100 pt-3 mt-1 space-y-2">
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase">Histórico completo</div>
                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-600">Trabalhadas (crédito)</span>
                      <span className="font-mono text-emerald-700">{formatMinutesShort(monthlySummary.worked)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-600">Folga (débito)</span>
                      <span className="font-mono text-amber-700">{formatMinutesShort(monthlySummary.time_off)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-600">Remuneradas (débito)</span>
                      <span className="font-mono text-blue-700">{formatMinutesShort(monthlySummary.paid)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl p-6 border bg-neutral-50 text-neutral-900 border-neutral-200">
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Editar horas extras' : 'Lançar horas extras'}</h2>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {!isUser && (
                  <div>
                    <label className="block text-xs mb-1">Colaborador</label>
                    <select
                      value={form.collaborator_id}
                      onChange={e => setForm(f => ({ ...f, collaborator_id: e.target.value }))}
                      className="w-full rounded-xl border border-neutral-200 px-3 py-2.5"
                    >
                      <option value="">Selecione</option>
                      {collabs.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} — {c.concent_id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs mb-1">Data</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs mb-1">Tipo</label>
                  <select
                    value={form.kind}
                    onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2.5"
                  >
                    <option value="worked">Trabalhadas (creditar banco)</option>
                    <option value="time_off">Folga (debitar banco)</option>
                    <option value="paid">Remuneração (debitar banco e lançar na folha)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1">Horas</label>
                  <input
                    type="text"
                    placeholder="ex: 4 ou 4:30"
                    value={form.hours}
                    onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2.5"
                  />
                </div>
                {form.kind === 'paid' && (
                  <div>
                    <label className="block text-xs mb-1">Valor da hora (R$)</label>
                    <input
                      type="text"
                      placeholder="ex: 50,00"
                      value={form.hour_value}
                      onChange={e => setForm(f => ({ ...f, hour_value: e.target.value }))}
                      className="w-full rounded-xl border border-neutral-200 px-3 py-2.5"
                    />
                  </div>
                )}
              </div>

              {form.kind === 'paid' && (
                <div>
                  <label className="block text-xs mb-1">Lançar na folha</label>
                  <select
                    value={form.sheet_id}
                    onChange={e => setForm(f => ({ ...f, sheet_id: e.target.value }))}
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2.5"
                  >
                    <option value="">Selecione uma folha</option>
                    {sheets.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.year_month})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs mb-1">Observação</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2.5"
                  placeholder="Opcional"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalOpen(false)
                    setEditing(null)
                  }}
                  className="px-3 py-2 text-xs rounded-lg border border-neutral-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="px-3 py-2 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
