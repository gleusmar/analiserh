import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { listSulamericaGuias, deleteSulamericaGuia } from '../lib/db.js'
import { formatDateBr } from '../lib/tissCodeMaps.js'
import { useNavigate } from 'react-router-dom'

export default function SulamericaGuias() {
  const { profile, loading } = useAuth()
  const [items, setItems] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [loadingAction, setLoadingAction] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (!profile.can_access_sulamerica) return
    const load = async () => {
      try {
        setLoadingList(true)
        setError(null)
        const data = await listSulamericaGuias()
        setItems(data)
      } catch (e) {
        setError(e.message || 'Erro ao carregar guias salvas.')
      } finally {
        setLoadingList(false)
      }
    }
    load()
  }, [loading, profile])

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-neutral-500">Carregando...</div>
  }

  if (!profile) {
    return <div className="min-h-screen grid place-items-center text-neutral-500">Carregando...</div>
  }

  if (!profile.can_access_sulamerica) {
    return (
      <div className="min-h-screen grid place-items-center text-neutral-500">
        Você não tem permissão para acessar o portal SulAmérica.
      </div>
    )
  }

  const toggleExpanded = (id) => {
    setExpandedId((curr) => (curr === id ? null : id))
  }

  const toggleSelect = (id) => {
    setSelectedIds((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]
    )
  }

  const allSelected = items.length > 0 && selectedIds.length === items.length

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(items.map((i) => i.id))
    }
  }

  const handleDeleteOne = async (id) => {
    if (!window.confirm('Deseja realmente excluir esta guia?')) return
    try {
      setLoadingAction(true)
      await deleteSulamericaGuia(id)
      setItems((curr) => curr.filter((i) => i.id !== id))
      setSelectedIds((curr) => curr.filter((x) => x !== id))
    } catch (e) {
      setError(e.message || 'Erro ao excluir a guia.')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleDeleteSelected = async () => {
    if (!selectedIds.length) return
    if (!window.confirm('Deseja realmente excluir as guias selecionadas?')) return
    try {
      setLoadingAction(true)
      await Promise.all(selectedIds.map((id) => deleteSulamericaGuia(id)))
      setItems((curr) => curr.filter((i) => !selectedIds.includes(i.id)))
      setSelectedIds([])
    } catch (e) {
      setError(e.message || 'Erro ao excluir as guias selecionadas.')
    } finally {
      setLoadingAction(false)
    }
  }

  const handleSendOne = (id) => {
    // placeholder para envio individual
    window.alert('Envio para SulAmérica ainda será implementado.')
  }

  const handleSendSelected = () => {
    if (!selectedIds.length) return
    // placeholder para envio em lote
    window.alert('Envio em lote para SulAmérica ainda será implementado.')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-semibold text-blue-900">Guias SulAmérica salvas</h1>
          <p className="mt-2 text-sm text-blue-600/80">Visualize as guias já salvas no banco de dados.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/sulamerica')}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
        >
          Importar XML
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="rounded-2xl border border-blue-100 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-3 pb-1 text-[11px] text-neutral-600">
          <div>
            {items.length > 0 && (
              <span>{selectedIds.length} guia(s) selecionada(s)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={!selectedIds.length || loadingAction}
              className="rounded-full border border-red-200 px-3 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
            >
              Excluir selecionadas
            </button>
            <button
              type="button"
              onClick={handleSendSelected}
              disabled={!selectedIds.length || loadingAction}
              className="rounded-full border border-blue-200 px-3 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40"
            >
              Enviar selecionadas
            </button>
          </div>
        </div>
        <div className="border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-900 grid grid-cols-12 gap-2">
          <div className="col-span-1 flex items-center justify-center">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-3 w-3 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
            />
          </div>
          <div className="col-span-2">Nº requisição</div>
          <div className="col-span-2">Nº carteira</div>
          <div className="col-span-1">Data solicitação</div>
          <div className="col-span-3">Solicitante</div>
          <div className="col-span-2">Nº da Guia</div>
          <div className="col-span-1 text-right">Ações</div>
        </div>
        {loadingList && (
          <div className="px-4 py-3 text-sm text-neutral-500">Carregando guias...</div>
        )}
        {!loadingList && items.length === 0 && (
          <div className="px-4 py-3 text-sm text-neutral-500">Nenhuma guia salva encontrada.</div>
        )}
        {!loadingList && items.map((item) => {
          const guia = item.guia || {}
          return (
            <div key={item.id} className="border-t border-blue-50">
              <div className="w-full px-4 py-2 text-xs grid grid-cols-12 gap-2 items-center hover:bg-blue-50">
                <div className="col-span-1 flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="h-3 w-3 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => toggleExpanded(item.id)}
                  className="col-span-10 grid grid-cols-10 gap-2 items-center text-left"
                >
                  <div className="col-span-2 font-mono text-[11px]">{item.numero_guia_prestador}</div>
                  <div className="col-span-2 font-mono text-[11px]">{item.numero_carteira}</div>
                  <div className="col-span-1 text-[11px]">{formatDateBr(item.data_solicitacao)}</div>
                  <div className="col-span-3 text-[11px] truncate">{item.solicitante}</div>
                  <div className="col-span-2 text-[11px] font-mono">
                    {guia.numeroGuiaOperadora ? guia.numeroGuiaOperadora : 'Não enviado'}
                  </div>
                </button>
                <div className="col-span-1 flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => handleSendOne(item.id)}
                    disabled={loadingAction}
                    className="rounded-full border border-blue-200 px-2 py-0.5 text-[10px] text-blue-700 hover:bg-blue-50 disabled:opacity-40"
                  >
                    Enviar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteOne(item.id)}
                    disabled={loadingAction}
                    className="rounded-full border border-red-200 px-2 py-0.5 text-[10px] text-red-700 hover:bg-red-50 disabled:opacity-40"
                  >
                    Excluir
                  </button>
                </div>
              </div>
              {expandedId === item.id && (
                <div className="px-4 pb-4 text-xs bg-blue-50/40">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 py-2">
                    <div>
                      <div className="text-[10px] uppercase text-neutral-500">Registro ANS</div>
                      <div className="text-[11px] font-mono">{guia.registroANS}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-neutral-500">Caráter</div>
                      <div className="text-[11px]">{guia.caraterAtendimento}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-neutral-500">Atendimento RN</div>
                      <div className="text-[11px]">{guia.atendimentoRN}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-neutral-500">Tipo atendimento</div>
                      <div className="text-[11px]">{guia.tipoAtendimento}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-neutral-500">Indicação acidente</div>
                      <div className="text-[11px]">{guia.indicacaoAcidente}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-neutral-500">Regime atendimento</div>
                      <div className="text-[11px]">{guia.regimeAtendimento}</div>
                    </div>
                  </div>

                  <div className="mt-2 border-t border-blue-100 pt-2">
                    <div className="text-[10px] uppercase text-neutral-500 mb-1">Procedimentos</div>
                    <div className="overflow-x-auto rounded border border-blue-100 bg-white">
                      <table className="min-w-full text-[10px]">
                        <thead className="bg-blue-700 text-white">
                          <tr>
                            <th className="px-2 py-1 text-left">Código</th>
                            <th className="px-2 py-1 text-left">Descrição</th>
                            <th className="px-2 py-1 text-right">Qtd</th>
                            <th className="px-2 py-1 text-right">Unit</th>
                            <th className="px-2 py-1 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(guia.procedimentos || []).map((p, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-blue-50' : 'bg-white'}>
                              <td className="px-2 py-1 font-mono">{p.codigoProcedimento}</td>
                              <td className="px-2 py-1">{p.descricaoProcedimento}</td>
                              <td className="px-2 py-1 text-right">{p.quantidadeExecutada}</td>
                              <td className="px-2 py-1 text-right">{p.valorUnitario}</td>
                              <td className="px-2 py-1 text-right">{p.valorTotal}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
