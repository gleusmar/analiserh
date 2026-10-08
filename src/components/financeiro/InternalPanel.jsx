import { useEffect, useState } from 'react'
import { centsToBRL, brlToCents } from '../../lib/finParse.js'
import { createInternalEntry, deleteInternalEntry } from '../../lib/financeiro.js'
import { MatchBadge } from './StatementTable.jsx'
import { Plus, Trash2 } from 'lucide-react'

export function InternalEntryForm({ bankId, prefill, onSaved, onCancel }) {
  const [form, setForm] = useState({ date: '', description: '', value: '', kind: 'C', note: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (prefill) {
      setForm({
        date: String(prefill.occurred_at || '').slice(0, 10),
        description: prefill.counterpart || prefill.tipo || '',
        value: (Math.abs(prefill.amount_cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        kind: prefill.amount_cents >= 0 ? 'C' : 'D',
        note: `Gerado do extrato: ${prefill.tipo || ''} ${prefill.occurred_at ? formatDateTimeShort(prefill.occurred_at) : ''}`.trim(),
      })
    }
  }, [prefill])

  function formatDateTimeShort(iso) {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR')
  }

  async function save(e) {
    e.preventDefault()
    const cents = brlToCents(form.value)
    if (cents === null || cents === 0) { alert('Informe um valor válido'); return }
    if (!form.date) { alert('Informe a data'); return }
    if (!form.description.trim()) { alert('Informe a descrição'); return }
    setBusy(true)
    try {
      await createInternalEntry({
        bank_id: bankId,
        entry_date: form.date,
        description: form.description.trim(),
        amount_cents: form.kind === 'D' ? -Math.abs(cents) : Math.abs(cents),
        note: form.note || null,
      })
      setForm({ date: '', description: '', value: '', kind: 'C', note: '' })
      await onSaved()
    } catch (e2) {
      alert(e2.message || 'Erro ao salvar lançamento')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3 space-y-2">
      <div className="text-sm font-semibold">{prefill ? 'Novo lançamento (a partir do extrato)' : 'Novo lançamento interno'}</div>
      <div className="grid sm:grid-cols-[140px_1fr_140px_110px] gap-2">
        <input type="date" required value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} className="rounded-xl border border-neutral-200 bg-white/70 px-3 py-2 text-sm" />
        <input required value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição" className="rounded-xl border border-neutral-200 bg-white/70 px-3 py-2 text-sm" />
        <input required value={form.value} onChange={(e) => setForm(f => ({ ...f, value: e.target.value }))} placeholder="0,00" inputMode="decimal" className="rounded-xl border border-neutral-200 bg-white/70 px-3 py-2 text-sm text-right" />
        <select value={form.kind} onChange={(e) => setForm(f => ({ ...f, kind: e.target.value }))} className="rounded-xl border border-neutral-200 bg-white/70 px-3 py-2 text-sm">
          <option value="C">Crédito</option>
          <option value="D">Débito</option>
        </select>
      </div>
      <input value={form.note} onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Observação (opcional)" className="w-full rounded-xl border border-neutral-200 bg-white/70 px-3 py-2 text-sm" />
      <div className="flex justify-end gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="px-3 py-2 rounded-xl border border-neutral-200 text-sm">Cancelar</button>}
        <button type="submit" disabled={busy} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900 text-white text-sm disabled:opacity-40">
          <Plus className="size-4" /> {busy ? 'Salvando...' : 'Adicionar'}
        </button>
      </div>
    </form>
  )
}

export default function InternalPanel({ bankId, entries, matchStates, onChanged, prefill, onClearPrefill }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')

  const filtered = entries.filter((e) => {
    if (status !== 'all' && e.status !== status) return false
    if (q.trim() && !(`${e.description} ${e.note || ''}`.toLowerCase().includes(q.trim().toLowerCase()))) return false
    return true
  })

  async function remove(e) {
    if (!window.confirm(`Excluir lançamento "${e.description}"?`)) return
    try { await deleteInternalEntry(e.id); await onChanged() } catch (e2) { alert(e2.message || 'Erro ao excluir') }
  }

  return (
    <div className="space-y-3">
      <InternalEntryForm bankId={bankId} prefill={prefill} onSaved={async () => { onClearPrefill?.(); await onChanged() }} onCancel={prefill ? onClearPrefill : null} />

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar descrição..." className="rounded-xl border border-neutral-200 bg-white/60 px-3 py-2 text-sm w-64" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-neutral-200 bg-white/60 px-2 py-2 text-sm">
          <option value="all">Status: todos</option>
          <option value="unmatched">Não conciliado</option>
          <option value="matched">Conciliado</option>
          <option value="ignored">Ignorado</option>
        </select>
        <div className="ml-auto text-xs text-neutral-500">{filtered.length} lançamentos</div>
      </div>

      <div className="rounded-xl border border-neutral-200 overflow-hidden bg-white">
        <div className="grid grid-cols-[110px_1fr_120px_110px_1fr_60px] gap-2 px-3 py-2 text-xs text-neutral-500 border-b border-neutral-200 bg-neutral-50">
          <span>Data</span><span>Descrição</span><span className="text-right">Valor</span><span>Status</span><span>Observação</span><span></span>
        </div>
        <div className="max-h-[55vh] overflow-y-auto divide-y divide-neutral-100">
          {filtered.map((e) => {
            const credit = e.amount_cents > 0
            return (
              <div key={e.id} className={`grid grid-cols-[110px_1fr_120px_110px_1fr_60px] gap-2 px-3 py-2 text-sm items-center ${credit ? 'bg-emerald-50/40' : 'bg-rose-50/40'}`}>
                <span className="text-xs text-neutral-700">{new Date(e.entry_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                <span className="truncate font-medium text-neutral-800">{e.description}</span>
                <span className={`text-right font-semibold tabular-nums ${credit ? 'text-emerald-700' : 'text-rose-600'}`}>{centsToBRL(e.amount_cents)}</span>
                <span><MatchBadge state={matchStates?.internal.get(e.id) || e.status} /></span>
                <span className="truncate text-xs text-neutral-500">{e.note || ''}</span>
                <span className="text-right">
                  {e.status === 'unmatched' && (
                    <button onClick={() => remove(e)} className="p-1 rounded hover:bg-red-50 text-red-500" title="Excluir"><Trash2 className="size-4" /></button>
                  )}
                </span>
              </div>
            )
          })}
          {filtered.length === 0 && <div className="p-8 text-center text-sm text-neutral-500">Nenhum lançamento interno.</div>}
        </div>
      </div>
    </div>
  )
}
