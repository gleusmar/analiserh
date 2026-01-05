import { useEffect, useMemo, useState } from 'react'
import { listAuditLogsPaged } from '../lib/db'

function classNames(...xs) { return xs.filter(Boolean).join(' ') }

export default function Logs() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [action, setAction] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const resp = await listAuditLogsPaged({ q, action, page, pageSize })
      setLogs(resp?.data || [])
      setTotal(resp?.count || 0)
    } catch (e) {
      setError(e.message || 'Erro ao carregar logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [q, action, page, pageSize])

  const actions = useMemo(() => {
    const xs = new Set((logs||[]).map(l => l.action))
    ;['profile:role:update','profile:status:update','invite:create','invite:revoke','invite:accept','sheet:create','sheet:update','sheet:delete','entry:create','entry:update','entry:delete','plantao:upsert','shift:create','shift:update','shift:delete','shift:reorder','shift:rate:upsert','holerite:import','holerite:remove','holerite:cleanup','profile:collaborator:link'].forEach(a=>xs.add(a))
    return Array.from(xs).sort()
  }, [logs])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Logs</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e)=>{setPage(1);setQ(e.target.value)}} placeholder="Buscar ator/alvo" className="rounded-xl border border-neutral-200 bg-white/60 px-3 py-2.5"/>
        <select value={action} onChange={(e)=>{setPage(1);setAction(e.target.value)}} className="rounded-xl border border-neutral-200 bg-white/60 px-3 py-2.5">
          <option value="all">todas ações</option>
          {actions.map(a => (<option key={a} value={a}>{a}</option>))}
        </select>
      </div>

      {loading ? (
        <div className="text-neutral-500">Carregando...</div>
      ) : error ? (
        <div className="text-red-600 bg-red-50 rounded-xl px-3 py-2 text-sm">{error}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr>
                  <th className="py-2">Ação</th>
                  <th className="py-2">Ator</th>
                  <th className="py-2">Alvo</th>
                  <th className="py-2">Detalhes</th>
                  <th className="py-2">Quando</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-neutral-200">
                    <td className="py-2">{log.action}</td>
                    <td className="py-2">{log.actor_email || '-'}</td>
                    <td className="py-2">{log.target_email || '-'}</td>
                    <td className="py-2 truncate max-w-[600px]">{log.details ? JSON.stringify(log.details) : '-'}</td>
                    <td className="py-2">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-neutral-600">
            <div>
              {total === 0 ? '0 resultados' : `${(page-1)*pageSize+1}-${Math.min(page*pageSize, total)} de ${total}`}
            </div>
            <div className="inline-flex items-center gap-2">
              <select value={pageSize} onChange={(e)=>{setPage(1);setPageSize(parseInt(e.target.value)||20)}} className="rounded-lg border border-neutral-200 bg-transparent px-2 py-1">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-2 py-1 rounded-lg border border-neutral-200 disabled:opacity-50">Anterior</button>
              <button disabled={page*pageSize>=total} onClick={()=>setPage(p=>p+1)} className="px-2 py-1 rounded-lg border border-neutral-200 disabled:opacity-50">Próxima</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
