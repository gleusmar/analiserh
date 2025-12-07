export function CreateUserModal({ open, onClose, data, setData, onSubmit, busy, error }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
      <div className="glass w-full max-w-md rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">Criar usuário</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <input type="email" required value={data.email} onChange={(e)=>setData(d=>({...d,email:e.target.value}))} placeholder="E-mail" className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 px-3 py-2.5 outline-none" />
          <input type="password" required value={data.password} onChange={(e)=>setData(d=>({...d,password:e.target.value}))} placeholder="Senha temporária" className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 px-3 py-2.5 outline-none" />
          <select value={data.role} onChange={(e)=>setData(d=>({...d,role:e.target.value}))} className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 px-3 py-2.5">
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800">Cancelar</button>
            <button type="submit" disabled={busy} className="px-3 py-2 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">{busy? 'Criando...' : 'Criar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
