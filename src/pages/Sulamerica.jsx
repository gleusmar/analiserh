import { useEffect, useState, useCallback, memo } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { parseTissXml } from '../lib/parseTissXml.js'
import { CODE_MAPS, getTissLabel, formatDateInput } from '../lib/tissCodeMaps.js'
import { saveSulamericaGuiasWithCheck } from '../lib/db'

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

function Field({ id, label, value, onChange, type = 'text', className = '', inputClassName = '', labelClassName = '', error, blinkId }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className={`text-xs font-semibold text-slate-700 ${labelClassName}`}>{label}</label>
      <input
        id={id}
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${inputClassName} ${blinkId && id && blinkId === id ? 'animate-pulse ring-2 ring-red-400' : ''}`}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

function SelectField({ id, label, value, onChange, options, className = '', labelClassName = '', inputClassName = '', error, blinkId }) {
  const entries = Object.entries(options || {})
  const stringValue = value ?? ''
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className={`text-xs font-semibold text-slate-700 ${labelClassName}`}>{label}</label>
      <select
        id={id}
        value={stringValue}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${inputClassName} ${blinkId && id && blinkId === id ? 'animate-pulse ring-2 ring-red-400' : ''}`}
      >
        {stringValue !== '' && !entries.some(([code]) => String(code) === stringValue) && (
          <option value={stringValue}>{stringValue}</option>
        )}
        {entries.map(([code, label]) => (
          <option key={String(code)} value={String(code)}>{label}</option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

function CarteiraField({ id, value, onChange, className = '', blinkId }) {
  const valid = /^\d{20}$/.test(value ?? '')
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm font-semibold text-slate-700">Nº carteira</label>
      <input
        type="text"
        inputMode="numeric"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        id={id}
        className={`w-full rounded-lg border px-3 py-2 text-lg font-semibold tracking-wider focus:outline-none focus:ring-1 ${valid ? 'border-emerald-300 bg-white text-emerald-700 focus:border-emerald-500 focus:ring-emerald-500' : 'border-red-400 bg-red-100 text-red-800 focus:border-red-500 focus:ring-red-500'} ${blinkId && id && blinkId === id ? 'animate-pulse ring-2 ring-red-400' : ''}`}
      />
      {!valid && (value ?? '').length > 0 && (
        <span className="text-xs text-red-700">A carteirinha deve conter exatamente 20 dígitos.</span>
      )}
    </div>
  )
}

const gridCols = 'grid grid-cols-[repeat(26,minmax(0,1fr))]'

const AUTH_PREAUTH_CODES = new Set([
  '40302610',
  '40302830',
  '40302903',
  '40304701',
  '40304710',
  '40304728',
  '40304736',
  '40304973',
  '40305015',
  '40306771',
  '40308804',
  '40314049',
  '40314057',
  '40314065',
  '40314235',
  '40314286',
  '40314430',
  '40314561',
  '40314618',
  '40319326',
  '40321029',
  '40321517',
  '40322394',
  '40323153',
  '40324389',
  '40324591',
  '40324605',
  '40324788',
  '40324796',
])

const ProcedimentoRow = memo(function ProcedimentoRow({ index, guiaIndex, procedimento, onUpdate }) {
  const update = (field, value) => onUpdate(guiaIndex, index, field, value)
  const cell = 'px-0.5 py-1 flex items-center'
  const input = 'w-full rounded-md border border-slate-300 bg-white px-0.5 py-1 text-xs text-center focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
  const inputLeft = 'w-full rounded-md border border-slate-300 bg-white px-1 py-1 text-xs text-left focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
  const requiresAuth = AUTH_PREAUTH_CODES.has(String(procedimento.codigoProcedimento ?? '').trim())
  const isEven = index % 2 === 0
  const rowColor = requiresAuth
    ? 'bg-red-200 hover:bg-red-300'
    : isEven
      ? 'bg-blue-50 hover:bg-blue-100'
      : 'bg-blue-100 hover:bg-blue-200'
  return (
    <div className={`${gridCols} border-b border-blue-50 ${rowColor}`}>
      <div className={`${cell} col-span-1 justify-center`}><input value={procedimento.sequencialItem} onChange={(e) => update('sequencialItem', e.target.value)} className={input} /></div>
      <div className={`${cell} col-span-1 justify-center`}><input value={procedimento.codigoTabela} onChange={(e) => update('codigoTabela', e.target.value)} className={input} /></div>
      <div className={`${cell} col-span-2 justify-center`}><input value={procedimento.dataExecucao} onChange={(e) => update('dataExecucao', formatDateInput(e.target.value))} className={input} /></div>
      <div className={`${cell} col-span-2 justify-center`}><input value={procedimento.horaInicial} onChange={(e) => update('horaInicial', e.target.value)} className={input} /></div>
      <div className={`${cell} col-span-2 justify-center`}><input value={procedimento.horaFinal} onChange={(e) => update('horaFinal', e.target.value)} className={input} /></div>
      <div className={`${cell} col-span-2 justify-center`}><input value={procedimento.codigoProcedimento} onChange={(e) => update('codigoProcedimento', e.target.value)} className={input} /></div>
      <div className={`${cell} col-span-7 justify-start`}><input value={procedimento.descricaoProcedimento} onChange={(e) => update('descricaoProcedimento', e.target.value)} className={inputLeft} /></div>
      <div className={`${cell} col-span-1 justify-center`}><input value={procedimento.quantidadeExecutada} onChange={(e) => update('quantidadeExecutada', e.target.value)} className={input} /></div>
      <div className={`${cell} col-span-1 justify-center`}><input value={procedimento.viaAcesso} onChange={(e) => update('viaAcesso', e.target.value)} className={input} /></div>
      <div className={`${cell} col-span-1 justify-center`}><input value={procedimento.tecnicaUtilizada} onChange={(e) => update('tecnicaUtilizada', e.target.value)} className={input} /></div>
      <div className={`${cell} col-span-2 justify-center`}><input value={procedimento.reducaoAcrescimo} onChange={(e) => update('reducaoAcrescimo', e.target.value)} className={input} /></div>
      <div className={`${cell} col-span-2 justify-center`}><input value={procedimento.valorUnitario} onChange={(e) => update('valorUnitario', e.target.value)} className={input} /></div>
      <div className={`${cell} col-span-2 justify-center`}><input value={procedimento.valorTotal} onChange={(e) => update('valorTotal', e.target.value)} className={input} /></div>
    </div>
  )
})

const GuiaCard = memo(function GuiaCard({ guia, index, onUpdateGuia, onUpdateProcedimento, onRemoveGuia, blinkTargetId }) {
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

  const solicitanteInvalido = (guia.nomeProfissional ?? '').toString().trim().toUpperCase() === 'SOLICITACAO PROPRIA'

  const hasPreauthProcedures = guia.procedimentos?.some((p) =>
    AUTH_PREAUTH_CODES.has(String(p.codigoProcedimento ?? '').trim()),
  )

  const isEmpty = (v) => String(v ?? '').trim() === ''
  const invalidInputClass = 'border-red-400 bg-red-100 text-red-800 focus:border-red-500 focus:ring-red-500'

  const obrigSolicitanteVazio = isEmpty(guia.nomeProfissional)
  const obrigConselhoVazio = isEmpty(guia.conselhoProfissional)
  const obrigUfVazio = isEmpty(guia.ufProfissional)
  const obrigNumConselhoVazio = isEmpty(guia.numeroConselhoProfissional)
  const obrigCbosVazio = isEmpty(guia.cbos)
  const obrigDataSolicVazio = isEmpty(guia.dataSolicitacao)
  const obrigCaraterVazio = isEmpty(guia.caraterAtendimento)
  const obrigAtendRNVazio = isEmpty(guia.atendimentoRN)
  const obrigTipoAtendVazio = isEmpty(guia.tipoAtendimento)
  const obrigIndicacaoAcidenteVazio = isEmpty(guia.indicacaoAcidente)
  const obrigRegimeAtendVazio = isEmpty(guia.regimeAtendimento)
  const obrigCodigoExecVazio = isEmpty(guia.codigoPrestadorExecutante)

  const senhaObrigVazia = hasPreauthProcedures && isEmpty(guia.senha)
  const dataAutorizObrigVazia = hasPreauthProcedures && isEmpty(guia.dataAutorizacao)
  const validadeSenhaObrigVazia = hasPreauthProcedures && isEmpty(guia.dataValidadeSenha)

  return (
    <div className="rounded-2xl border border-blue-100 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-linear-to-r from-blue-700 to-blue-600 px-5 py-3 text-white">
        <h3 className="text-lg font-semibold">Requisição {guia.numeroGuiaPrestador || `#${index + 1}`}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {guia.registroANS && (
            <span className="rounded bg-white/20 px-2 py-0.5 text-xs">ANS {guia.registroANS}</span>
          )}
          <span className="rounded bg-white/20 px-2 py-0.5 text-xs">{guia.procedimentos.length} procedimento(s)</span>
          {typeof onRemoveGuia === 'function' && (
            <button
              type="button"
              onClick={() => onRemoveGuia(index)}
              className="ml-2 rounded-full border border-red-200 bg-red-500 px-3 py-1 text-xs font-semibold text-red-50 hover:bg-red-600"
            >
              Remover guia
            </button>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4 bg-neutral-200">
        <div className="grid grid-cols-1 md:grid-cols-8 gap-3">
          <CarteiraField
            id={`guia-${index}-numeroCarteira`}
            className="col-span-1 md:col-span-8"
            value={guia.numeroCarteira}
            onChange={(v) => onUpdateGuia(index, 'numeroCarteira', v)}
            blinkId={blinkTargetId}
          />

          <Field
            id={`guia-${index}-nomeProfissional`}
            className="col-span-1 md:col-span-3"
            label="Solicitante"
            value={guia.nomeProfissional}
            onChange={(v) => onUpdateGuia(index, 'nomeProfissional', v)}
            inputClassName={
              solicitanteInvalido || obrigSolicitanteVazio
                ? invalidInputClass
                : ''
            }
            error={solicitanteInvalido ? 'Informe um solicitante válido.' : undefined}
            blinkId={blinkTargetId}
          />
          <SelectField
            id={`guia-${index}-conselhoProfissional`}
            className="col-span-1"
            label="Conselho"
            value={guia.conselhoProfissional}
            options={CODE_MAPS.conselhoProfissional}
            onChange={(v) => onUpdateGuia(index, 'conselhoProfissional', v)}
            inputClassName={obrigConselhoVazio ? invalidInputClass : ''}
            blinkId={blinkTargetId}
          />
          <SelectField
            id={`guia-${index}-ufProfissional`}
            className="col-span-1"
            label="UF"
            value={guia.ufProfissional}
            options={CODE_MAPS.ufProfissional}
            onChange={(v) => onUpdateGuia(index, 'ufProfissional', v)}
            inputClassName={obrigUfVazio ? invalidInputClass : ''}
            blinkId={blinkTargetId}
          />
          <Field
            id={`guia-${index}-numeroConselhoProfissional`}
            className="col-span-1"
            label="Nº Conselho"
            value={guia.numeroConselhoProfissional}
            onChange={(v) => onUpdateGuia(index, 'numeroConselhoProfissional', v)}
            inputClassName={obrigNumConselhoVazio ? invalidInputClass : ''}
            blinkId={blinkTargetId}
          />
          <Field
            id={`guia-${index}-cbos`}
            className="col-span-1"
            label="CBOS"
            value={guia.cbos}
            onChange={(v) => onUpdateGuia(index, 'cbos', v)}
            inputClassName={obrigCbosVazio ? invalidInputClass : ''}
            blinkId={blinkTargetId}
          />

          <Field
            id={`guia-${index}-dataSolicitacao`}
            className="col-span-1"
            label="Data da Solicitação"
            value={guia.dataSolicitacao}
            onChange={(v) => onUpdateGuia(index, 'dataSolicitacao', formatDateInput(v))}
            inputClassName={obrigDataSolicVazio ? invalidInputClass : ''}
            blinkId={blinkTargetId}
          />
          <SelectField
            id={`guia-${index}-caraterAtendimento`}
            className="col-span-1 md:col-span-2"
            label="Caráter do Atendimento"
            value={guia.caraterAtendimento}
            options={CODE_MAPS.caraterAtendimento}
            onChange={(v) => onUpdateGuia(index, 'caraterAtendimento', v)}
            inputClassName={obrigCaraterVazio ? invalidInputClass : ''}
            blinkId={blinkTargetId}
          />
          <SelectField
            id={`guia-${index}-atendimentoRN`}
            className="col-span-1"
            label="Atendimento RN"
            value={guia.atendimentoRN}
            options={CODE_MAPS.atendimentoRN}
            onChange={(v) => onUpdateGuia(index, 'atendimentoRN', v)}
            inputClassName={obrigAtendRNVazio ? invalidInputClass : ''}
            blinkId={blinkTargetId}
          />
          <SelectField
            id={`guia-${index}-tipoAtendimento`}
            className="col-span-1 md:col-span-2"
            label="Tipo do Atendimento"
            value={guia.tipoAtendimento}
            options={CODE_MAPS.tipoAtendimento}
            onChange={(v) => onUpdateGuia(index, 'tipoAtendimento', v)}
            inputClassName={obrigTipoAtendVazio ? invalidInputClass : ''}
            blinkId={blinkTargetId}
          />
          <SelectField
            id={`guia-${index}-indicacaoAcidente`}
            className="col-span-1"
            label="Indicação de Acidente"
            value={guia.indicacaoAcidente}
            options={CODE_MAPS.indicacaoAcidente}
            onChange={(v) => onUpdateGuia(index, 'indicacaoAcidente', v)}
            inputClassName={obrigIndicacaoAcidenteVazio ? invalidInputClass : ''}
            blinkId={blinkTargetId}
          />
          <SelectField
            id={`guia-${index}-regimeAtendimento`}
            className="col-span-1"
            label="Regime de Atendimento"
            value={guia.regimeAtendimento}
            options={CODE_MAPS.regimeAtendimento}
            onChange={(v) => onUpdateGuia(index, 'regimeAtendimento', v)}
            inputClassName={obrigRegimeAtendVazio ? invalidInputClass : ''}
            blinkId={blinkTargetId}
          />

          <Field
            id={`guia-${index}-codigoPrestadorExecutante`}
            className="col-span-1 md:col-span-2"
            label="Código do Executante"
            value={guia.codigoPrestadorExecutante}
            onChange={(v) => onUpdateGuia(index, 'codigoPrestadorExecutante', v)}
            inputClassName={obrigCodigoExecVazio ? invalidInputClass : ''}
            blinkId={blinkTargetId}
          />
          <Field className="col-span-1" label="CNES" value={guia.cnes} onChange={(v) => onUpdateGuia(index, 'cnes', v)} />
          <Field
            id={`guia-${index}-senha`}
            className="col-span-1"
            label="Senha"
            value={guia.senha}
            onChange={(v) => onUpdateGuia(index, 'senha', v)}
            inputClassName={senhaObrigVazia ? invalidInputClass : ''}
            blinkId={blinkTargetId}
          />
          <Field
            id={`guia-${index}-dataAutorizacao`}
            className="col-span-1 md:col-span-2"
            label="Data da Autorização"
            value={guia.dataAutorizacao}
            onChange={(v) => onUpdateGuia(index, 'dataAutorizacao', formatDateInput(v))}
            inputClassName={dataAutorizObrigVazia ? invalidInputClass : ''}
            blinkId={blinkTargetId}
          />
          <Field
            id={`guia-${index}-dataValidadeSenha`}
            className="col-span-1 md:col-span-2"
            label="Validade da Senha"
            value={guia.dataValidadeSenha}
            onChange={(v) => onUpdateGuia(index, 'dataValidadeSenha', formatDateInput(v))}
            inputClassName={validadeSenhaObrigVazia ? invalidInputClass : ''}
            blinkId={blinkTargetId}
          />
        </div>

        <div className="overflow-x-auto rounded-lg border border-blue-100">
          <div className="min-w-[1000px]">
            <div className={`${gridCols} bg-linear-to-r from-blue-700 to-blue-600 text-white text-xs font-semibold`}>
              <div className="col-span-1 text-center py-2">Seq</div>
              <div className="col-span-1 text-center py-2">Tab</div>
              <div className="col-span-2 text-center py-2">Data</div>
              <div className="col-span-2 text-center py-2">Início</div>
              <div className="col-span-2 text-center py-2">Fim</div>
              <div className="col-span-2 text-center py-2">Código</div>
              <div className="col-span-7 text-left py-2 px-2">Procedimento</div>
              <div className="col-span-1 text-center py-2">Qtd</div>
              <div className="col-span-1 text-center py-2">Via</div>
              <div className="col-span-1 text-center py-2">Téc</div>
              <div className="col-span-2 text-center py-2">Red/Acr</div>
              <div className="col-span-2 text-center py-2">Unit</div>
              <div className="col-span-2 text-center py-2">Total</div>
            </div>
            {guia.procedimentos.map((p, pIdx) => (
              <ProcedimentoRow key={pIdx} index={pIdx} guiaIndex={index} procedimento={p} onUpdate={onUpdateProcedimento} />
            ))}
          </div>
        </div>

        {hasPreauthProcedures && (
          <div className="mt-2 text-xs font-medium text-rose-700">
            Esta requisição possui procedimentos que exigem senha e autorização prévia.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-neutral-200 bg-emerald-50/60 rounded-lg p-3">
          {totalFields.map(([key, label]) => (
            <Field key={key} label={label} value={guia[key]} labelClassName="text-emerald-800" onChange={(v) => onUpdateGuia(index, key, v)} />
          ))}
        </div>
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
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState(null)
  const [blinkTargetId, setBlinkTargetId] = useState(null)

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

  const removeGuia = useCallback((guiaIndex) => {
    setData((prev) => {
      if (!prev) return prev
      const guias = prev.guias.filter((_, idx) => idx !== guiaIndex)
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
    setSaveResult(null)
    setBlinkTargetId(null)
  }

  const isEmpty = (v) => String(v ?? '').trim() === ''

  const guiaHasValidationErrors = (guia) => {
    const errors = []
    if (!/^\d{20}$/.test(String(guia.numeroCarteira ?? ''))) errors.push('numeroCarteira')

    const requiredFields = [
      'nomeProfissional',
      'conselhoProfissional',
      'ufProfissional',
      'numeroConselhoProfissional',
      'cbos',
      'dataSolicitacao',
      'caraterAtendimento',
      'atendimentoRN',
      'tipoAtendimento',
      'indicacaoAcidente',
      'regimeAtendimento',
      'codigoPrestadorExecutante',
    ]

    for (const field of requiredFields) {
      if (isEmpty(guia[field])) errors.push(field)
    }

    const hasPreauth = guia.procedimentos?.some((p) =>
      AUTH_PREAUTH_CODES.has(String(p.codigoProcedimento ?? '').trim()),
    )

    if (hasPreauth) {
      if (isEmpty(guia.senha)) errors.push('senha')
      if (isEmpty(guia.dataAutorizacao)) errors.push('dataAutorizacao')
      if (isEmpty(guia.dataValidadeSenha)) errors.push('dataValidadeSenha')
    }

    return errors
  }

  const handleSave = async () => {
    if (!data || !Array.isArray(data.guias) || data.guias.length === 0) return

    setError(null)
    setSaveResult(null)
    setBlinkTargetId(null)

    const validation = data.guias.map(guiaHasValidationErrors)
    const hasAnyErrors = validation.some((errs) => errs.length > 0)

    if (hasAnyErrors) {
      setError('Existem guias com campos obrigatórios em branco ou carteirinha inválida. Corrija os campos em vermelho antes de salvar.')

      // localizar o primeiro campo inválido e focar
      for (let gIdx = 0; gIdx < validation.length; gIdx += 1) {
        const errs = validation[gIdx]
        if (!errs.length) continue

        let field = errs[0]
        // mapeia nomes de campo para ids usados nos inputs
        const fieldToId = {
          numeroCarteira: `guia-${gIdx}-numeroCarteira`,
          nomeProfissional: `guia-${gIdx}-nomeProfissional`,
          conselhoProfissional: `guia-${gIdx}-conselhoProfissional`,
          ufProfissional: `guia-${gIdx}-ufProfissional`,
          numeroConselhoProfissional: `guia-${gIdx}-numeroConselhoProfissional`,
          cbos: `guia-${gIdx}-cbos`,
          dataSolicitacao: `guia-${gIdx}-dataSolicitacao`,
          caraterAtendimento: `guia-${gIdx}-caraterAtendimento`,
          atendimentoRN: `guia-${gIdx}-atendimentoRN`,
          tipoAtendimento: `guia-${gIdx}-tipoAtendimento`,
          indicacaoAcidente: `guia-${gIdx}-indicacaoAcidente`,
          regimeAtendimento: `guia-${gIdx}-regimeAtendimento`,
          codigoPrestadorExecutante: `guia-${gIdx}-codigoPrestadorExecutante`,
          senha: `guia-${gIdx}-senha`,
          dataAutorizacao: `guia-${gIdx}-dataAutorizacao`,
          dataValidadeSenha: `guia-${gIdx}-dataValidadeSenha`,
        }

        const targetId = fieldToId[field]
        if (targetId) {
          setBlinkTargetId(targetId)
          const el = document.getElementById(targetId)
          if (el && typeof el.focus === 'function') {
            el.focus()
          }
        }
        break
      }

      return
    }

    try {
      setSaving(true)
      const result = await saveSulamericaGuiasWithCheck(data)
      const allCreated = result.every((r) => r.status === 'created')
      const anyFailed = result.some((r) => r.status !== 'created')
      setSaveResult({ allCreated, anyFailed, result })
    } catch (e) {
      setError(e.message || 'Erro ao salvar as guias no banco de dados.')
    } finally {
      setSaving(false)
    }
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
        <h1 className="text-2xl font-semibold text-blue-900">Portal SulAmérica</h1>
        <p className="mt-2 text-sm text-blue-600/80">Importe um XML TISS (guia médica) e visualize ou edite as guias.</p>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".xml"
            onChange={handleFileChange}
            className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-100 file:text-blue-700"
          />
          <button
            onClick={handleImport}
            disabled={!file || parsing}
            className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm hover:bg-blue-800 disabled:opacity-50"
          >
            {parsing ? 'Importando...' : 'Importar'}
          </button>
          {data && (
            <button
              onClick={handleClear}
              className="px-4 py-2 rounded-lg border border-blue-300 text-sm text-blue-700 hover:bg-blue-50"
            >
              Limpar
            </button>
          )}
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        {file && !data && <div className="mt-2 text-xs text-blue-500">{file.name}</div>}
      </div>

      {data && (
        <>
          <div className="rounded-2xl border border-blue-100 bg-white p-4 space-y-4">
            <h2 className="text-base font-semibold text-blue-800">Cabeçalho do lote</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Tipo de transação" value={data.header.tipoTransacao} onChange={(v) => updateHeader('tipoTransacao', v)} />
              <Field label="Sequencial transação" value={data.header.sequencialTransacao} onChange={(v) => updateHeader('sequencialTransacao', v)} />
              <Field label="Data registro transação" value={data.header.dataRegistroTransacao} onChange={(v) => updateHeader('dataRegistroTransacao', formatDateInput(v))} />
              <Field label="Hora registro transação" value={data.header.horaRegistroTransacao} onChange={(v) => updateHeader('horaRegistroTransacao', v)} />
              <Field label="Código prestador na operadora" value={data.header.codigoPrestadorNaOperadora} onChange={(v) => updateHeader('codigoPrestadorNaOperadora', v)} />
              <Field label="Registro ANS destino" value={data.header.registroANS} onChange={(v) => updateHeader('registroANS', v)} />
              <Field label="Padrão" value={data.header.padrao} onChange={(v) => updateHeader('padrao', v)} />
              <Field label="Número do lote" value={data.lote.numeroLote} onChange={updateLote} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-800">Guias ({data.guias.length})</h2>
          </div>

          <div className="space-y-4">
            {data.guias.map((guia, gIdx) => (
              <GuiaCard
                key={gIdx}
                index={gIdx}
                guia={guia}
                onUpdateGuia={updateGuia}
                onUpdateProcedimento={updateProcedimento}
                onRemoveGuia={removeGuia}
                blinkTargetId={blinkTargetId}
              />
            ))}
          </div>

          {saveResult && (
            <div className="mt-2 text-sm">
              {saveResult.allCreated && !saveResult.anyFailed && (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-800">
                  Todas as guias foram salvas com sucesso.
                </div>
              )}
              {(!saveResult.allCreated || saveResult.anyFailed) && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
                  Algumas guias não foram salvas (por já existirem ou por outro motivo). Verifique o número da requisição e tente novamente se necessário.
                </div>
              )}
            </div>
          )}
        </>
      )}
      {data && data.guias && data.guias.length > 0 && (
        <div className="fixed bottom-6 right-8 z-30">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !data.guias.length}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? 'Salvando guias...' : 'Salvar guias'}
          </button>
        </div>
      )}
    </div>
  )
}
