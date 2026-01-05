import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileDown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  listShiftAssignments,
  listShiftFunctions,
  listVacations,
  listPayrollSheets,
  listPayrollSheetItems,
  listPayrollEntriesForItem,
  listShiftRateOverrides,
} from '../lib/db'

function ymOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function formatISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateBR(ymd) {
  if (!ymd) return ''
  const parts = String(ymd).split('-')
  if (parts.length !== 3) return ymd
  const [y, m, d] = parts
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
}

function formatBRL(n) {
  const v = Number(n || 0)
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Dashboard() {
  const { profile, role, user } = useAuth()
  const myColId = profile?.collaborator_id || null
  const [monthRef, setMonthRef] = useState(() => new Date())

  const [shiftFns, setShiftFns] = useState([])
  const [shiftOverrides, setShiftOverrides] = useState([])
  const [myShifts, setMyShifts] = useState([])
  const [vacations, setVacations] = useState([])
  const [payHistory, setPayHistory] = useState([])

  const [loadingShifts, setLoadingShifts] = useState(false)
  const [loadingPayroll, setLoadingPayroll] = useState(false)
  const [error, setError] = useState(null)

  const fnMap = useMemo(() => {
    const m = {}
    ;(shiftFns || []).forEach(f => { m[f.id] = f })
    return m
  }, [shiftFns])

  const fnValueMap = useMemo(() => {
    const m = {}
    ;(shiftFns || []).forEach(f => { m[f.id] = Number(f.base_value || 0) })
    ;(shiftOverrides || []).forEach(o => { m[o.shift_function_id] = Number(o.value || 0) })
    return m
  }, [shiftFns, shiftOverrides])

  useEffect(() => {
    if (!myColId) return
    let cancelled = false
    async function loadShifts() {
      setLoadingShifts(true)
      setError(null)
      try {
        const from = startOfMonth(monthRef)
        const to = endOfMonth(monthRef)
        const ym = ymOf(monthRef)
        const [fns, ovs, asg] = await Promise.all([
          listShiftFunctions(),
          listShiftRateOverrides(ym),
          listShiftAssignments(formatISO(from), formatISO(to)),
        ])
        if (cancelled) return
        setShiftFns(fns || [])
        setShiftOverrides(ovs || [])
        const mine = (asg || []).filter(a => a.collaborator_id === myColId)
        setMyShifts(mine)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Erro ao carregar plantões')
      } finally {
        if (!cancelled) setLoadingShifts(false)
      }
    }
    loadShifts()
    return () => { cancelled = true }
  }, [monthRef, myColId])

  useEffect(() => {
    if (!myColId) return
    let cancelled = false
    async function loadVacations() {
      try {
        const vs = await listVacations({ onlyMine: true, myCollaboratorId: myColId })
        if (cancelled) return
        const currentYear = new Date().getFullYear()
        const filtered = (vs || []).filter(v => {
          const yStart = Number(String(v.start_date || '').slice(0, 4)) || currentYear
          const yEnd = Number(String(v.end_date || '').slice(0, 4)) || currentYear
          return yStart === currentYear || yEnd === currentYear
        })
        setVacations(filtered)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Erro ao carregar férias')
      }
    }
    loadVacations()
    return () => { cancelled = true }
  }, [myColId])

  useEffect(() => {
    if (!myColId) return
    let cancelled = false
    async function loadPayroll() {
      setLoadingPayroll(true)
      try {
        const sheets = await listPayrollSheets()
        if (cancelled) return
        const latestSheets = (sheets || []).slice(0, 12)
        const itemsPerSheet = await Promise.all(latestSheets.map(async (sheet) => {
          const items = await listPayrollSheetItems(sheet.id)
          return { sheet, items: items || [] }
        }))
        if (cancelled) return
        const pairs = itemsPerSheet.map(({ sheet, items }) => {
          const item = items.find(it => it.collaborator_id === myColId)
          return item ? { sheet, item } : null
        }).filter(Boolean)
        const entriesLists = await Promise.all(pairs.map(p => listPayrollEntriesForItem(p.item.id)))
        if (cancelled) return
        const rows = pairs.map((p, idx) => {
          const entries = entriesLists[idx] || []
          const inc = entries
            .filter(e => e.payroll_entry_types?.kind === 'in')
            .reduce((s, x) => s + Number(x.amount || 0), 0)
          const out = entries
            .filter(e => e.payroll_entry_types?.kind === 'out')
            .reduce((s, x) => s + Number(x.amount || 0), 0)
          const total = inc - out
          return {
            sheetId: p.sheet.id,
            name: p.sheet.name,
            year_month: p.sheet.year_month,
            inc,
            out,
            total,
            entries,
          }
        })
        setPayHistory(rows)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Erro ao carregar remunerações')
      } finally {
        if (!cancelled) setLoadingPayroll(false)
      }
    }
    loadPayroll()
    return () => { cancelled = true }
  }, [myColId])

  const totalShiftsMonth = myShifts.length
  const totalRemShiftsMonth = useMemo(
    () => myShifts.filter(a => a.remunerated).length,
    [myShifts]
  )

  const totalShiftValueMonth = useMemo(
    () => myShifts
      .filter(a => a.remunerated)
      .reduce((s, a) => s + (fnValueMap[a.shift_function_id] || 0), 0),
    [myShifts, fnValueMap]
  )

  const upcomingVacation = useMemo(() => {
    if (!vacations.length) return null
    const today = new Date()
    const withDates = vacations.map(v => ({
      ...v,
      start: new Date(v.start_date),
    }))
    return withDates
      .filter(v => !isNaN(v.start.getTime()) && v.start >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
      .sort((a, b) => a.start - b.start)[0] || null
  }, [vacations])

  const lastPay = payHistory.length ? payHistory[0] : null

  const [selectedSheetId, setSelectedSheetId] = useState(null)

  async function downloadHolerite(sheetId) {
    if (!myColId) return
    try {
      const r = await fetch('/api/holerites/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.id ? { 'x-actor-id': user.id } : {}),
          ...(user?.email ? { 'x-actor-email': user.email } : {}),
        },
        body: JSON.stringify({ sheetId, collaborator_id: myColId }),
      })
      if (!r.ok) throw new Error(await r.text())
      const { url } = await r.json()
      if (!url) {
        alert('Holerite não encontrado para esta folha')
        return
      }
      window.open(url, '_blank')
    } catch (e) {
      alert(e.message || 'Falha ao baixar holerite')
    }
  }

  function prevMonth() {
    setMonthRef(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }

  function nextMonth() {
    setMonthRef(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }

  const monthLabel = useMemo(
    () => monthRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    [monthRef]
  )

  const shiftsSorted = useMemo(() => {
    return [...myShifts].sort((a, b) => a.date.localeCompare(b.date))
  }, [myShifts])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-sm text-neutral-600">
              Visão geral rápida dos seus plantões, férias e remunerações.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/shifts"
            className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            Ver calendário de plantões
          </Link>
          <Link
            to="/payroll/vacations"
            className="px-3 py-1.5 text-xs rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
          >
            Ver minhas férias
          </Link>
          <Link
            to="/payroll"
            className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            Ir para folhas mensais
          </Link>
        </div>
      </div>

      {!myColId && (
        <div className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
          Seu usuário ainda não está vinculado a um colaborador. Solicite ao administrador para associar seu perfil
          a um colaborador para visualizar plantões, férias e holerites personalizados.
        </div>
      )}

      {error && (
        <div className="text-xs text-red-700 bg-red-50 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 flex flex-col gap-2">
          <div className="text-xs text-neutral-500">Colaborador vinculado</div>
          <div className="text-sm font-semibold text-neutral-900">
            {profile?.collaborators?.name || '-'}
          </div>
          <div className="text-xs text-neutral-500">
            ID Concent:{' '}
            <span className="font-mono text-neutral-700">
              {profile?.collaborators?.concent_id || '-'}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 flex flex-col gap-2">
          <div className="text-xs text-neutral-500">Plantões neste mês</div>
          <div className="text-2xl font-semibold text-neutral-900">
            {totalShiftsMonth}
          </div>
          <div className="text-xs text-neutral-500">
            {totalRemShiftsMonth} remunerados
          </div>
          <div className="text-xs text-neutral-500">
            Total (remunerados):{' '}
            <span className="font-semibold text-neutral-800">{formatBRL(totalShiftValueMonth)}</span>
          </div>
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 flex flex-col gap-2">
          <div className="text-xs text-neutral-500">Última remuneração líquida</div>
          <div className="text-2xl font-semibold text-neutral-900">
            {lastPay ? formatBRL(lastPay.total) : '-'}
          </div>
          <div className="text-xs text-neutral-500">
            {lastPay ? `Referente à folha ${lastPay.year_month}` : 'Ainda não há folhas com lançamentos para você.'}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-neutral-200 p-4 space-y-3 bg-white">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Meus plantões</div>
              <div className="text-xs text-neutral-500">Listagem dos plantões do colaborador vinculado no mês selecionado.</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="px-2 py-1 text-xs rounded-lg border border-neutral-200 hover:bg-neutral-50"
              >
                Anterior
              </button>
              <div className="text-xs font-medium min-w-[120px] text-center">
                {monthLabel}
              </div>
              <button
                onClick={nextMonth}
                className="px-2 py-1 text-xs rounded-lg border border-neutral-200 hover:bg-neutral-50"
              >
                Próximo
              </button>
            </div>
          </div>

          {!myColId && (
            <div className="text-xs text-neutral-500">
              Vincule um colaborador ao seu usuário para visualizar os plantões.
            </div>
          )}

          {loadingShifts && (
            <div className="text-xs text-neutral-500">Carregando plantões...</div>
          )}

          {!loadingShifts && myColId && shiftsSorted.length === 0 && (
            <div className="text-xs text-neutral-500">Nenhum plantão encontrado para este mês.</div>
          )}

          {!loadingShifts && shiftsSorted.length > 0 && (
            <div className="rounded-xl border border-neutral-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-neutral-50 text-neutral-500">
                  <tr>
                    <th className="py-2 px-2 text-left">Data</th>
                    <th className="py-2 px-2 text-left">Função</th>
                    <th className="py-2 px-2 text-left">Remuneração</th>
                    <th className="py-2 px-2 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftsSorted.map(s => (
                    <tr key={s.id} className="border-t border-neutral-100">
                      <td className="py-1.5 px-2 text-sm">{formatDateBR(s.date)}</td>
                      <td className="py-1.5 px-2 text-sm">{fnMap[s.shift_function_id]?.name || '-'}</td>
                      <td className="py-1.5 px-2 text-sm">
                        {s.remunerated ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[11px]">
                            Remunerado
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-neutral-100 text-neutral-600 px-2 py-0.5 text-[11px]">
                            Não remunerado
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-sm text-right">
                        {s.remunerated ? formatBRL(fnValueMap[s.shift_function_id] || 0) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 p-4 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Férias do ano corrente</div>
              <div className="text-xs text-neutral-500">Períodos de férias do colaborador neste ano.</div>
            </div>
            {upcomingVacation && (
              <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[11px]">
                Próxima: {formatDateBR(upcomingVacation.start_date)}
              </span>
            )}
          </div>

          {!myColId && (
            <div className="text-xs text-neutral-500">
              Vincule um colaborador ao seu usuário para visualizar as férias.
            </div>
          )}

          {myColId && vacations.length === 0 && (
            <div className="text-xs text-neutral-500">Nenhum registro de férias para o ano corrente.</div>
          )}

          {myColId && vacations.length > 0 && (
            <div className="space-y-2 text-xs">
              {vacations.map(v => (
                <div
                  key={v.id}
                  className="rounded-lg border border-neutral-200 px-3 py-2 flex flex-col gap-1 bg-white"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-neutral-800">
                      {formatDateBR(v.start_date)} → {formatDateBR(v.end_date)} ({v.days} dias)
                    </div>
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Período aquisitivo: {v.period || '-'}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Remuneração: {formatBRL(v.remuneration)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 p-4 space-y-3 bg-white">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Últimas remunerações e holerites</div>
            <div className="text-xs text-neutral-500">Até as últimas 12 folhas em que você aparece, com total líquido e acesso rápido ao holerite.</div>
          </div>
          {loadingPayroll && (
            <div className="text-[11px] text-neutral-500">Carregando...</div>
          )}
        </div>

        {!myColId && (
          <div className="text-xs text-neutral-500">
            Vincule um colaborador ao seu usuário para visualizar o histórico de remunerações e holerites.
          </div>
        )}

        {myColId && !loadingPayroll && payHistory.length === 0 && (
          <div className="text-xs text-neutral-500">Nenhuma folha encontrada com lançamentos para você.</div>
        )}

        {myColId && payHistory.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="py-2 px-2 text-left">Competência</th>
                  <th className="py-2 px-2 text-left">Folha</th>
                  <th className="py-2 px-2 text-right">Recebimentos</th>
                  <th className="py-2 px-2 text-right">Descontos</th>
                  <th className="py-2 px-2 text-right">Total líquido</th>
                  <th className="py-2 px-2 text-center">Holerite</th>
                </tr>
              </thead>
              <tbody>
                {payHistory.map(row => (
                  <>
                    <tr
                      key={row.sheetId}
                      className={`border-t border-neutral-100 cursor-pointer bg-neutral-100 ${selectedSheetId === row.sheetId ? 'bg-neutral-300' : ''}`}
                      onClick={() => setSelectedSheetId(prev => (prev === row.sheetId ? null : row.sheetId))}
                    >
                      <td className="py-1.5 px-2 text-sm">{row.year_month}</td>
                      <td className="py-1.5 px-2 text-sm">{row.name}</td>
                      <td className="py-1.5 px-2 text-sm text-right">{formatBRL(row.inc)}</td>
                      <td className="py-1.5 px-2 text-sm text-right text-red-600">{formatBRL(row.out)}</td>
                      <td className="py-1.5 px-2 text-sm text-right font-medium">{formatBRL(row.total)}</td>
                      <td className="py-1.5 px-2 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadHolerite(row.sheetId) }}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
                          title="Baixar holerite"
                        >
                          <FileDown className="size-4" />
                        </button>
                      </td>
                    </tr>
                    {selectedSheetId === row.sheetId && row.entries && row.entries.length > 0 && (
                      <tr>
                        <td colSpan={6} className="bg-neutral-100 border-t border-neutral-100 md:pl-[50%] md:pr-3 pl-[10%] pr-3 py-2">
                          <div className="text-[11px] text-neutral-500 mb-1">Lançamentos desta remuneração</div>
                          <div className="space-y-1">
                            {row.entries
                              .slice()
                              .sort((a, b) => {
                                const ka = a.payroll_entry_types?.kind === 'in' ? 0 : 1
                                const kb = b.payroll_entry_types?.kind === 'in' ? 0 : 1
                                return ka - kb
                              })
                              .map(e => (
                                <div
                                  key={e.id}
                                  className={`flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-2 py-1 ${e.payroll_entry_types?.kind === 'out' ? 'text-red-600 bg-red-50' : 'text-emerald-700 bg-emerald-50'}`}
                                >
                                  <div className="flex flex-col">
                                    <span className="text-xs font-medium text-neutral-800">{e.payroll_entry_types?.name || '-'}</span>
                                    {e.note && (
                                      <span className="text-[11px] text-neutral-500">{e.note}</span>
                                    )}
                                  </div>
                                  <div className={`text-xs font-semibold ${e.payroll_entry_types?.kind === 'out' ? 'text-red-600' : 'text-emerald-700'}`}>
                                    {e.payroll_entry_types?.kind === 'out' ? '-' : '+'} {formatBRL(e.amount)}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
