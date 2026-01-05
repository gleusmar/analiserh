import { useEffect, useState } from 'react'
import { listShiftFunctions, updateShiftFunctionOrder } from '../lib/db'

export default function Settings() {
  const [functions, setFunctions] = useState([])
  const [values, setValues] = useState({}) // { shift_function_id: sort_order }
  const [saving, setSaving] = useState({}) // { id: boolean }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const fn = await listShiftFunctions()
        setFunctions(fn || [])
        const map = {}
        ;(fn || []).forEach(f => { map[f.id] = (f.sort_order ?? '') })
        setValues(map)
      } catch (e) {
        setError(e.message || 'Falha ao carregar funções')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function saveOne(id) {
    setSaving(s => ({ ...s, [id]: true }))
    try {
      const raw = values[id]
      const v = raw === '' || raw === null || typeof raw === 'undefined' ? null : Number(raw)
      if (v !== null && !Number.isFinite(v)) return
      await updateShiftFunctionOrder(id, v)
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
        <div className="text-sm text-neutral-500">Defina a ordem fixa (número) de cada Valor de Plantão. Números menores aparecem primeiro no calendário.</div>
      </div>

      {error && (
        <div className="text-red-600 bg-red-50 rounded-xl px-3 py-2 text-sm">{error}</div>
      )}

      <div className="rounded-xl border border-neutral-200 overflow-hidden">
        <div className="grid grid-cols-6 bg-neutral-50 px-3 py-2 text-xs font-semibold">
          <div className="col-span-4">Função</div>
          <div className="col-span-1">Ordem fixa</div>
          <div className="col-span-1 text-right">Ação</div>
        </div>
        <div className="divide-y divide-neutral-200">
          {(loading ? Array.from({ length: 5 }) : functions).map((f, idx) => (
            <div key={f?.id || idx} className="grid grid-cols-6 px-3 py-2 items-center text-sm">
              <div className="col-span-4">{loading ? <div className="h-4 bg-neutral-200 rounded" /> : f.name}</div>
              <div className="col-span-1">
                {loading ? (
                  <div className="h-8 bg-neutral-200 rounded" />
                ) : (
                  <input type="number" className="w-24 rounded-lg border border-neutral-200 px-2 py-1 text-sm"
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
