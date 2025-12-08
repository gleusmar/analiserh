import { useEffect, useMemo, useState } from 'react'
import { listShiftFunctions, listCollaboratorsSimple, listShiftAssignments, createShiftAssignment, updateShiftAssignment, deleteShiftAssignment, listShiftRateOverrides, updateShiftPositions } from '../lib/db'

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
  const [current, setCurrent] = useState(() => new Date())
  const [functions, setFunctions] = useState([])
  const [collaborators, setCollaborators] = useState([])
  const [assignments, setAssignments] = useState([])
  const [overrides, setOverrides] = useState({}) // { shift_function_id: value }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [orderMap, setOrderMap] = useState({}) // { [dateISO]: [assignmentId, ...] }

  const activeCollaborators = useMemo(() => (collaborators || []).filter(c => c.status !== 'inactive'), [collaborators])

  const monthKey = ymOf(current)
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

  const overrideMap = useMemo(() => overrides || {}, [overrides])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const y = current.getFullYear(); const m = current.getMonth()
      const from = new Date(y, m, 1)
      const to = new Date(y, m, totalDays)
      const [fn, cols, asg, ov] = await Promise.all([
        listShiftFunctions(),
        listCollaboratorsSimple(),
        listShiftAssignments(formatISO(from), formatISO(to)),
        listShiftRateOverrides(monthKey),
      ])
      setFunctions(fn || [])
      setCollaborators(cols || [])
      setAssignments(asg || [])
      const oMap = {}
      ;(ov || []).forEach(o => { oMap[o.shift_function_id] = o.value })
      setOverrides(oMap)
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
    if (!confirm('Remover este plantão?')) return
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

  function DayCell({ day }) {
    const dateISO = useMemo(() => formatISO(new Date(current.getFullYear(), current.getMonth(), day)), [current, day])
    const items = byDate[dateISO] || []
    const [selFn, setSelFn] = useState('')
    const [selCol, setSelCol] = useState('')
    const [rem, setRem] = useState(true)
    const orderedItems = useMemo(() => {
      const ids = orderMap[dateISO]
      if (Array.isArray(ids) && ids.length) {
        const byId = Object.fromEntries(items.map(i => [i.id, i]))
        const sorted = ids.map(id => byId[id]).filter(Boolean)
        const rest = items.filter(i => !ids.includes(i.id))
        return [...sorted, ...rest]
      }
      return items
    }, [items, orderMap, dateISO])

    function onDragStartItem(e, id) {
      e.dataTransfer.setData('text/plain', id)
      e.dataTransfer.setData('application/x-shift-date', dateISO)
      e.dataTransfer.effectAllowed = 'copyMove'
    }
    async function onDropOnItem(e, targetId) {
      e.preventDefault()
      e.stopPropagation()
      const srcId = e.dataTransfer.getData('text/plain')
      const srcDate = e.dataTransfer.getData('application/x-shift-date')
      if (!srcId) return
      // cross-day: copy behavior (same as container drop)
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
          const ids = [...orderedItems.map(x => x.id), created.id]
          setOrderMap(prev => ({ ...prev, [dateISO]: ids }))
          try { await updateShiftPositions(dateISO, ids) } catch (_) {}
        } catch (err) {
          alert(err?.message || 'Falha ao copiar plantão para o dia')
        }
        return
      }
      const ids = orderedItems.map(x => x.id)
      const from = ids.indexOf(srcId)
      const to = ids.indexOf(targetId)
      if (from < 0 || to < 0 || from === to) return
      const reordered = [...ids]
      const [moved] = reordered.splice(from, 1)
      reordered.splice(to, 0, moved)
      setOrderMap(prev => ({ ...prev, [dateISO]: reordered }))
      try {
        await updateShiftPositions(dateISO, reordered)
      } catch (_) {
        // manter ordem local mesmo se persistência falhar; recarregar pode corrigir
      }
    }

    async function onDropOnContainer(e) {
      e.preventDefault()
      const srcId = e.dataTransfer.getData('text/plain')
      const srcDate = e.dataTransfer.getData('application/x-shift-date')
      if (!srcId) return
      // mesmo dia: mover para o final
      if (srcDate === dateISO) {
        const ids = orderedItems.map(x => x.id)
        const from = ids.indexOf(srcId)
        if (from < 0) return
        const reordered = [...ids]
        const [moved] = reordered.splice(from, 1)
        reordered.push(moved)
        setOrderMap(prev => ({ ...prev, [dateISO]: reordered }))
        try { await updateShiftPositions(dateISO, reordered) } catch (_) {}
        return
      }
      // dia diferente: copiar (criar novo assignment no destino) e anexar ao final
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
        const ids = [...orderedItems.map(x => x.id), created.id]
        setOrderMap(prev => ({ ...prev, [dateISO]: ids }))
        try { await updateShiftPositions(dateISO, ids) } catch (_) {}
      } catch (err) {
        alert(err?.message || 'Falha ao copiar plantão para o dia')
      }
    }
    return (
      <div
        className="h-130 flex flex-col rounded-xl border border-neutral-200 dark:border-neutral-800 p-2 gap-2 text-[11px]"
        onDragOver={(e)=>e.preventDefault()}
        onDrop={onDropOnContainer}
      >
        <div className="text-base font-bold text-center text-emerald-800">{String(day)}</div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {orderedItems.map(a => {
            const fnName = (functions.find(f => f.id === a.shift_function_id)?.name) || 'Função'
            const colName = (collaborators.find(c => c.id === a.collaborator_id)?.name) || 'Colaborador'
            return (
              <div
                key={a.id}
                draggable
                onDragStart={(e)=>onDragStartItem(e, a.id)}
                onDragOver={(e)=>{ e.preventDefault(); e.stopPropagation(); }}
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
                  <input type="checkbox" checked={!!a.remunerated} onChange={()=>toggleRemunerated(a)} title="Remunerado" />
                  <button className="p-1 text-red-600 font-bold hover:text-red-700 cursor-pointer" aria-label="Remover" onClick={()=>removeAssignment(a)}>X</button>
                </div>
              </div>
            )
          })}
        </div>
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
            <div key={`b-${idx}`} className="h-130 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800" />
          ) : (
            <DayCell key={`d-${c}`} day={c} />
          )
        ))}
      </div>
    </div>
  )
}
