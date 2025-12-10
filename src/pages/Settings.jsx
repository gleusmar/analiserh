import { useEffect, useMemo, useState } from 'react'
import { listShiftFunctions, listShiftRateOverrides, upsertShiftRateOverride } from '../lib/db'

function ymOf(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}` }

export default function Settings() {
  const [functions, setFunctions] = useState([])
  const [values, setValues] = useState({}) // { shift_function_id: value }
  const [saving, setSaving] = useState({}) // { id: boolean }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const monthKey = useMemo(() => ymOf(new Date()), [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [fn, ov] = await Promise.all([
          listShiftFunctions(),
          listShiftRateOverrides(monthKey),
        ])
        setFunctions(fn || [])
        const map = {}
        ;(ov || []).forEach(o => { map[o.shift_function_id] = o.value })
        setValues(map)
      } catch (e) {
        setError(e.message || 'Falha ao carregar valores de plantão')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [monthKey])

  async function saveOne(id) {
    setSaving(s => ({ ...s, [id]: true }))
    try {
      const v = Number(values[id] ?? '')
      if (!Number.isFinite(v)) return
      await upsertShiftRateOverride(monthKey, id, v)
    } catch (e) {
      alert(e.message || 'Falha ao salvar')
    } finally {
      setSaving(s => ({ ...s, [id]: false }))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <div className="text-sm text-neutral-500">Defina a ordem (número) de cada Valor de Plantão para o mês {monthKey}. Números menores aparecem primeiro no calendário.</div>
      </div>

      {error && (
        <div className="text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30 rounded-xl px-3 py-2 text-sm">{error}</div>
      )}

      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="grid grid-cols-6 bg-neutral-50 dark:bg-neutral-900/50 px-3 py-2 text-xs font-semibold">
          <div className="col-span-4">Função</div>
          <div className="col-span-1">Ordem</div>
          <div className="col-span-1 text-right">Ação</div>
        </div>
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {(loading ? Array.from({ length: 5 }) : functions).map((f, idx) => (
            <div key={f?.id || idx} className="grid grid-cols-6 px-3 py-2 items-center text-sm">
              <div className="col-span-4">{loading ? <div className="h-4 bg-neutral-200 dark:bg-neutral-800 rounded" /> : f.name}</div>
              <div className="col-span-1">
                {loading ? (
                  <div className="h-8 bg-neutral-200 dark:bg-neutral-800 rounded" />
                ) : (
                  <input type="number" className="w-24 rounded-lg border border-neutral-200 dark:border-neutral-800 px-2 py-1 text-sm"
                    value={values[f.id] ?? ''}
                    onChange={(e)=>setValues(v => ({ ...v, [f.id]: e.target.value }))}
                  />
                )}
              </div>
              <div className="col-span-1 text-right">
                {!loading && (
                  <button disabled={!!saving[f.id]} onClick={()=>saveOne(f.id)} className="px-3 py-1 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">Salvar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
