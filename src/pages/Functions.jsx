import { useEffect, useState } from 'react'
import { listFunctions, createFunction, updateFunction, deleteFunction } from '../lib/db'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function Functions() {
  const { role } = useAuth()
  const canAdmin = role === 'admin' || role === 'super'

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await listFunctions()
      setRows(data || [])
    } catch (e) {
      setError(e.message || 'Erro ao carregar funções')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function onCreate() {
    setEditing(null)
    setName('')
    setOpenForm(true)
  }

  function onEdit(row) {
    setEditing(row)
    setName(row.name || '')
    setOpenForm(true)
  }

  async function onSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (editing) await updateFunction(editing.id, { name: name.trim() })
      else await createFunction({ name: name.trim() })
      setOpenForm(false)
      setEditing(null)
      setName('')
      await load()
    } catch (e) {
      setError(e.message || 'Falha ao salvar função')
    } finally {
      setSaving(false)
    }
  }

  async function onConfirmDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    setError(null)
    try {
      await deleteFunction(confirmDelete.id)
      setConfirmDelete(null)
      await load()
    } catch (e) {
      setError(e.message || 'Falha ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Funções</h1>
        {canAdmin && (
          <button onClick={onCreate} className="rounded-xl bg-neutral-900 text-white px-3 py-2.5">Nova função</button>
        )}
      </div>

      {loading ? (
        <div className="text-neutral-500">Carregando...</div>
      ) : error ? (
        <div className="text-red-600 bg-red-50 rounded-xl px-3 py-2 text-sm">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="py-2">Nome</th>
                <th className="py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-neutral-200">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2">
                    <div className="inline-flex gap-2">
                      <button onClick={()=>onEdit(r)} className="px-2 py-1 rounded-lg border border-neutral-200">Editar</button>
                      <button onClick={()=>setConfirmDelete(r)} className="px-2 py-1 rounded-lg border border-red-200 text-red-600">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="glass w-full max-w-md rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Editar função' : 'Nova função'}</h2>
            <form onSubmit={onSave} className="space-y-4">
              <input autoFocus required placeholder="Nome da função" value={name} onChange={(e)=>setName(e.target.value)} className="w-full rounded-xl border border-neutral-200 px-3 py-2.5"/>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>{setOpenForm(false);setEditing(null)}} className="px-3 py-2 rounded-xl border border-neutral-200">Cancelar</button>
                <button type="submit" disabled={saving} className="px-3 py-2 rounded-xl bg-neutral-900 text-white">{saving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="glass w-full max-w-md rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-2">Confirmar exclusão</h2>
            <p className="text-sm text-neutral-600 mb-4">Deseja realmente excluir a função {confirmDelete.name}?</p>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setConfirmDelete(null)} className="px-3 py-2 rounded-xl border border-neutral-200">Cancelar</button>
              <button onClick={onConfirmDelete} disabled={deleting} className="px-3 py-2 rounded-xl bg-red-600 text-white">{deleting? 'Excluindo...' : 'Excluir'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
