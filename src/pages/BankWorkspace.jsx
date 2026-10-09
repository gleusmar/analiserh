import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  getFinBank, listFinSchemes, listStatementEntries, listInternalEntries, listReconciliationLogs,
  createStatementImport, updateStatementImport, insertStatementEntries, setStatementEntryStatus,
} from '../lib/financeiro.js'
import { parseStatementFile, centsToBRL } from '../lib/finParse.js'
import { classifyMatchStates } from '../lib/matcher.js'
import StatementTable from '../components/financeiro/StatementTable.jsx'
import ReconcileView from '../components/financeiro/ReconcileView.jsx'
import InternalPanel from '../components/financeiro/InternalPanel.jsx'
import AuditPanel from '../components/financeiro/AuditPanel.jsx'
import { ArrowLeft, Landmark, Upload } from 'lucide-react'

function StatCard({ label, value, sub, tone = 'neutral' }) {
  const tones = {
    neutral: 'text-neutral-900',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-rose-600',
  }
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${tones[tone]}`}>{value}</div>
      {sub && <div className="text-xs text-neutral-500">{sub}</div>}
    </div>
  )
}

export default function BankWorkspace() {
  const { bankId } = useParams()
  const { profile, loading } = useAuth()
  const navigate = useNavigate()

  const [bank, setBank] = useState(null)
  const [schemes, setSchemes] = useState([])
  const [schemeId, setSchemeId] = useState('')
  const [entries, setEntries] = useState([])
  const [internal, setInternal] = useState([])
  const [logs, setLogs] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('reconcile')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [internalPrefill, setInternalPrefill] = useState(null)
  const fileRef = useRef(null)

  async function load() {
    setLoadingData(true)
    setError(null)
    try {
      const [b, sc, ext, int_, lg] = await Promise.all([
        getFinBank(bankId),
        listFinSchemes(),
        listStatementEntries(bankId),
        listInternalEntries(bankId),
        listReconciliationLogs(bankId),
      ])
      setBank(b)
      setSchemes(sc)
      setEntries(ext)
      setInternal(int_)
      setLogs(lg)
      if (!schemeId) {
        const stone = sc.find(s => s.name === 'Padrão Stone')
        const specific = sc.find(s => String(s.bank_id) === String(bankId))
        setSchemeId(String((specific || stone || sc[0] || {}).id || ''))
      }
    } catch (e) {
      setError(e.message || 'Erro ao carregar dados')
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    if (!loading && profile?.can_access_financeiro && bankId) load()
  }, [loading, profile, bankId])

  const matchStates = useMemo(() => classifyMatchStates(internal, entries), [internal, entries])

  const metrics = useMemo(() => {
    const total = entries.length
    const matched = entries.filter(e => e.status === 'matched').length
    const pendingExt = entries.filter(e => e.status === 'unmatched')
    const pendingInt = internal.filter(e => e.status === 'unmatched')
    return {
      total,
      pct: total ? Math.round((matched / total) * 100) : 0,
      pendingExtCount: pendingExt.length,
      pendingExtSum: pendingExt.reduce((s, e) => s + e.amount_cents, 0),
      pendingIntCount: pendingInt.length,
      pendingIntSum: pendingInt.reduce((s, e) => s + e.amount_cents, 0),
    }
  }, [entries, internal])

  async function onPickFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const scheme = schemes.find(s => String(s.id) === String(schemeId))
    if (!scheme) { alert('Selecione um esquema de importação.'); return }

    setImporting(true)
    setImportResult(null)
    try {
      const buf = await file.arrayBuffer()
      const { entries: parsed, errors, totalRows } = parseStatementFile(buf, scheme.config, Number(bankId))
      if (!parsed.length) {
        setImportResult({ error: 'Nenhum lançamento válido encontrado na planilha.', errors: errors.slice(0, 5) })
        return
      }
      const imp = await createStatementImport({
        bank_id: Number(bankId), scheme_id: scheme.id, filename: file.name,
        total_rows: totalRows, inserted_rows: 0, skipped_rows: 0,
      })
      const { inserted } = await insertStatementEntries(parsed, { bankId: Number(bankId), importId: imp.id })
      const skipped = parsed.length - inserted
      await updateStatementImport(imp.id, { inserted_rows: inserted, skipped_rows: skipped })
      setImportResult({ inserted, skipped, total: parsed.length, errors: errors.slice(0, 5) })
      await load()
    } catch (e2) {
      setImportResult({ error: e2.message || 'Erro ao importar planilha' })
    } finally {
      setImporting(false)
    }
  }

  async function onIgnoreExternal(entry) {
    try {
      await setStatementEntryStatus(entry.id, 'ignored')
      await load()
    } catch (e) { alert(e.message || 'Erro ao ignorar lançamento') }
  }

  function onAddInternal(entry) {
    setInternalPrefill(entry)
    setTab('internal')
  }

  if (loading || !profile) {
    return <div className="min-h-screen grid place-items-center text-neutral-500">Carregando...</div>
  }
  if (!profile.can_access_financeiro) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/financeiro/consolidacao-bancaria')} className="p-2 rounded-xl border border-neutral-200 hover:bg-neutral-50" title="Voltar">
          <ArrowLeft className="size-4" />
        </button>
        <div className="size-10 rounded-xl bg-neutral-100 grid place-items-center overflow-hidden shrink-0">
          {bank?.logo_url ? <img src={bank.logo_url} alt={bank.name} className="size-10 object-contain" /> : <Landmark className="size-5 text-neutral-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">{bank?.name || 'Consolidação Bancária'}</h1>
          <div className="text-xs text-neutral-500">
            {bank?.agency ? `Ag. ${bank.agency}` : ''}{bank?.agency && bank?.account ? ' · ' : ''}{bank?.account ? `Cc. ${bank.account}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={schemeId} onChange={(e) => setSchemeId(e.target.value)} className="rounded-xl border border-neutral-200 bg-white/60 px-2 py-2 text-sm">
            {schemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            {schemes.length === 0 && <option value="">Sem esquema</option>}
          </select>
          <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={onPickFile} />
          <button onClick={() => fileRef.current?.click()} disabled={importing || !schemeId} className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 text-white px-3 py-2 text-sm disabled:opacity-40">
            <Upload className="size-4" /> {importing ? 'Importando...' : 'Importar planilha'}
          </button>
        </div>
      </div>

      {importResult && (
        <div className={`rounded-xl px-4 py-3 text-sm ${importResult.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
          {importResult.error ? (
            <>Falha na importação: {importResult.error}</>
          ) : (
            <>Importação concluída: <b>{importResult.inserted}</b> novos lançamentos, <b>{importResult.skipped}</b> duplicados ignorados{importResult.errors?.length ? ` · ${importResult.errors.length} linha(s) com problema` : ''}.</>
          )}
          {importResult.errors?.length > 0 && (
            <div className="mt-1 text-xs opacity-80">{importResult.errors.join(' · ')}</div>
          )}
          <button onClick={() => setImportResult(null)} className="ml-3 underline text-xs">fechar</button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total importado" value={metrics.total} sub="lançamentos externos" />
        <StatCard label="% conciliado" value={`${metrics.pct}%`} tone={metrics.pct >= 90 ? 'green' : metrics.pct >= 50 ? 'amber' : 'neutral'} sub="do extrato" />
        <StatCard label="Pendente interno" value={metrics.pendingIntCount} sub={centsToBRL(metrics.pendingIntSum)} tone="amber" />
        <StatCard label="Pendente externo" value={metrics.pendingExtCount} sub={centsToBRL(metrics.pendingExtSum)} tone="amber" />
      </div>

      <div className="flex gap-2 border-b border-neutral-200">
        {[
          ['reconcile', 'Conciliação'],
          ['statement', 'Extrato'],
          ['internal', 'Lançamentos internos'],
          ['audit', 'Trilha de auditoria'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 py-2 text-sm ${tab === key ? 'border-b-2 border-neutral-900 font-semibold' : 'text-neutral-600'}`}>
            {label}
          </button>
        ))}
      </div>

      {loadingData ? (
        <div className="text-neutral-500">Carregando...</div>
      ) : error ? (
        <div className="text-red-600 bg-red-50 rounded-xl px-3 py-2 text-sm">{error}</div>
      ) : (
        <>
          {tab === 'reconcile' && (
            <ReconcileView
              bankId={Number(bankId)}
              internalEntries={internal}
              externalEntries={entries}
              onChanged={load}
              onAddInternal={onAddInternal}
              onIgnoreExternal={onIgnoreExternal}
            />
          )}
          {tab === 'statement' && (
            <StatementTable
              entries={entries}
              matchStates={matchStates.external}
              onIgnore={onIgnoreExternal}
              onAddInternal={onAddInternal}
            />
          )}
          {tab === 'internal' && (
            <InternalPanel
              bankId={Number(bankId)}
              entries={internal}
              matchStates={matchStates}
              onChanged={load}
              prefill={internalPrefill}
              onClearPrefill={() => setInternalPrefill(null)}
            />
          )}
          {tab === 'audit' && (
            <AuditPanel logs={logs} onChanged={load} />
          )}
        </>
      )}
    </div>
  )
}
