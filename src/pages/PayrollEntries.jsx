import { useEffect, useState } from 'react'
import { listPayrollEntryTypes, createPayrollEntryType, updatePayrollEntryType, deletePayrollEntryType } from '../lib/db'

export default function PayrollEntries() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [name, setName] = useState('')
  const [kind, setKind] = useState('out') // 'in' | 'out'
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editKind, setEditKind] = useState('out')

  async function load() {
    setLoading(true); setError(null)
    try {
      const data = await listPayrollEntryTypes()
      setRows(data || [])
    } catch (e) {
      setError(e.message || 'Falha ao carregar lançamentos')
    } finally { setLoading(false) }
  }
  useEffect(()=>{ load() }, [])

  async function onCreate(e) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await createPayrollEntryType({ name: name.trim(), kind })
      setName(''); setKind('out')
      await load()
    } catch (e) { setError(e.message || 'Falha ao criar') } finally { setSaving(false) }
  }

  function onEditStart(r) { setEditingId(r.id); setEditName(r.name); setEditKind(r.kind) }

  async function onEditSave(id) {
    setSaving(true); setError(null)
    try { await updatePayrollEntryType(id, { name: editName.trim(), kind: editKind }); setEditingId(null); await load() }
    catch (e) { setError(e.message || 'Falha ao salvar') }
    finally { setSaving(false) }
  }

  async function onDelete(id) {
    if (!confirm('Excluir este tipo de lançamento?')) return
    setSaving(true); setError(null)
    try { await deletePayrollEntryType(id); await load() }
    catch (e) { setError(e.message || 'Falha ao excluir') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lançamentos</h1>
      </div>

      {error && <div className="text-red-600 bg-red-50 rounded-xl px-3 py-2 text-sm">{error}</div>}

      <form onSubmit={onCreate} className="flex flex-wrap items-center gap-2">
        <input required placeholder="Nome" value={name} onChange={(e)=>setName(e.target.value)} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
        <select value={kind} onChange={(e)=>setKind(e.target.value)} className="rounded-xl border border-neutral-200 px-3 py-2.5">
          <option value="in">Entrada (acréscimo)</option>
          <option value="out">Saída (desconto)</option>
        </select>
        <button type="submit" disabled={saving} className="text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white px-3 py-2 disabled:opacity-50">Adicionar</button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-500">
            <tr>
              <th className="py-2">Nome</th>
              <th className="py-2">Tipo</th>
              <th className="py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-neutral-200">
                <td className="py-2">
                  {editingId===r.id ? (
                    <input value={editName} onChange={(e)=>setEditName(e.target.value)} className="rounded-xl border border-neutral-200 px-2 py-1"/>
                  ) : r.name}
                </td>
                <td className="py-2">
                  {editingId===r.id ? (
                    <select value={editKind} onChange={(e)=>setEditKind(e.target.value)} className="rounded-xl border border-neutral-200 px-2 py-1">
                      <option value="in">Entrada</option>
                      <option value="out">Saída</option>
                    </select>
                  ) : (r.kind === 'in' ? 'Entrada' : 'Saída')}
                </td>
                <td className="py-2">
                  {editingId===r.id ? (
                    <div className="inline-flex gap-2">
                      <button type="button" onClick={()=>onEditSave(r.id)} className="px-2 py-1 text-xs rounded-lg border border-neutral-200">Salvar</button>
                      <button type="button" onClick={()=>setEditingId(null)} className="px-2 py-1 text-xs rounded-lg border border-neutral-200">Cancelar</button>
                    </div>
                  ) : (
                    <div className="inline-flex gap-2">
                      <button type="button" onClick={()=>onEditStart(r)} className="px-2 py-1 text-xs rounded-lg border border-neutral-200">Editar</button>
                      <button type="button" onClick={()=>onDelete(r.id)} className="px-2 py-1 text-xs rounded-lg border border-red-200 text-red-600">Excluir</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
