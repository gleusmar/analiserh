import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  listFinBanks, createFinBank, updateFinBank, deleteFinBank, uploadFinBankLogo,
  listFinSchemes, createFinScheme, updateFinScheme, deleteFinScheme, finBankHasEntries,
} from '../lib/financeiro.js'
import { STONE_SCHEME_CONFIG } from '../lib/finParse.js'
import { Landmark, Plus, Pencil, Trash2, Power, FileCog } from 'lucide-react'

function BankFormModal({ onClose, onSave, initial, busy }) {
  const [form, setForm] = useState(() => ({ name: initial?.name || '', agency: initial?.agency || '', account: initial?.account || '', logo: null }))
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
      <div className="glass w-full max-w-md rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-4">{initial ? 'Editar banco' : 'Novo banco'}</h2>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form) }} className="space-y-3">
          <input required value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do banco" className="w-full rounded-xl border border-neutral-200 bg-white/60 px-3 py-2.5 outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.agency} onChange={(e) => setForm(f => ({ ...f, agency: e.target.value }))} placeholder="Agência" className="w-full rounded-xl border border-neutral-200 bg-white/60 px-3 py-2.5 outline-none" />
            <input value={form.account} onChange={(e) => setForm(f => ({ ...f, account: e.target.value }))} placeholder="Conta" className="w-full rounded-xl border border-neutral-200 bg-white/60 px-3 py-2.5 outline-none" />
          </div>
          <label className="block text-sm">
            <span className="text-neutral-600">Logotipo (opcional)</span>
            <input type="file" accept="image/*" onChange={(e) => setForm(f => ({ ...f, logo: e.target.files?.[0] || null }))} className="mt-1 w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:text-white file:px-3 file:py-2" />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl border border-neutral-200">Cancelar</button>
            <button type="submit" disabled={busy} className="px-3 py-2 rounded-xl bg-neutral-900 text-white">{busy ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SchemesModal({ onClose, banks, schemes, onChanged, canAdmin }) {
  const [form, setForm] = useState(() => ({ id: null, name: '', bank_id: '', config: JSON.stringify(STONE_SCHEME_CONFIG, null, 2) }))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  function edit(s) {
    setForm({ id: s.id, name: s.name, bank_id: s.bank_id || '', config: JSON.stringify(s.config, null, 2) })
  }

  async function save(e) {
    e.preventDefault()
    setErr(null)
    let config
    try { config = JSON.parse(form.config || '{}') } catch { setErr('JSON de configuração inválido'); return }
    setBusy(true)
    try {
      const payload = { name: form.name, bank_id: form.bank_id || null, config }
      if (form.id) await updateFinScheme(form.id, payload)
      else await createFinScheme(payload)
      setForm({ id: null, name: '', bank_id: '', config: JSON.stringify(STONE_SCHEME_CONFIG, null, 2) })
      await onChanged()
    } catch (e2) {
      setErr(e2.message || 'Erro ao salvar esquema')
    } finally {
      setBusy(false)
    }
  }

  async function remove(s) {
    if (!window.confirm(`Excluir o esquema "${s.name}"?`)) return
    try { await deleteFinScheme(s.id); await onChanged() } catch (e) { alert(e.message || 'Erro ao excluir') }
  }

  const bankName = (id) => banks.find(b => b.id === id)?.name || 'Todos os bancos'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
      <div className="glass w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Esquemas de importação</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-800">✕</button>
        </div>

        <div className="space-y-2 mb-5">
          {schemes.length === 0 && <div className="text-sm text-neutral-500">Nenhum esquema cadastrado.</div>}
          {schemes.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-neutral-200 px-3 py-2">
              <div>
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-neutral-500">{bankName(s.bank_id)}</div>
              </div>
              {canAdmin && (
                <div className="flex gap-2">
                  <button onClick={() => edit(s)} className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-100" title="Editar"><Pencil className="size-4" /></button>
                  <button onClick={() => remove(s)} className="p-1.5 rounded-lg border border-neutral-200 hover:bg-red-50 text-red-600" title="Excluir"><Trash2 className="size-4" /></button>
                </div>
              )}
            </div>
          ))}
        </div>

        {canAdmin && (
          <form onSubmit={save} className="space-y-3 border-t border-neutral-200 pt-4">
            <div className="text-sm font-semibold">{form.id ? 'Editar esquema' : 'Novo esquema'}</div>
            <div className="grid sm:grid-cols-2 gap-2">
              <input required value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do esquema" className="rounded-xl border border-neutral-200 bg-white/60 px-3 py-2.5 outline-none" />
              <select value={form.bank_id} onChange={(e) => setForm(f => ({ ...f, bank_id: e.target.value }))} className="rounded-xl border border-neutral-200 bg-white/60 px-3 py-2.5">
                <option value="">Todos os bancos</option>
                {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <textarea value={form.config} onChange={(e) => setForm(f => ({ ...f, config: e.target.value }))} rows={10} spellCheck={false} className="w-full rounded-xl border border-neutral-200 bg-white/60 px-3 py-2.5 font-mono text-xs outline-none" />
            {err && <div className="text-sm text-red-600">{err}</div>}
            <div className="flex justify-end gap-2">
              {form.id && <button type="button" onClick={() => setForm({ id: null, name: '', bank_id: '', config: JSON.stringify(STONE_SCHEME_CONFIG, null, 2) })} className="px-3 py-2 rounded-xl border border-neutral-200">Novo</button>}
              <button type="submit" disabled={busy} className="px-3 py-2 rounded-xl bg-neutral-900 text-white">{busy ? 'Salvando...' : (form.id ? 'Salvar alterações' : 'Criar esquema')}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function BankConsolidation() {
  const { profile, role, loading } = useAuth()
  const navigate = useNavigate()
  const [banks, setBanks] = useState([])
  const [schemes, setSchemes] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [loadingList, setLoadingList] = useState(true)
  const [bankModal, setBankModal] = useState({ open: false, bank: null })
  const [schemesOpen, setSchemesOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const canAdmin = role === 'admin' || role === 'super'

  async function load() {
    setLoadingList(true)
    setLoadError(null)
    try {
      const [b, s] = await Promise.all([listFinBanks(), listFinSchemes()])
      setBanks(b)
      setSchemes(s)
    } catch (e) {
      setLoadError(e.message || 'Erro ao carregar dados')
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    if (!loading && profile?.can_access_financeiro) load()
  }, [loading, profile])

  async function onSaveBank(form) {
    setSaving(true)
    try {
      let bank = bankModal.bank
      if (bank) {
        bank = await updateFinBank(bank.id, { name: form.name, agency: form.agency || null, account: form.account || null })
      } else {
        bank = await createFinBank({ name: form.name, agency: form.agency, account: form.account })
      }
      if (form.logo) {
        const url = await uploadFinBankLogo(bank.id, form.logo)
        bank = await updateFinBank(bank.id, { logo_url: url })
      }
      setBankModal({ open: false, bank: null })
      await load()
    } catch (e) {
      alert(e.message || 'Erro ao salvar banco')
    } finally {
      setSaving(false)
    }
  }

  async function onToggleActive(bank) {
    try {
      await updateFinBank(bank.id, { active: !bank.active })
      await load()
    } catch (e) { alert(e.message || 'Erro ao atualizar banco') }
  }

  async function onDeleteBank(bank) {
    try {
      if (await finBankHasEntries(bank.id)) {
        alert('Este banco possui lançamentos importados e não pode ser excluído. Inative-o.')
        return
      }
      if (!window.confirm(`Excluir o banco "${bank.name}"?`)) return
      await deleteFinBank(bank.id)
      await load()
    } catch (e) { alert(e.message || 'Erro ao excluir banco') }
  }

  const activeBanks = useMemo(() => banks.filter(b => b.active), [banks])
  const inactiveBanks = useMemo(() => banks.filter(b => !b.active), [banks])

  if (loading || !profile) {
    return <div className="min-h-screen grid place-items-center text-neutral-500">Carregando...</div>
  }

  if (!profile.can_access_financeiro) {
    return <Navigate to="/" replace />
  }

  const renderCard = (bank) => (
    <div key={bank.id} className={`relative rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:shadow-md ${bank.active ? 'cursor-pointer' : 'opacity-60'}`}
      onClick={() => bank.active && navigate(`/financeiro/consolidacao-bancaria/${bank.id}`)}>
      <div className="flex items-start gap-4">
        <div className="size-12 rounded-xl bg-neutral-100 grid place-items-center overflow-hidden shrink-0">
          {bank.logo_url
            ? <img src={bank.logo_url} alt={bank.name} className="size-12 object-contain" />
            : <Landmark className="size-6 text-neutral-500" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{bank.name}</div>
          <div className="text-xs text-neutral-500 mt-0.5">
            {bank.agency ? `Ag. ${bank.agency}` : 'Ag. —'} · {bank.account ? `Cc. ${bank.account}` : 'Cc. —'}
          </div>
          {!bank.active && <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wide rounded bg-neutral-200 text-neutral-600 px-1.5 py-0.5">Inativo</span>}
        </div>
      </div>
      {canAdmin && (
        <div className="absolute top-3 right-3 flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setBankModal({ open: true, bank })} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500" title="Editar"><Pencil className="size-4" /></button>
          <button onClick={() => onToggleActive(bank)} className={`p-1.5 rounded-lg hover:bg-neutral-100 ${bank.active ? 'text-emerald-600' : 'text-neutral-400'}`} title={bank.active ? 'Inativar' : 'Ativar'}><Power className="size-4" /></button>
          <button onClick={() => onDeleteBank(bank)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Excluir"><Trash2 className="size-4" /></button>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Consolidação Bancária</h1>
        {canAdmin && (
          <div className="flex gap-2">
            <button onClick={() => setSchemesOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm hover:bg-neutral-50">
              <FileCog className="size-4" /> Esquemas de importação
            </button>
            <button onClick={() => setBankModal({ open: true, bank: null })} className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 text-white px-3 py-2.5 text-sm">
              <Plus className="size-4" /> Novo banco
            </button>
          </div>
        )}
      </div>

      {loadingList ? (
        <div className="text-neutral-500">Carregando...</div>
      ) : loadError ? (
        <div className="text-red-600 bg-red-50 rounded-xl px-3 py-2 text-sm">{loadError}</div>
      ) : (
        <>
          {activeBanks.length === 0 && inactiveBanks.length === 0 && (
            <div className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-neutral-500">
              Nenhum banco cadastrado.{canAdmin && ' Clique em "Novo banco" para começar.'}
            </div>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeBanks.map(renderCard)}
          </div>
          {inactiveBanks.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-neutral-500">Inativos</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {inactiveBanks.map(renderCard)}
              </div>
            </div>
          )}
        </>
      )}

      {bankModal.open && (
        <BankFormModal
          onClose={() => setBankModal({ open: false, bank: null })}
          onSave={onSaveBank}
          initial={bankModal.bank}
          busy={saving}
        />
      )}
      {schemesOpen && (
        <SchemesModal
          onClose={() => setSchemesOpen(false)}
          banks={banks}
          schemes={schemes}
          onChanged={load}
          canAdmin={canAdmin}
        />
      )}
    </div>
  )
}
