import { useMemo, useState } from 'react'
import { centsToBRL, formatDateTimeBR, brlToCents } from '../../lib/finParse.js'
import { classifyMatchStates } from '../../lib/matcher.js'
import { reconcileEntries } from '../../lib/financeiro.js'
import { MatchBadge, TipoBadge } from './StatementTable.jsx'
import { Link2, Ban, PlusCircle } from 'lucide-react'

const DISCREPANCY_REASONS = ['Taxa Bancária', 'Pagamento a Menor', 'Pagamento a Maior', 'Perda Cambial', 'Arredondamento', 'Outro']

function useColumnFilter(items, dateField) {
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [minVal, setMinVal] = useState('')
  const [maxVal, setMaxVal] = useState('')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const min = minVal ? Math.abs(brlToCents(minVal) ?? 0) : null
    const max = maxVal ? Math.abs(brlToCents(maxVal) ?? 0) : null
    return items.filter((e) => {
      const day = String(e[dateField] || '').slice(0, 10)
      if (from && day < from) return false
      if (to && day > to) return false
      if (min !== null && Math.abs(e.amount_cents) < min) return false
      if (max !== null && Math.abs(e.amount_cents) > max) return false
      if (needle) {
        const hay = `${e.description || ''} ${e.counterpart || ''} ${e.counterpart_institution || ''} ${e.tipo || ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [items, q, from, to, minVal, maxVal, dateField])

  const bar = (
    <div className="flex flex-wrap gap-1.5">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." className="rounded-lg border border-neutral-200 bg-white/70 px-2 py-1.5 text-xs w-36" />
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-neutral-200 bg-white/70 px-2 py-1.5 text-xs" />
      <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-neutral-200 bg-white/70 px-2 py-1.5 text-xs" />
      <input value={minVal} onChange={(e) => setMinVal(e.target.value)} placeholder="Valor mín" className="rounded-lg border border-neutral-200 bg-white/70 px-2 py-1.5 text-xs w-20" />
      <input value={maxVal} onChange={(e) => setMaxVal(e.target.value)} placeholder="Valor máx" className="rounded-lg border border-neutral-200 bg-white/70 px-2 py-1.5 text-xs w-20" />
    </div>
  )

  return { filtered, bar }
}

export default function ReconcileView({ bankId, internalEntries, externalEntries, onChanged, onAddInternal, onIgnoreExternal }) {
  const [selInternal, setSelInternal] = useState(new Set())
  const [selExternal, setSelExternal] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null) // { internalIds, externalIds, diff }
  const [reason, setReason] = useState(DISCREPANCY_REASONS[0])
  const [reasonText, setReasonText] = useState('')

  const unmatchedInternal = useMemo(() => internalEntries.filter(e => e.status === 'unmatched'), [internalEntries])
  const unmatchedExternal = useMemo(() => externalEntries.filter(e => e.status === 'unmatched'), [externalEntries])

  const matchStates = useMemo(() => classifyMatchStates(internalEntries, externalEntries), [internalEntries, externalEntries])

  const left = useColumnFilter(unmatchedInternal, 'entry_date')
  const right = useColumnFilter(unmatchedExternal, 'occurred_at')

  const sumInternal = useMemo(() => unmatchedInternal.filter(e => selInternal.has(e.id)).reduce((s, e) => s + e.amount_cents, 0), [unmatchedInternal, selInternal])
  const sumExternal = useMemo(() => unmatchedExternal.filter(e => selExternal.has(e.id)).reduce((s, e) => s + e.amount_cents, 0), [unmatchedExternal, selExternal])
  const diff = Math.abs(sumInternal) - Math.abs(sumExternal)
  const canReconcile = selInternal.size > 0 || selExternal.size > 0

  function toggle(setFn, id) {
    setFn((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  function onClickReconcile() {
    if (!canReconcile || busy) return
    if (diff === 0) {
      doReconcile(null)
    } else {
      setReason(DISCREPANCY_REASONS[0]); setReasonText('')
      setConfirmModal({ internalIds: [...selInternal], externalIds: [...selExternal], diff })
    }
  }

  async function doReconcile(reasonValue) {
    setBusy(true)
    try {
      await reconcileEntries(bankId, [...selInternal], [...selExternal], reasonValue)
      setSelInternal(new Set()); setSelExternal(new Set())
      setConfirmModal(null)
      await onChanged()
    } catch (e) {
      alert(e.message || 'Erro ao conciliar')
    } finally {
      setBusy(false)
    }
  }

  const renderRow = (e, selected, setFn, stateMap, isExternal) => {
    const credit = e.amount_cents > 0
    const checked = selected.has(e.id)
    return (
      <div key={e.id} className={`flex items-center gap-2 px-2 py-2 rounded-lg border text-sm cursor-pointer transition ${checked ? 'border-sky-400 bg-sky-50' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
        onClick={() => toggle(setFn, e.id)}>
        <input type="checkbox" checked={checked} onChange={() => {}} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-neutral-500 whitespace-nowrap">
              {isExternal ? formatDateTimeBR(e.occurred_at) : new Date(e.entry_date + 'T00:00:00').toLocaleDateString('pt-BR')}
            </span>
            {isExternal && <TipoBadge tipo={e.tipo} />}
          </div>
          <div className="truncate font-medium text-neutral-800">{isExternal ? (e.counterpart || '—') : e.description}</div>
        </div>
        <div className="text-right shrink-0">
          <div className={`font-semibold tabular-nums ${credit ? 'text-emerald-700' : 'text-rose-600'}`}>{centsToBRL(e.amount_cents)}</div>
          <MatchBadge state={stateMap.get(e.id) || 'none'} />
        </div>
        {isExternal && (
          <div className="flex gap-1 shrink-0" onClick={(ev) => ev.stopPropagation()}>
            {onAddInternal && <button onClick={() => onAddInternal(e)} className="p-1 rounded hover:bg-neutral-100 text-sky-600" title="Criar lançamento interno"><PlusCircle className="size-4" /></button>}
            {onIgnoreExternal && <button onClick={() => onIgnoreExternal(e)} className="p-1 rounded hover:bg-neutral-100 text-neutral-400" title="Ignorar"><Ban className="size-4" /></button>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-neutral-600">
        Selecione lançamentos dos dois lados e clique em <b>Conciliar</b>. Suporta 1:1, 1:N e N:1.
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Transações internas não conciliadas</h3>
            <span className="text-xs text-neutral-500">{left.filtered.length} de {unmatchedInternal.length}</span>
          </div>
          {left.bar}
          <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: '52vh' }}>
            {left.filtered.map((e) => renderRow(e, selInternal, setSelInternal, matchStates.internal, false))}
            {left.filtered.length === 0 && <div className="p-6 text-center text-xs text-neutral-500">Nada pendente.</div>}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Lançamentos externos não conciliados</h3>
            <span className="text-xs text-neutral-500">{right.filtered.length} de {unmatchedExternal.length}</span>
          </div>
          {right.bar}
          <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: '52vh' }}>
            {right.filtered.map((e) => renderRow(e, selExternal, setSelExternal, matchStates.external, true))}
            {right.filtered.length === 0 && <div className="p-6 text-center text-xs text-neutral-500">Nada pendente.</div>}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 rounded-xl border border-neutral-300 bg-white shadow-lg px-4 py-3 flex flex-wrap items-center gap-4">
        <div className="text-sm">Internos: <b>{selInternal.size}</b> · <b className="tabular-nums">{centsToBRL(sumInternal)}</b></div>
        <div className="text-sm">Externos: <b>{selExternal.size}</b> · <b className="tabular-nums">{centsToBRL(sumExternal)}</b></div>
        <div className={`text-sm font-semibold ${diff === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
          Diferença: {centsToBRL(diff)} {diff === 0 && canReconcile ? '· exato' : ''}
        </div>
        <button
          onClick={onClickReconcile}
          disabled={!canReconcile || busy}
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-neutral-900 text-white px-4 py-2 text-sm disabled:opacity-40"
        >
          <Link2 className="size-4" /> {busy ? 'Conciliando...' : 'Conciliar'}
        </button>
      </div>

      {confirmModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="glass w-full max-w-md rounded-2xl p-6 space-y-3">
            <h3 className="text-lg font-semibold">Conciliação parcial (baixa de diferença)</h3>
            <div className="text-sm text-neutral-600 space-y-1">
              <div>Total interno: <b>{centsToBRL(sumInternal)}</b> ({selInternal.size})</div>
              <div>Total externo: <b>{centsToBRL(sumExternal)}</b> ({selExternal.size})</div>
              <div className="text-amber-700 font-semibold">Diferença: {centsToBRL(diff)}</div>
            </div>
            <label className="block text-sm">
              <span className="text-neutral-600">Motivo da discrepância</span>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-xl border border-neutral-200 bg-white/60 px-3 py-2.5">
                {DISCREPANCY_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            {reason === 'Outro' && (
              <input value={reasonText} onChange={(e) => setReasonText(e.target.value)} placeholder="Descreva o motivo" className="w-full rounded-xl border border-neutral-200 bg-white/60 px-3 py-2.5" />
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setConfirmModal(null)} className="px-3 py-2 rounded-xl border border-neutral-200">Cancelar</button>
              <button
                onClick={() => doReconcile(reason === 'Outro' ? reasonText.trim() : reason)}
                disabled={busy || (reason === 'Outro' && !reasonText.trim())}
                className="px-3 py-2 rounded-xl bg-neutral-900 text-white disabled:opacity-40"
              >{busy ? 'Conciliando...' : 'Confirmar conciliação'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
