import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { listSulamericaGuias } from '../lib/db.js'
import { formatDateBr } from '../lib/tissCodeMaps.js'
import { useNavigate } from 'react-router-dom'

export default function SulamericaGuias() {
  const { profile, loading } = useAuth()
  const [items, setItems] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
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
        <div className="border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-900 grid grid-cols-12 gap-2">
          <div className="col-span-2">Nº requisição</div>
          <div className="col-span-3">Nº carteira</div>
          <div className="col-span-2">Data solicitação</div>
          <div className="col-span-4">Solicitante</div>
          <div className="col-span-1 text-right">&nbsp;</div>
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
              <button
                type="button"
                onClick={() => toggleExpanded(item.id)}
                className="w-full px-4 py-2 text-xs grid grid-cols-12 gap-2 items-center hover:bg-blue-50 text-left"
              >
                <div className="col-span-2 font-mono text-[11px]">{item.numero_guia_prestador}</div>
                <div className="col-span-3 font-mono text-[11px]">{item.numero_carteira}</div>
                <div className="col-span-2 text-[11px]">{formatDateBr(item.data_solicitacao)}</div>
                <div className="col-span-4 text-[11px] truncate">{item.solicitante}</div>
                <div className="col-span-1 text-right text-[11px] text-blue-700">{expandedId === item.id ? 'Fechar' : 'Detalhes'}</div>
              </button>
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
