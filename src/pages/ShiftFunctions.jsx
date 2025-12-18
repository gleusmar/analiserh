import { useEffect, useMemo, useState } from 'react'
import { listShiftFunctions, createShiftFunction, updateShiftFunction, deleteShiftFunction, listShiftRateOverrides, upsertShiftRateOverride, deleteShiftRateOverride } from '../lib/db'

function classNames(...xs) { return xs.filter(Boolean).join(' ') }

export default function ShiftFunctions() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [name, setName] = useState('')
  const [baseValue, setBaseValue] = useState('')
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editBase, setEditBase] = useState('')

  const [month, setMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
  })
  const [overrides, setOverrides] = useState({}) // map by shift_function_id
  const overridesList = useMemo(() => Object.entries(overrides).map(([k,v])=>({ shift_function_id: Number(k), value: v })), [overrides])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [funcs, ov] = await Promise.all([
        listShiftFunctions(),
        listShiftRateOverrides(month),
      ])
      setRows(funcs || [])
      const map = {}
      ;(ov || []).forEach(o => { map[o.shift_function_id] = o.value })
      setOverrides(map)
    } catch (e) {
      setError(e.message || 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [month])

  async function onCreate(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await createShiftFunction({ name: name.trim(), base_value: Number(String(baseValue).replace(',', '.')) || 0 })
      setName(''); setBaseValue('')
      await load()
    } catch (e) {
      setError(e.message || 'Falha ao criar função')
    } finally {
      setSaving(false)
    }
  }

  function onEditStart(r) {
    setEditingId(r.id)
    setEditName(r.name)
    setEditBase(String(r.base_value))
  }

  async function onEditSave(id) {
    setSaving(true)
    setError(null)
    try {
      await updateShiftFunction(id, { name: editName.trim(), base_value: Number(String(editBase).replace(',', '.')) || 0 })
      setEditingId(null)
      await load()
    } catch (e) {
      setError(e.message || 'Falha ao atualizar função')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(id) {
    if (!confirm('Excluir esta função de plantão?')) return
    setSaving(true)
    setError(null)
    try {
      await deleteShiftFunction(id)
      await load()
    } catch (e) {
      setError(e.message || 'Falha ao excluir')
    } finally {
      setSaving(false)
    }
  }

  async function onOverrideChange(id, value) {
    setOverrides(o => ({ ...o, [id]: value }))
  }

  async function onOverrideSave(id) {
    try {
      const val = Number(String(overrides[id] ?? '').replace(',', '.'))
      const num = Number.isFinite(val) ? val : 0
      await upsertShiftRateOverride(month, id, num)
      setOverrides(o => ({ ...o, [id]: num }))
      try { localStorage.setItem('shift:rates:updated', JSON.stringify({ ym: month, at: Date.now() })) } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('shift:rates:update', { detail: { ym: month } })) } catch (_) {}
    } catch (e) {
      alert(e.message || 'Falha ao salvar valor do mês')
    }
  }

  async function onOverrideDelete(id) {
    try {
      await deleteShiftRateOverride(month, id)
      setOverrides(o => { const c = { ...o }; delete c[id]; return c })
      try { localStorage.setItem('shift:rates:updated', JSON.stringify({ ym: month, at: Date.now() })) } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('shift:rates:update', { detail: { ym: month } })) } catch (_) {}
    } catch (e) {
      alert(e.message || 'Falha ao excluir valor do mês')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Valores de Plantões</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm flex items-center gap-2">
            <span className="text-neutral-500">Mês</span>
            <input type="month" value={month} onChange={(e)=>setMonth(e.target.value)} className="rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2.5"/>
          </label>
        </div>
      </div>

      {error && <div className="text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30 rounded-xl px-3 py-2 text-sm">{error}</div>}

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="font-medium mb-2">Cadastro</h2>
          <form onSubmit={onCreate} className="flex flex-col sm:flex-row gap-2">
            <input required placeholder="Nome da função" value={name} onChange={(e)=>setName(e.target.value)} className="flex-1 rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2.5"/>
            <input required placeholder="Valor base" value={baseValue} onChange={(e)=>setBaseValue(e.target.value)} className="w-40 rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2.5"/>
            <button type="submit" disabled={saving} className="text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white px-3 py-2 disabled:opacity-50">Adicionar</button>
          </form>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr>
                  <th className="py-2">Nome</th>
                  <th className="py-2">Valor base</th>
                  <th className="py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="py-2">
                      {editingId===r.id ? (
                        <input value={editName} onChange={(e)=>setEditName(e.target.value)} className="rounded-xl border border-neutral-200 dark:border-neutral-800 px-2 py-1"/>
                      ) : r.name}
                    </td>
                    <td className="py-2">
                      {editingId===r.id ? (
                        <input value={editBase} onChange={(e)=>setEditBase(e.target.value)} className="rounded-xl border border-neutral-200 dark:border-neutral-800 px-2 py-1 w-32"/>
                      ) : (new Intl.NumberFormat('pt-BR',{ style:'currency', currency:'BRL'}).format(r.base_value || 0))}
                    </td>
                    <td className="py-2">
                      {editingId===r.id ? (
                        <div className="inline-flex gap-2">
                          <button type="button" onClick={()=>onEditSave(r.id)} className="px-2 py-1 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800">Salvar</button>
                          <button type="button" onClick={()=>setEditingId(null)} className="px-2 py-1 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800">Cancelar</button>
                        </div>
                      ) : (
                        <div className="inline-flex gap-2">
                          <button type="button" onClick={()=>onEditStart(r)} className="px-2 py-1 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800">Editar</button>
                          <button type="button" onClick={()=>onDelete(r.id)} className="px-2 py-1 text-xs rounded-lg border border-red-200 text-red-600 dark:border-red-900">Excluir</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="font-medium mb-2">Valores do mês</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr>
                  <th className="py-2">Função</th>
                  <th className="py-2">Base</th>
                  <th className="py-2">Valor no mês ({month})</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="py-2">{r.name}</td>
                    <td className="py-2">{new Intl.NumberFormat('pt-BR',{ style:'currency', currency:'BRL'}).format(r.base_value || 0)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <input value={overrides[r.id] ?? ''} onChange={(e)=>onOverrideChange(r.id, e.target.value)} onBlur={()=>onOverrideSave(r.id)} placeholder="R$" className="rounded-xl border border-neutral-200 dark:border-neutral-800 px-2 py-1 w-40"/>
                        <button type="button" onClick={()=>onOverrideSave(r.id)} className="px-2 py-1 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800">Salvar</button>
                        <button type="button" onClick={()=>onOverrideDelete(r.id)} className="px-2 py-1 text-xs rounded-lg border border-red-200 text-red-600 dark:border-red-900">Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
