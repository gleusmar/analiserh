import { useEffect, useMemo, useState } from 'react'
import { listShiftAssignments, listShiftFunctions, listCollaboratorsSimple, listShiftRateOverrides } from '../lib/db'

function formatISO(d) {
  const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}
function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1) }
function endOfMonth(date) { return new Date(date.getFullYear(), date.getMonth()+1, 0) }
function ymOf(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}` }
function formatBRfromYMD(ymd) { if (!ymd) return ''; const parts = String(ymd).split('-'); if (parts.length !== 3) return ymd; const [y,m,d] = parts; return `${d}/${m}/${y}` }

export default function ShiftsDashboard() {
  const [current, setCurrent] = useState(() => new Date())
  const [assignments, setAssignments] = useState([])
  const [functions, setFunctions] = useState([])
  const [collaborators, setCollaborators] = useState([])
  const [overrides, setOverrides] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [q, setQ] = useState('')
  const [filterFn, setFilterFn] = useState('all')
  const [filterCol, setFilterCol] = useState('all')
  const [filterRem, setFilterRem] = useState('all') // all | yes | no
  const [orderBy, setOrderBy] = useState('date')
  const [direction, setDirection] = useState('asc')

  const monthKey = ymOf(current)

  async function load() {
    setLoading(true); setError(null)
    try {
      const from = startOfMonth(current)
      const to = endOfMonth(current)
      const [asg, fns, cols, ovs] = await Promise.all([
        listShiftAssignments(formatISO(from), formatISO(to)),
        listShiftFunctions(),
        listCollaboratorsSimple(),
        listShiftRateOverrides(monthKey),
      ])
      setAssignments(asg||[])
      setFunctions(fns||[])
      setCollaborators(cols||[])
      const map = {}; (ovs||[]).forEach(o => { map[o.shift_function_id] = o.value })
      setOverrides(map)
    } catch (e) {
      setError(e.message || 'Erro ao carregar dashboard')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [current])

  const fnMap = useMemo(() => Object.fromEntries(functions.map(f => [f.id, f])), [functions])
  const colMap = useMemo(() => Object.fromEntries(collaborators.map(c => [c.id, c])), [collaborators])

  const rows = useMemo(() => {
    const items = (assignments||[]).map(a => {
      const fn = fnMap[a.shift_function_id]
      const col = colMap[a.collaborator_id]
      const base = fn?.base_value || 0
      const v = overrides[a.shift_function_id] ?? base
      const value = a.remunerated ? Number(v || 0) : 0
      return {
        id: a.id,
        date: a.date,
        function_id: a.shift_function_id,
        function_name: fn?.name || '-',
        collaborator_id: a.collaborator_id,
        collaborator_name: col?.name || '-',
        remunerated: !!a.remunerated,
        value,
      }
    })
    return items
  }, [assignments, fnMap, colMap, overrides])

  const filtered = useMemo(() => {
    let list = rows
    if (q) {
      const k = q.toLowerCase()
      list = list.filter(r => r.function_name.toLowerCase().includes(k) || r.collaborator_name.toLowerCase().includes(k))
    }
    if (filterFn !== 'all') list = list.filter(r => r.function_id === filterFn)
    if (filterCol !== 'all') list = list.filter(r => r.collaborator_id === filterCol)
    if (filterRem !== 'all') list = list.filter(r => r.remunerated === (filterRem === 'yes'))
    const cmp = (a,b) => {
      let av, bv
      switch (orderBy) {
        case 'date': av = a.date; bv = b.date; break
        case 'function_name': av = a.function_name.toLowerCase(); bv = b.function_name.toLowerCase(); break
        case 'collaborator_name': av = a.collaborator_name.toLowerCase(); bv = b.collaborator_name.toLowerCase(); break
        case 'value': av = a.value; bv = b.value; break
        default: av = a.date; bv = b.date
      }
      if (av < bv) return direction==='asc' ? -1 : 1
      if (av > bv) return direction==='asc' ? 1 : -1
      return 0
    }
    return [...list].sort(cmp)
  }, [rows, q, filterFn, filterCol, filterRem, orderBy, direction])

  const totalsByCollaborator = useMemo(() => {
    const map = {}
    filtered.forEach(r => { if (r.remunerated) map[r.collaborator_name] = (map[r.collaborator_name]||0) + r.value })
    return Object.entries(map).sort((a,b)=>b[1]-a[1])
  }, [filtered])
  const totalMonth = useMemo(() => totalsByCollaborator.reduce((s, [,v]) => s+v, 0), [totalsByCollaborator])

  function prevMonth() { setCurrent(d => new Date(d.getFullYear(), d.getMonth()-1, 1)) }
  function nextMonth() { setCurrent(d => new Date(d.getFullYear(), d.getMonth()+1, 1)) }
  function toggleSort(k) { if (orderBy===k) setDirection(d=>d==='asc'?'desc':'asc'); else { setOrderBy(k); setDirection('asc') } }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard de Plantões</h1>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={prevMonth} className="px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800">Anterior</button>
        <div className="text-sm font-medium w-40 text-center">{current.toLocaleDateString('pt-BR',{ month:'long', year:'numeric'})}</div>
        <button onClick={nextMonth} className="px-3 py-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800">Próximo</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Buscar (função ou colaborador)" className="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2.5"/>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-500">
            <tr>
              <th className="py-2"><button className="hover:underline inline-flex items-center gap-1" onClick={()=>toggleSort('date')}>Data {orderBy==='date' ? (direction==='asc'?'↑':'↓') : ''}</button></th>
              <th className="py-2"><button className="hover:underline inline-flex items-center gap-1" onClick={()=>toggleSort('function_name')}>Função {orderBy==='function_name' ? (direction==='asc'?'↑':'↓') : ''}</button></th>
              <th className="py-2"><button className="hover:underline inline-flex items-center gap-1" onClick={()=>toggleSort('collaborator_name')}>Colaborador {orderBy==='collaborator_name' ? (direction==='asc'?'↑':'↓') : ''}</button></th>
              <th className="py-2">Remun.</th>
              <th className="py-2"><button className="hover:underline inline-flex items-center gap-1" onClick={()=>toggleSort('value')}>Valor {orderBy==='value' ? (direction==='asc'?'↑':'↓') : ''}</button></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="py-2 px-2">{formatBRfromYMD(r.date)}</td>
                <td className="py-2 px-2">{r.function_name}</td>
                <td className="py-2 px-2">{r.collaborator_name}</td>
                <td className="py-2 px-2">{r.remunerated ? '✓' : ''}</td>
                <td className="py-2 px-2">{r.value.toLocaleString('pt-BR',{ style:'currency', currency:'BRL'})}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="font-semibold mb-2">Totais</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
            <div className="text-neutral-500 text-sm">Total do mês</div>
            <div className="text-lg font-semibold">{totalMonth.toLocaleString('pt-BR',{ style:'currency', currency:'BRL'})}</div>
          </div>
          <div className="md:col-span-2 rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
            <div className="text-neutral-500 text-sm mb-2">Por colaborador</div>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <tbody>
                  {totalsByCollaborator.map(([name, val]) => (
                    <tr key={name} className="border-t border-neutral-200 dark:border-neutral-800">
                      <td className="py-1 px-2">{name}</td>
                      <td className="py-1 px-2 text-right">{val.toLocaleString('pt-BR',{ style:'currency', currency:'BRL'})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
