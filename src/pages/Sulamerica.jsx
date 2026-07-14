import { useEffect, useState, useCallback, memo } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { parseTissXml } from '../lib/parseTissXml.js'

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const buffer = e.target.result
      let encoding = 'utf-8'
      const head = new Uint8Array(buffer).slice(0, 200)
      const headStr = new TextDecoder('utf-8').decode(head)
      const m = headStr.match(/encoding=["']([^"']+)["']/i)
      if (m) encoding = m[1].toLowerCase()
      try {
        const decoder = new TextDecoder(encoding)
        resolve(decoder.decode(buffer))
      } catch {
        resolve(new TextDecoder('utf-8').decode(buffer))
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-neutral-600">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-xs"
      />
    </div>
  )
}

const ProcedimentoRow = memo(function ProcedimentoRow({ index, guiaIndex, procedimento, onUpdate }) {
  const update = (field, value) => onUpdate(guiaIndex, index, field, value)
  const inputClass = 'w-full rounded-md border border-neutral-300 px-1 py-0.5 text-xs'
  return (
    <tr className="border-b border-neutral-100">
      <td className="py-1 px-1"><input value={procedimento.sequencialItem} onChange={(e) => update('sequencialItem', e.target.value)} className={inputClass} /></td>
      <td className="py-1 px-1"><input value={procedimento.dataExecucao} onChange={(e) => update('dataExecucao', e.target.value)} className={inputClass} /></td>
      <td className="py-1 px-1"><input value={procedimento.horaInicial} onChange={(e) => update('horaInicial', e.target.value)} className={inputClass} /></td>
      <td className="py-1 px-1"><input value={procedimento.horaFinal} onChange={(e) => update('horaFinal', e.target.value)} className={inputClass} /></td>
      <td className="py-1 px-1"><input value={procedimento.codigoTabela} onChange={(e) => update('codigoTabela', e.target.value)} className={inputClass} /></td>
      <td className="py-1 px-1"><input value={procedimento.codigoProcedimento} onChange={(e) => update('codigoProcedimento', e.target.value)} className={inputClass} /></td>
      <td className="py-1 px-1 min-w-[200px]"><input value={procedimento.descricaoProcedimento} onChange={(e) => update('descricaoProcedimento', e.target.value)} className={inputClass} /></td>
      <td className="py-1 px-1"><input value={procedimento.quantidadeExecutada} onChange={(e) => update('quantidadeExecutada', e.target.value)} className={inputClass} /></td>
      <td className="py-1 px-1"><input value={procedimento.viaAcesso} onChange={(e) => update('viaAcesso', e.target.value)} className={inputClass} /></td>
      <td className="py-1 px-1"><input value={procedimento.tecnicaUtilizada} onChange={(e) => update('tecnicaUtilizada', e.target.value)} className={inputClass} /></td>
      <td className="py-1 px-1"><input value={procedimento.reducaoAcrescimo} onChange={(e) => update('reducaoAcrescimo', e.target.value)} className={inputClass} /></td>
      <td className="py-1 px-1"><input value={procedimento.valorUnitario} onChange={(e) => update('valorUnitario', e.target.value)} className={inputClass} /></td>
      <td className="py-1 px-1"><input value={procedimento.valorTotal} onChange={(e) => update('valorTotal', e.target.value)} className={inputClass} /></td>
    </tr>
  )
})

const GuiaCard = memo(function GuiaCard({ guia, index, onUpdateGuia, onUpdateProcedimento }) {
  const totalFields = [
    ['valorProcedimentos', 'Procedimentos'],
    ['valorDiarias', 'Diárias'],
    ['valorTaxasAlugueis', 'Taxas/Aluguéis'],
    ['valorMateriais', 'Materiais'],
    ['valorMedicamentos', 'Medicamentos'],
    ['valorOPME', 'OPME'],
    ['valorGasesMedicinais', 'Gases medicinais'],
    ['valorTotalGeral', 'Total geral'],
  ]

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Guia {guia.numeroGuiaPrestador || `#${index + 1}`}</h3>
        <span className="text-xs text-neutral-500">{guia.procedimentos.length} procedimento(s)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Nº guia prestador" value={guia.numeroGuiaPrestador} onChange={(v) => onUpdateGuia(index, 'numeroGuiaPrestador', v)} />
        <Field label="Registro ANS" value={guia.registroANS} onChange={(v) => onUpdateGuia(index, 'registroANS', v)} />
        <Field label="Nº carteira" value={guia.numeroCarteira} onChange={(v) => onUpdateGuia(index, 'numeroCarteira', v)} />
        <Field label="Atendimento RN" value={guia.atendimentoRN} onChange={(v) => onUpdateGuia(index, 'atendimentoRN', v)} />
        <Field label="Código prestador solicitante" value={guia.codigoPrestadorSolicitante} onChange={(v) => onUpdateGuia(index, 'codigoPrestadorSolicitante', v)} />
        <Field label="Nome contratado solicitante" value={guia.nomeContratadoSolicitante} onChange={(v) => onUpdateGuia(index, 'nomeContratadoSolicitante', v)} />
        <Field label="Nome profissional" value={guia.nomeProfissional} onChange={(v) => onUpdateGuia(index, 'nomeProfissional', v)} />
        <Field label="Conselho profissional" value={guia.conselhoProfissional} onChange={(v) => onUpdateGuia(index, 'conselhoProfissional', v)} />
        <Field label="Nº conselho profissional" value={guia.numeroConselhoProfissional} onChange={(v) => onUpdateGuia(index, 'numeroConselhoProfissional', v)} />
        <Field label="UF" value={guia.ufProfissional} onChange={(v) => onUpdateGuia(index, 'ufProfissional', v)} />
        <Field label="CBOS" value={guia.cbos} onChange={(v) => onUpdateGuia(index, 'cbos', v)} />
        <Field label="Data solicitação" value={guia.dataSolicitacao} onChange={(v) => onUpdateGuia(index, 'dataSolicitacao', v)} />
        <Field label="Caráter atendimento" value={guia.caraterAtendimento} onChange={(v) => onUpdateGuia(index, 'caraterAtendimento', v)} />
        <Field label="Código prestador executante" value={guia.codigoPrestadorExecutante} onChange={(v) => onUpdateGuia(index, 'codigoPrestadorExecutante', v)} />
        <Field label="CNES" value={guia.cnes} onChange={(v) => onUpdateGuia(index, 'cnes', v)} />
        <Field label="Tipo atendimento" value={guia.tipoAtendimento} onChange={(v) => onUpdateGuia(index, 'tipoAtendimento', v)} />
        <Field label="Indicação acidente" value={guia.indicacaoAcidente} onChange={(v) => onUpdateGuia(index, 'indicacaoAcidente', v)} />
        <Field label="Regime atendimento" value={guia.regimeAtendimento} onChange={(v) => onUpdateGuia(index, 'regimeAtendimento', v)} />
        <Field label="Senha" value={guia.senha} onChange={(v) => onUpdateGuia(index, 'senha', v)} />
        <Field label="Data autorização" value={guia.dataAutorizacao} onChange={(v) => onUpdateGuia(index, 'dataAutorizacao', v)} />
        <Field label="Data validade senha" value={guia.dataValidadeSenha} onChange={(v) => onUpdateGuia(index, 'dataValidadeSenha', v)} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-left text-neutral-500">
              <th className="py-1 px-1">Seq</th>
              <th className="px-1">Data</th>
              <th className="px-1">Início</th>
              <th className="px-1">Fim</th>
              <th className="px-1">Tab</th>
              <th className="px-1">Código</th>
              <th className="px-1 min-w-[200px]">Procedimento</th>
              <th className="px-1">Qtd</th>
              <th className="px-1">Via</th>
              <th className="px-1">Téc</th>
              <th className="px-1">Red/Acr</th>
              <th className="px-1">Unit</th>
              <th className="px-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {guia.procedimentos.map((p, pIdx) => (
              <ProcedimentoRow key={pIdx} index={pIdx} guiaIndex={index} procedimento={p} onUpdate={onUpdateProcedimento} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-neutral-100">
        {totalFields.map(([key, label]) => (
          <Field key={key} label={label} value={guia[key]} onChange={(v) => onUpdateGuia(index, key, v)} />
        ))}
      </div>
    </div>
  )
})

export default function Sulamerica() {
  const { profile, loading } = useAuth()
  const [toast, setToast] = useState(null)
  const [file, setFile] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [parsing, setParsing] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!profile) return
    if (profile.can_access_sulamerica) return
    setToast({ title: 'Acesso restrito', message: 'Você não tem permissão para acessar o portal SulAmérica.' })
    const timer = setTimeout(() => {
      window.location.href = 'https://rh.analiselabclinico.com.br'
    }, 2500)
    return () => clearTimeout(timer)
  }, [loading, profile])

  const updateHeader = useCallback((field, value) => {
    setData((prev) => ({ ...prev, header: { ...prev.header, [field]: value } }))
  }, [])

  const updateLote = useCallback((value) => {
    setData((prev) => ({ ...prev, lote: { ...prev.lote, numeroLote: value } }))
  }, [])

  const updateGuia = useCallback((index, field, value) => {
    setData((prev) => {
      const guias = [...prev.guias]
      guias[index] = { ...guias[index], [field]: value }
      return { ...prev, guias }
    })
  }, [])

  const updateProcedimento = useCallback((guiaIndex, procedimentoIndex, field, value) => {
    setData((prev) => {
      const guias = [...prev.guias]
      const guia = { ...guias[guiaIndex] }
      const procedimentos = [...guia.procedimentos]
      procedimentos[procedimentoIndex] = { ...procedimentos[procedimentoIndex], [field]: value }
      guia.procedimentos = procedimentos
      guias[guiaIndex] = guia
      return { ...prev, guias }
    })
  }, [])

  const handleFileChange = (e) => {
    setFile(e.target.files[0] || null)
    setError(null)
  }

  const handleImport = async () => {
    if (!file) return
    setParsing(true)
    setError(null)
    try {
      const text = await readFileText(file)
      const parsed = parseTissXml(text)
      setData(parsed)
    } catch (err) {
      setError(err.message || 'Erro ao importar o XML.')
    } finally {
      setParsing(false)
    }
  }

  const handleClear = () => {
    setData(null)
    setFile(null)
    setError(null)
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-neutral-500">Carregando...</div>
  }

  if (!profile) {
    return <div className="min-h-screen grid place-items-center text-neutral-500">Carregando...</div>
  }

  if (!profile.can_access_sulamerica) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-white">
        {toast && (
          <div className="fixed bottom-4 right-4 bg-red-500 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
            <div className="font-semibold mb-0.5">{toast.title}</div>
            <div>{toast.message}</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <h1 className="text-2xl font-semibold">Portal SulAmérica</h1>
        <p className="mt-2 text-sm text-neutral-600">Importe um XML TISS (guia médica) e visualize ou edite as guias.</p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".xml"
            onChange={handleFileChange}
            className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:text-neutral-700"
          />
          <button
            onClick={handleImport}
            disabled={!file || parsing}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm disabled:opacity-50"
          >
            {parsing ? 'Importando...' : 'Importar'}
          </button>
          {data && (
            <button
              onClick={handleClear}
              className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              Limpar
            </button>
          )}
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        {file && !data && <div className="mt-2 text-xs text-neutral-500">{file.name}</div>}
      </div>

      {data && (
        <>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
            <h2 className="text-base font-semibold">Cabeçalho do lote</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Tipo de transação" value={data.header.tipoTransacao} onChange={(v) => updateHeader('tipoTransacao', v)} />
              <Field label="Sequencial transação" value={data.header.sequencialTransacao} onChange={(v) => updateHeader('sequencialTransacao', v)} />
              <Field label="Data registro transação" value={data.header.dataRegistroTransacao} onChange={(v) => updateHeader('dataRegistroTransacao', v)} />
              <Field label="Hora registro transação" value={data.header.horaRegistroTransacao} onChange={(v) => updateHeader('horaRegistroTransacao', v)} />
              <Field label="Código prestador na operadora" value={data.header.codigoPrestadorNaOperadora} onChange={(v) => updateHeader('codigoPrestadorNaOperadora', v)} />
              <Field label="Registro ANS destino" value={data.header.registroANS} onChange={(v) => updateHeader('registroANS', v)} />
              <Field label="Padrão" value={data.header.padrao} onChange={(v) => updateHeader('padrao', v)} />
              <Field label="Número do lote" value={data.lote.numeroLote} onChange={updateLote} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Guias ({data.guias.length})</h2>
          </div>

          <div className="space-y-4">
            {data.guias.map((guia, gIdx) => (
              <GuiaCard
                key={gIdx}
                index={gIdx}
                guia={guia}
                onUpdateGuia={updateGuia}
                onUpdateProcedimento={updateProcedimento}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
