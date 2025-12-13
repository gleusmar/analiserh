import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { listShiftFunctions, listCollaboratorsSimple, listShiftAssignments, createShiftAssignment, updateShiftAssignment, deleteShiftAssignment } from '../lib/db'

function classNames(...xs) { return xs.filter(Boolean).join(' ') }

function ymOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`
}
function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}
function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth()+1, 0).getDate()
}
function formatISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth()+1).padStart(2,'0')
  const d = String(date.getDate()).padStart(2,'0')
  return `${y}-${m}-${d}`
}
function ptMonthYear(date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default function Shifts() {
  const { role, profile } = useAuth()
  const canManage = role === 'admin' || role === 'super' || role === 'gestor-plantoes'
  const [current, setCurrent] = useState(() => new Date())
  const [functions, setFunctions] = useState([])
  const [collaborators, setCollaborators] = useState([])
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkFn, setBulkFn] = useState('')
  const [bulkCol, setBulkCol] = useState('')
  const [bulkRem, setBulkRem] = useState(true)
  const [bulkDays, setBulkDays] = useState(new Set())

  const activeCollaborators = useMemo(() => (collaborators || []).filter(c => c.status !== 'inactive'), [collaborators])

  const first = startOfMonth(current)
  const totalDays = daysInMonth(current)
  const beforeBlanks = (first.getDay() + 6) % 7 // Monday=0 ... Sunday=6

  const byDate = useMemo(() => {
    const map = {}
    ;(assignments || []).forEach(a => {
      const k = a.date
      if (!map[k]) map[k] = []
      map[k].push(a)
    })
    return map
  }, [assignments])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const y = current.getFullYear(); const m = current.getMonth()
      const from = new Date(y, m, 1)
      const to = new Date(y, m, totalDays)
      const [fn, cols, asg] = await Promise.all([
        listShiftFunctions(),
        listCollaboratorsSimple(),
        listShiftAssignments(formatISO(from), formatISO(to)),
      ])
      setFunctions(fn || [])
      setCollaborators(cols || [])
      setAssignments(asg || [])
    } catch (e) {
      setError(e.message || 'Erro ao carregar plantões')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [current])

  async function addAssignment(dateISO, shift_function_id, collaborator_id, remunerated = true) {
    try {
      const created = await createShiftAssignment({ date: dateISO, shift_function_id, collaborator_id, remunerated })
      setAssignments(a => [...a, created])
    } catch (e) {
      alert(e.message || 'Falha ao adicionar plantão')
    }
  }

  async function toggleRemunerated(a) {
    try {
      const updated = await updateShiftAssignment(a.id, { remunerated: !a.remunerated })
      setAssignments(list => list.map(x => x.id === a.id ? updated : x))
    } catch (e) {
      alert(e.message || 'Falha ao atualizar')
    }
  }

  async function removeAssignment(a) {
    try {
      await deleteShiftAssignment(a.id)
      setAssignments(list => list.filter(x => x.id !== a.id))
    } catch (e) {
      alert(e.message || 'Falha ao remover')
    }
  }

  function prevMonth() {
    setCurrent(d => new Date(d.getFullYear(), d.getMonth()-1, 1))
  }
  function nextMonth() {
    setCurrent(d => new Date(d.getFullYear(), d.getMonth()+1, 1))
  }

  async function bulkSave() {
    if (!canManage) return
    if (!bulkFn || !bulkCol || bulkDays.size === 0) return
    try {
      const ops = []
      for (const d of Array.from(bulkDays)) {
        const dateISO = formatISO(new Date(current.getFullYear(), current.getMonth(), d))
        ops.push(createShiftAssignment({ date: dateISO, shift_function_id: bulkFn, collaborator_id: bulkCol, remunerated: bulkRem }))
      }
      const res = await Promise.allSettled(ops)
      const created = res.filter(r => r.status === 'fulfilled').map(r => r.value)
      if (created.length) setAssignments(list => [...list, ...created])
      setBulkOpen(false)
      setBulkDays(new Set())
      setBulkFn(''); setBulkCol(''); setBulkRem(true)
    } catch (e) {
      alert(e.message || 'Falha ao inserir em múltiplos dias')
    }
  }

  function DayCell({ day }) {
    const dateISO = useMemo(() => formatISO(new Date(current.getFullYear(), current.getMonth(), day)), [current, day])
    const items = byDate[dateISO] || []
    const visibleItems = useMemo(() => {
      if (canManage) return items
      const myId = profile?.collaborator_id || null
      return (items || []).filter(a => a.collaborator_id === myId)
    }, [items, canManage, profile])
    const [selFn, setSelFn] = useState('')
    const [selCol, setSelCol] = useState('')
    const [rem, setRem] = useState(true)
    const fnOrderMap = useMemo(() => {
      const m = {}
      ;(functions || []).forEach(f => { m[f.id] = (f.sort_order ?? 999999) })
      return m
    }, [functions])
    const orderedItems = useMemo(() => {
      const arr = [...visibleItems]
      arr.sort((a, b) => {
        const av = fnOrderMap[a.shift_function_id] ?? 999999
        const bv = fnOrderMap[b.shift_function_id] ?? 999999
        if (av !== bv) return av - bv
        return String(a.id).localeCompare(String(b.id))
      })
      return arr
    }, [visibleItems, fnOrderMap])

    function onDragStartItem(e, id) {
      if (!canManage) return
      e.dataTransfer.setData('text/plain', id)
      e.dataTransfer.setData('application/x-shift-date', dateISO)
      e.dataTransfer.effectAllowed = 'copyMove'
    }
    async function onDropOnItem(e, targetId) {
      if (!canManage) return
      e.preventDefault()
      e.stopPropagation()
      // Dia inteiro sendo arrastado?
      const srcDay = e.dataTransfer.getData('application/x-shift-day')
      if (srcDay) {
        if (srcDay !== dateISO) {
          await copyDayFromTo(srcDay, dateISO)
        }
        return
      }
      const srcId = e.dataTransfer.getData('text/plain')
      const srcDate = e.dataTransfer.getData('application/x-shift-date')
      if (!srcId) return
      if (srcDate !== dateISO) {
        const src = (assignments || []).find(x => x.id === srcId)
        if (!src) return
        try {
          const created = await createShiftAssignment({
            date: dateISO,
            shift_function_id: src.shift_function_id,
            collaborator_id: src.collaborator_id,
            remunerated: src.remunerated,
          })
          setAssignments(list => [...list, created])
        } catch (err) {
          alert(err?.message || 'Falha ao copiar plantão para o dia')
        }
        return
      }
      return
    }

    async function onDropOnContainer(e) {
      if (!canManage) return
      e.preventDefault()
      // Copiar dia inteiro se for o caso
      const srcDay = e.dataTransfer.getData('application/x-shift-day')
      if (srcDay) {
        if (srcDay !== dateISO) {
          await copyDayFromTo(srcDay, dateISO)
        }
        return
      }
      const srcId = e.dataTransfer.getData('text/plain')
      const srcDate = e.dataTransfer.getData('application/x-shift-date')
      if (!srcId) return
      if (srcDate === dateISO) return
      const src = (assignments || []).find(x => x.id === srcId)
      if (!src) return
      try {
        const created = await createShiftAssignment({
          date: dateISO,
          shift_function_id: src.shift_function_id,
          collaborator_id: src.collaborator_id,
          remunerated: src.remunerated,
        })
        setAssignments(list => [...list, created])
      } catch (err) {
        alert(err?.message || 'Falha ao copiar plantão para o dia')
      }
    }

    async function copyDayFromTo(srcISO, destISO) {
      try {
        const srcItems = byDate[srcISO] || []
        const destItems = byDate[destISO] || []
        // Limpar destino
        if (destItems.length) {
          await Promise.allSettled(destItems.map(x => deleteShiftAssignment(x.id)))
        }
        // Criar cópias no destino
        const creates = srcItems.map(s => (
          createShiftAssignment({
            date: destISO,
            shift_function_id: s.shift_function_id,
            collaborator_id: s.collaborator_id,
            remunerated: s.remunerated,
          })
        ))
        const res = await Promise.allSettled(creates)
        const created = res.filter(r => r.status === 'fulfilled').map(r => r.value)
        setAssignments(list => {
          const filtered = list.filter(x => x.date !== destISO)
          return [...filtered, ...created]
        })
      } catch (err) {
        alert(err?.message || 'Falha ao copiar dia')
      }
    }

    function onDragStartDay(e) {
      if (!canManage) return
      e.dataTransfer.setData('application/x-shift-day', dateISO)
      e.dataTransfer.effectAllowed = 'copy'
    }

    async function clearDay() {
      if (!canManage) return
      if (!confirm('Remover todos os plantões deste dia?')) return
      try {
        const ids = (byDate[dateISO] || []).map(x => x.id)
        await Promise.allSettled(ids.map(id => deleteShiftAssignment(id)))
        setAssignments(list => list.filter(x => x.date !== dateISO))
      } catch (e) {
        alert(e.message || 'Falha ao limpar o dia')
      }
    }
    const dayHeight = role === 'user' ? 'h-35' : 'h-145'
    return (
      <div
        className={`${dayHeight} flex flex-col rounded-xl border border-neutral-200 dark:border-neutral-800 p-2 gap-2 text-[11px]`}
        onDragOver={(e)=>{ if (canManage) e.preventDefault() }}
        onDrop={onDropOnContainer}
      >
        <div className="flex items-center justify-between" draggable={canManage} onDragStart={onDragStartDay} title="Arraste para copiar este dia">
          <div className="text-base font-bold text-emerald-800">{String(day)}</div>
          {canManage && (
            <button className="text-red-600 hover:text-red-700 text-xs font-bold px-1" title="Remover todos do dia" onClick={clearDay}>x</button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {orderedItems.map(a => {
            const fnName = (functions.find(f => f.id === a.shift_function_id)?.name) || 'Função'
            const colName = (collaborators.find(c => c.id === a.collaborator_id)?.name) || 'Colaborador'
            return (
              <div
                key={a.id}
                draggable={canManage}
                onDragStart={(e)=>onDragStartItem(e, a.id)}
                onDragOver={(e)=>{ if (canManage) { e.preventDefault(); e.stopPropagation(); } }}
                onDrop={(e)=>onDropOnItem(e, a.id)}
                className={
                  "flex items-center justify-between gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 px-2 py-0.5 " +
                  (fnName.includes('Bio LAB') ? ' bg-blue-50' :
                   fnName.includes('Téc Apoio') ? ' bg-yellow-50' :
                   fnName.includes('Téc LAB') ? ' bg-green-50' :
                   fnName.includes('Téc UPA') ? ' bg-red-50' : '')
                }
              >
                <div className="min-w-0">
                  <div className="truncate text-xs text-neutral-500">{fnName}</div>
                  <div className="truncate text-xs text-black dark:text-white font-semibold">{colName}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={!!a.remunerated} onChange={()=>canManage && toggleRemunerated(a)} title="Remunerado" disabled={!canManage} />
                  {canManage && (
                    <button className="p-1 text-red-600 font-bold hover:text-red-700 cursor-pointer" aria-label="Remover" onClick={()=>removeAssignment(a)}>X</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {canManage && (
          <div className="mt-auto pt-1 border-t border-dashed border-neutral-200 dark:border-neutral-800">
            <div className="flex flex-col gap-2">
              <select value={selFn} onChange={(e)=>setSelFn(e.target.value)} className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 px-2 py-1 text-xs">
                <option value="">Função</option>
                {functions.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <select value={selCol} onChange={(e)=>setSelCol(e.target.value)} className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 px-2 py-1 text-xs">
                <option value="">Colaborador</option>
                {activeCollaborators.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <input type="checkbox" checked={rem} onChange={(e)=>setRem(e.target.checked)} title="Remunerado" />
              <button disabled={!selFn || !selCol} onClick={()=>addAssignment(dateISO, selFn, selCol, rem)} className="px-2 py-1 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50">Adicionar</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const days = Array.from({ length: totalDays }, (_, i) => i + 1)
  const blanks = Array.from({ length: beforeBlanks }, () => null)
  const cells = [...blanks, ...days]
  const weekLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Plantões</h1>
        <div className="inline-flex items-center gap-2">
          <button onClick={prevMonth} className="px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800">Anterior</button>
          <div className="text-sm font-medium w-40 text-center">{ptMonthYear(current)}</div>
          <button onClick={nextMonth} className="px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800">Próximo</button>
          {canManage && (
            <button onClick={()=>setBulkOpen(true)} className="px-3 py-2 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white">Inserção múltipla</button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30 rounded-xl px-3 py-2 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-7 gap-2">
        {weekLabels.map((w) => (
          <div key={w} className="text-base text-emerald-600 text-center py-1">{w}</div>
        ))}
        {cells.map((c, idx) => (
          c === null ? (
            <div key={`b-${idx}`} className={(role === 'user' ? 'h-35' : 'h-145') + " rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800"} />
          ) : (
            <DayCell key={`d-${c}`} day={c} />
          )
        ))}
      </div>

      {bulkOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
            <div className="text-sm font-semibold">Inserir em múltiplos dias</div>
            <div className="grid grid-cols-2 gap-2">
              <select value={bulkFn} onChange={(e)=>setBulkFn(e.target.value)} className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 px-2 py-1 text-xs">
                <option value="">Função</option>
                {functions.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <select value={bulkCol} onChange={(e)=>setBulkCol(e.target.value)} className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 px-2 py-1 text-xs">
                <option value="">Colaborador</option>
                {activeCollaborators.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs inline-flex items-center gap-2">
                <input type="checkbox" checked={bulkRem} onChange={(e)=>setBulkRem(e.target.checked)} /> Remunerado
              </label>
              <div className="text-[11px] text-neutral-500">Clique nos dias para selecionar</div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weekLabels.map((w) => (
                <div key={`w-${w}`} className="text-[11px] text-emerald-700 text-center py-0.5">{w}</div>
              ))}
              {Array.from({ length: beforeBlanks }, (_, i) => (
                <div key={`mb-${i}`} className="h-8" />
              ))}
              {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => {
                const sel = bulkDays.has(d)
                return (
                  <button
                    key={`md-${d}`}
                    onClick={()=>setBulkDays(prev=>{ const ns = new Set(prev); if (ns.has(d)) ns.delete(d); else ns.add(d); return ns })}
                    className={
                      "h-8 rounded-lg text-xs font-semibold " +
                      (sel ? "bg-emerald-600 text-white" : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200")
                    }
                  >{d}</button>
                )
              })}
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={()=>{ setBulkOpen(false); }} className="px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800">Cancelar</button>
              <button disabled={!bulkFn || !bulkCol || bulkDays.size===0} onClick={bulkSave} className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
