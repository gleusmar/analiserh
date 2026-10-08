import { useState } from 'react'
import { centsToBRL, formatDateTimeBR } from '../../lib/finParse.js'
import { undoReconciliation } from '../../lib/financeiro.js'
import { Undo2 } from 'lucide-react'

export default function AuditPanel({ logs, onChanged }) {
  const [busyId, setBusyId] = useState(null)

  async function undo(log) {
    if (!window.confirm(`Desfazer a conciliação #${log.id}? Os lançamentos voltarão para o pool de não conciliados.`)) return
    setBusyId(log.id)
    try {
      await undoReconciliation(log.id)
      await onChanged()
    } catch (e) {
      alert(e.message || 'Erro ao desfazer conciliação')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 overflow-hidden bg-white">
      <div className="grid grid-cols-[140px_1fr_150px_150px_140px_110px_90px] gap-2 px-3 py-2 text-xs text-neutral-500 border-b border-neutral-200 bg-neutral-50">
        <span>Data</span><span>Usuário</span><span className="text-right">Internos</span><span className="text-right">Externos</span><span className="text-right">Diferença</span><span>Status</span><span></span>
      </div>
      <div className="max-h-[60vh] overflow-y-auto divide-y divide-neutral-100">
        {logs.map((log) => (
          <div key={log.id} className={`grid grid-cols-[140px_1fr_150px_150px_140px_110px_90px] gap-2 px-3 py-2 text-sm items-center ${log.status === 'UNDONE' ? 'opacity-50' : ''}`}>
            <span className="text-xs text-neutral-700">{formatDateTimeBR(log.created_at)}</span>
            <span className="truncate text-xs text-neutral-600">{log.user_email || '—'}</span>
            <span className="text-right text-xs tabular-nums">{log.internal_ids?.length || 0} item(s) · {centsToBRL(log.internal_total_cents)}</span>
            <span className="text-right text-xs tabular-nums">{log.external_ids?.length || 0} item(s) · {centsToBRL(log.external_total_cents)}</span>
            <span className="text-right text-xs tabular-nums">
              {log.discrepancy_cents ? (
                <span className="text-amber-700">{centsToBRL(log.discrepancy_cents)}{log.discrepancy_reason ? ` · ${log.discrepancy_reason}` : ''}</span>
              ) : <span className="text-emerald-700">—</span>}
            </span>
            <span>
              <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${log.status === 'RECONCILED' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-500'}`}>
                {log.status === 'RECONCILED' ? 'Conciliado' : 'Desfeito'}
              </span>
            </span>
            <span className="text-right">
              {log.status === 'RECONCILED' && (
                <button onClick={() => undo(log)} disabled={busyId === log.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-neutral-200 text-xs hover:bg-neutral-50 disabled:opacity-40">
                  <Undo2 className="size-3.5" /> Desfazer
                </button>
              )}
            </span>
          </div>
        ))}
        {logs.length === 0 && <div className="p-8 text-center text-sm text-neutral-500">Nenhuma conciliação registrada.</div>}
      </div>
    </div>
  )
}
