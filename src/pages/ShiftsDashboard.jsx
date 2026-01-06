import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { listShiftAssignments, listShiftFunctions, listCollaboratorsSimple, listShiftRateOverrides } from '../lib/db'
import { useAuth } from '../contexts/AuthContext.jsx'

function formatISO(d) {
  const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0')
  return `${y}-${m}-${day}`
}
function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1) }
function endOfMonth(date) { return new Date(date.getFullYear(), date.getMonth()+1, 0) }
function ymOf(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}` }
function formatBRfromYMD(ymd) { if (!ymd) return ''; const parts = String(ymd).split('-'); if (parts.length !== 3) return ymd; const [y,m,d] = parts; return `${d}/${m}/${y}` }

export default function ShiftsDashboard() {
  const { profile, role } = useAuth()
  const isGestor = role === 'gestor-plantoes'
  const isUser = role === 'user'
  const myColId = profile?.collaborator_id || null
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
  const [onlyMine, setOnlyMine] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const monthKey = ymOf(current)

  const monthLabelShort = useMemo(() => {
    const m = String(current.getMonth() + 1).padStart(2, '0')
    const y = current.getFullYear()
    return `${m}/${y}`
  }, [current])

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

  // Refresh when monthly rates are updated elsewhere in the app
  useEffect(() => {
    function onRatesUpdate(e) {
      const ym = e?.detail?.ym
      if (!ym || ym === monthKey) load()
    }
    function onStorage(e) {
      if (e.key !== 'shift:rates:updated') return
      try {
        const v = JSON.parse(e.newValue || '{}')
        if (!v?.ym || v.ym === monthKey) load()
      } catch (_) {}
    }
    window.addEventListener('shift:rates:update', onRatesUpdate)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('shift:rates:update', onRatesUpdate)
      window.removeEventListener('storage', onStorage)
    }
  }, [monthKey])

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

    // Para usuários finais, sempre limitar ao colaborador vinculado.
    if (isUser) {
      if (myColId) {
        list = list.filter(r => r.collaborator_id === myColId)
      } else {
        // Sem colaborador vinculado: não mostrar registros.
        list = []
      }
    }
    if (q) {
      const k = q.toLowerCase()
      list = list.filter(r => r.function_name.toLowerCase().includes(k) || r.collaborator_name.toLowerCase().includes(k))
    }
    if (filterFn !== 'all') list = list.filter(r => r.function_id === filterFn)
    if (filterCol !== 'all') list = list.filter(r => r.collaborator_id === filterCol)
    if (onlyMine && myColId) list = list.filter(r => r.collaborator_id === myColId)
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
  }, [rows, q, filterFn, filterCol, filterRem, orderBy, direction, onlyMine, myColId, isUser])

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
    <div className="space-y-4">
      <div className="sticky pt-2 top-14 z-20 bg-white/95 backdrop-blur border-b border-neutral-200">
        <div className="py-2 px-1 items-center sm:px-2 flex flex-row gap-2 md:flex-row md:items-center">
          <div className="flex-1">
            <h1 className="text-sm md:text-2xl font-semibold">Plantões do mês</h1>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="inline-flex items-center gap-3 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-sm md:text-base font-medium text-emerald-900 shadow-sm">
              <button
                type="button"
                onClick={prevMonth}
                className="px-1"
                aria-label="Mês anterior"
              >
                &lt;
              </button>
              <span>{monthLabelShort}</span>
              <button
                type="button"
                onClick={nextMonth}
                className="px-1"
                aria-label="Próximo mês"
              >
                &gt;
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-end gap-2">
            {/* Desktop: campo de busca visível e filtro */}
            <div className="hidden md:flex items-center gap-3">
              <input
                value={q}
                onChange={(e)=>setQ(e.target.value)}
                placeholder="Buscar (função ou colaborador)"
                className="rounded-xl border border-neutral-200 px-3 py-2.5 w-64"
              />
              {isGestor && myColId && (
                <label className="inline-flex items-center gap-2 text-xs text-neutral-600">
                  <input
                    type="checkbox"
                    checked={onlyMine}
                    onChange={(e)=>setOnlyMine(e.target.checked)}
                  />
                  <span>Somente meu colaborador</span>
                </label>
              )}
            </div>

            {/* Mobile: ícone de busca */}
            <button
              type="button"
              onClick={()=>setSearchOpen(prev => !prev)}
              className="md:hidden w-8 h-8 grid place-items-center rounded-full border border-neutral-300 text-neutral-600 bg-white"
              aria-label="Buscar"
            >
              <Search className="size-4" />
            </button>
          </div>
        </div>

        {/* Mobile: campo de busca expansível e filtro */}
        <div className="md:hidden px-1 sm:px-2 pb-2 space-y-2">
          {searchOpen && (
            <input
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              placeholder="Buscar (função ou colaborador)"
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
          )}
          {isGestor && myColId && (
            <label className="inline-flex items-center gap-2 text-[11px] text-neutral-600">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e)=>setOnlyMine(e.target.checked)}
              />
              <span>Mostrar apenas meu colaborador vinculado</span>
            </label>
          )}
        </div>
      </div>

      {isUser && !myColId && (
        <div className="text-xs text-neutral-500 px-1 sm:px-2">
          Vincule um colaborador ao seu usuário para visualizar os plantões do mês.
        </div>
      )}

      {/* Mobile: cards legíveis */}
      <div className="space-y-2 md:hidden">
        {filtered.map(r => (
          <div
            key={r.id}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm text-xs flex flex-col gap-1"
          >
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <div className="font-semibold text-xs text-neutral-900">{formatBRfromYMD(r.date)}</div>
                <div className="mt-1">
                  <div className="text-xs font-semibold text-neutral-900 truncate">{r.collaborator_name}</div>
                  <div className="text-xs text-neutral-600 truncate">{r.function_name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-emerald-700">
                  {r.value.toLocaleString('pt-BR',{ style:'currency', currency:'BRL'})}
                </div>
                <div className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${r.remunerated ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>
                  {r.remunerated ? 'Remunerado' : 'Não remunerado'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: tabela completa */}
      <div className="hidden md:block overflow-x-auto">
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
              <tr key={r.id} className="border-t border-neutral-200">
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
          <div className="rounded-xl border border-neutral-200 p-3">
            <div className="text-neutral-500 text-sm">Total do mês</div>
            <div className="text-lg font-semibold">{totalMonth.toLocaleString('pt-BR',{ style:'currency', currency:'BRL'})}</div>
          </div>
          <div className="md:col-span-2 rounded-xl border border-neutral-200 p-3">
            <div className="text-neutral-500 text-sm mb-2">Por colaborador</div>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <tbody>
                  {totalsByCollaborator.map(([name, val]) => (
                    <tr key={name} className="border-t border-neutral-200">
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
