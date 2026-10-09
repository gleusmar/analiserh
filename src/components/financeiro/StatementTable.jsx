import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { centsToBRL, formatDateTimeBR } from '../../lib/finParse.js'
import { ArrowDownUp, Ban, PlusCircle } from 'lucide-react'

const TIPO_STYLES = {
  'Pix': 'bg-teal-100 text-teal-800',
  'Transação': 'bg-sky-100 text-sky-800',
  'Recebível de Cartão': 'bg-violet-100 text-violet-800',
  'Pagamento': 'bg-amber-100 text-amber-800',
  'TED': 'bg-indigo-100 text-indigo-800',
}

export function MatchBadge({ state }) {
  const map = {
    matched: ['Conciliado', 'bg-emerald-100 text-emerald-800'],
    exact: ['Conciliável', 'bg-emerald-50 text-emerald-700 border border-emerald-200'],
    partial: ['Parcial', 'bg-amber-100 text-amber-800'],
    none: ['Não conciliado', 'bg-neutral-100 text-neutral-500'],
    ignored: ['Ignorado', 'bg-neutral-200 text-neutral-500 line-through'],
  }
  const [label, cls] = map[state] || map.none
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{label}</span>
}

export function TipoBadge({ tipo }) {
  const cls = TIPO_STYLES[tipo] || 'bg-neutral-100 text-neutral-700'
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{tipo || '—'}</span>
}

function SortHeader({ label, field, sort, onSort, className = '' }) {
  const active = sort.field === field
  return (
    <button onClick={() => onSort(field)} className={`inline-flex items-center gap-1 text-left font-medium ${className} ${active ? 'text-neutral-900' : ''}`}>
      {label}
      <ArrowDownUp className={`size-3 ${active ? 'opacity-100' : 'opacity-30'}`} />
      {active && <span className="text-[9px]">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
    </button>
  )
}

export default function StatementTable({ entries, matchStates, onIgnore, onAddInternal }) {
  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState('all')
  const [mov, setMov] = useState('all')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState({ field: 'occurred_at', dir: 'desc' })

  const tipos = useMemo(() => [...new Set(entries.map(e => e.tipo).filter(Boolean))].sort(), [entries])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let xs = entries.filter((e) => {
      if (tipo !== 'all' && e.tipo !== tipo) return false
      if (mov !== 'all' && e.movimentacao !== mov) return false
      if (status !== 'all' && (matchStates?.get(e.id) || (e.status === 'unmatched' ? 'none' : e.status)) !== status) return false
      if (from && e.occurred_at.slice(0, 10) < from) return false
      if (to && e.occurred_at.slice(0, 10) > to) return false
      if (needle) {
        const hay = `${e.counterpart || ''} ${e.counterpart_doc || ''} ${e.counterpart_institution || ''} ${e.tipo || ''} ${e.nosso_numero || ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    xs = [...xs].sort((a, b) => {
      let va, vb
      switch (sort.field) {
        case 'valor': va = a.amount_cents; vb = b.amount_cents; break
        case 'saldo': va = a.balance_after_cents ?? 0; vb = b.balance_after_cents ?? 0; break
        case 'tipo': va = a.tipo || ''; vb = b.tipo || ''; break
        case 'descricao': va = a.counterpart || ''; vb = b.counterpart || ''; break
        default: va = a.occurred_at; vb = b.occurred_at
      }
      if (va < vb) return -dir
      if (va > vb) return dir
      return b.id - a.id
    })
    return xs
  }, [entries, q, tipo, mov, status, from, to, sort, matchStates])

  const totals = useMemo(() => {
    let sum = 0
    for (const e of filtered) sum += e.amount_cents
    return { count: filtered.length, sum }
  }, [filtered])

  function onSort(field) {
    setSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' })
  }

  const parentRef = useRef(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 12,
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar descrição, documento, instituição..." className="rounded-xl border border-neutral-200 bg-white/60 px-3 py-2 text-sm w-72" />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-xl border border-neutral-200 bg-white/60 px-2 py-2 text-sm">
          <option value="all">Tipo: todos</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={mov} onChange={(e) => setMov(e.target.value)} className="rounded-xl border border-neutral-200 bg-white/60 px-2 py-2 text-sm">
          <option value="all">Movimentação: todas</option>
          <option value="Crédito">Crédito</option>
          <option value="Débito">Débito</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-neutral-200 bg-white/60 px-2 py-2 text-sm">
          <option value="all">Status: todos</option>
          <option value="matched">Conciliado</option>
          <option value="exact">Conciliável</option>
          <option value="partial">Parcial</option>
          <option value="none">Não conciliado</option>
          <option value="ignored">Ignorado</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-neutral-200 bg-white/60 px-2 py-2 text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-neutral-200 bg-white/60 px-2 py-2 text-sm" />
        {(q || tipo !== 'all' || mov !== 'all' || status !== 'all' || from || to) && (
          <button onClick={() => { setQ(''); setTipo('all'); setMov('all'); setStatus('all'); setFrom(''); setTo('') }} className="text-xs text-sky-600 underline">Limpar filtros</button>
        )}
        <div className="ml-auto text-xs text-neutral-500">
          {totals.count} lançamentos · Total filtrado: <b>{centsToBRL(totals.sum)}</b>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 overflow-hidden bg-white">
        <div className="grid grid-cols-[130px_120px_1fr_90px_110px_90px_110px_120px_110px] gap-2 px-3 py-2 text-xs text-neutral-500 border-b border-neutral-200 bg-neutral-50">
          <SortHeader label="Data" field="occurred_at" sort={sort} onSort={onSort} />
          <SortHeader label="Tipo" field="tipo" sort={sort} onSort={onSort} />
          <SortHeader label="Descrição" field="descricao" sort={sort} onSort={onSort} />
          <span>C/D</span>
          <SortHeader label="Valor" field="valor" sort={sort} onSort={onSort} className="justify-end" />
          <span className="text-right">Tarifa</span>
          <SortHeader label="Saldo" field="saldo" sort={sort} onSort={onSort} className="justify-end" />
          <span>Conciliação</span>
          <span>Ações</span>
        </div>

        <div ref={parentRef} className="overflow-auto" style={{ maxHeight: '65vh' }}>
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const e = filtered[vi.index]
              const credit = e.amount_cents > 0
              const state = matchStates?.get(e.id) || (e.status === 'matched' ? 'matched' : e.status === 'ignored' ? 'ignored' : 'none')
              return (
                <div
                  key={e.id}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}
                  className={`grid grid-cols-[130px_120px_1fr_90px_110px_90px_110px_120px_110px] gap-2 px-3 py-2 text-sm border-b border-neutral-100 items-center ${credit ? 'bg-emerald-50/40' : 'bg-rose-50/40'} ${e.status === 'ignored' ? 'opacity-50' : ''}`}
                >
                  <span className="text-xs text-neutral-700 whitespace-nowrap">{formatDateTimeBR(e.occurred_at)}</span>
                  <span><TipoBadge tipo={e.tipo} /></span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-neutral-800">{e.counterpart || '—'}</span>
                    <span className="block truncate text-[10px] text-neutral-500">
                      {[e.counterpart_doc !== 'Desconhecido' ? e.counterpart_doc : null, e.counterpart_institution !== 'Desconhecido' ? e.counterpart_institution : null].filter(Boolean).join(' · ') || e.situacao || ''}
                    </span>
                  </span>
                  <span className={`text-[10px] font-bold ${credit ? 'text-emerald-700' : 'text-rose-700'}`}>{credit ? 'C' : 'D'}</span>
                  <span className={`text-right font-semibold tabular-nums ${credit ? 'text-emerald-700' : 'text-rose-600'}`}>{centsToBRL(e.amount_cents)}</span>
                  <span className="text-right text-xs text-neutral-500 tabular-nums">{e.fee_cents ? centsToBRL(e.fee_cents) : '—'}</span>
                  <span className="text-right text-xs text-neutral-600 tabular-nums">{centsToBRL(e.balance_after_cents)}</span>
                  <span><MatchBadge state={state} /></span>
                  <span className="flex gap-1">
                    {e.status === 'unmatched' && (
                      <>
                        {onAddInternal && (
                          <button onClick={() => onAddInternal(e)} className="p-1 rounded hover:bg-white text-sky-600" title="Adicionar lançamento interno"><PlusCircle className="size-4" /></button>
                        )}
                        {onIgnore && (
                          <button onClick={() => onIgnore(e)} className="p-1 rounded hover:bg-white text-neutral-400" title="Ignorar"><Ban className="size-4" /></button>
                        )}
                      </>
                    )}
                  </span>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-neutral-500">Nenhum lançamento encontrado.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
