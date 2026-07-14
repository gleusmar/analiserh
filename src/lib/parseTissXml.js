function getText(parent, localName) {
  if (!parent) return ''
  for (const child of parent.children) {
    if (child.localName === localName) {
      return child.textContent.trim()
    }
  }
  return ''
}

function getChild(parent, localName) {
  if (!parent) return null
  for (const child of parent.children) {
    if (child.localName === localName) return child
  }
  return null
}

function parseProcedimento(el) {
  const proc = getChild(el, 'procedimento')
  return {
    sequencialItem: getText(el, 'sequencialItem'),
    dataExecucao: getText(el, 'dataExecucao'),
    horaInicial: getText(el, 'horaInicial'),
    horaFinal: getText(el, 'horaFinal'),
    codigoTabela: getText(proc, 'codigoTabela'),
    codigoProcedimento: getText(proc, 'codigoProcedimento'),
    descricaoProcedimento: getText(proc, 'descricaoProcedimento'),
    quantidadeExecutada: getText(el, 'quantidadeExecutada'),
    viaAcesso: getText(el, 'viaAcesso'),
    tecnicaUtilizada: getText(el, 'tecnicaUtilizada'),
    reducaoAcrescimo: getText(el, 'reducaoAcrescimo'),
    valorUnitario: getText(el, 'valorUnitario'),
    valorTotal: getText(el, 'valorTotal'),
  }
}

function parseProcedimentos(el) {
  if (!el) return []
  const items = []
  for (const child of el.children) {
    if (child.localName === 'procedimentoExecutado') {
      items.push(parseProcedimento(child))
    }
  }
  return items
}

function parseValorTotal(el) {
  if (!el) {
    return {
      valorProcedimentos: '',
      valorDiarias: '',
      valorTaxasAlugueis: '',
      valorMateriais: '',
      valorMedicamentos: '',
      valorOPME: '',
      valorGasesMedicinais: '',
      valorTotalGeral: '',
    }
  }
  return {
    valorProcedimentos: getText(el, 'valorProcedimentos'),
    valorDiarias: getText(el, 'valorDiarias'),
    valorTaxasAlugueis: getText(el, 'valorTaxasAlugueis'),
    valorMateriais: getText(el, 'valorMateriais'),
    valorMedicamentos: getText(el, 'valorMedicamentos'),
    valorOPME: getText(el, 'valorOPME'),
    valorGasesMedicinais: getText(el, 'valorGasesMedicinais'),
    valorTotalGeral: getText(el, 'valorTotalGeral'),
  }
}

function parseGuia(guia) {
  const cab = getChild(guia, 'cabecalhoGuia')
  const dadosBenef = getChild(guia, 'dadosBeneficiario')
  const dadosSolic = getChild(guia, 'dadosSolicitante')
  const contratadoSolic = getChild(dadosSolic, 'contratadoSolicitante')
  const profSolic = getChild(dadosSolic, 'profissionalSolicitante')
  const dadosSolicitacao = getChild(guia, 'dadosSolicitacao')
  const dadosExec = getChild(guia, 'dadosExecutante')
  const contratadoExec = getChild(dadosExec, 'contratadoExecutante')
  const dadosAtend = getChild(guia, 'dadosAtendimento')
  const dadosAut = getChild(guia, 'dadosAutorizacao')
  const procsEl = getChild(guia, 'procedimentosExecutados')
  const totalEl = getChild(guia, 'valorTotal')
  const total = parseValorTotal(totalEl)

  return {
    numeroGuiaPrestador: getText(cab, 'numeroGuiaPrestador'),
    registroANS: getText(cab, 'registroANS'),
    numeroCarteira: getText(dadosBenef, 'numeroCarteira'),
    atendimentoRN: getText(dadosBenef, 'atendimentoRN'),
    codigoPrestadorSolicitante: getText(contratadoSolic, 'codigoPrestadorNaOperadora'),
    nomeContratadoSolicitante: getText(dadosSolic, 'nomeContratadoSolicitante'),
    nomeProfissional: getText(profSolic, 'nomeProfissional'),
    conselhoProfissional: getText(profSolic, 'conselhoProfissional'),
    numeroConselhoProfissional: getText(profSolic, 'numeroConselhoProfissional'),
    ufProfissional: getText(profSolic, 'UF'),
    cbos: getText(profSolic, 'CBOS'),
    dataSolicitacao: getText(dadosSolicitacao, 'dataSolicitacao'),
    caraterAtendimento: getText(dadosSolicitacao, 'caraterAtendimento'),
    codigoPrestadorExecutante: getText(contratadoExec, 'codigoPrestadorNaOperadora'),
    cnes: getText(dadosExec, 'CNES'),
    tipoAtendimento: getText(dadosAtend, 'tipoAtendimento'),
    indicacaoAcidente: getText(dadosAtend, 'indicacaoAcidente'),
    regimeAtendimento: getText(dadosAtend, 'regimeAtendimento'),
    senha: getText(dadosAut, 'senha'),
    dataAutorizacao: getText(dadosAut, 'dataAutorizacao'),
    dataValidadeSenha: getText(dadosAut, 'dataValidadeSenha'),
    procedimentos: parseProcedimentos(procsEl),
    ...total,
  }
}

export function parseTissXml(xmlText) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')
  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    throw new Error('XML inválido: ' + parserError.textContent.trim())
  }

  const root = doc.documentElement
  if (!root || root.localName !== 'mensagemTISS') {
    throw new Error('O arquivo não parece ser um XML TISS válido.')
  }

  const cabecalho = getChild(root, 'cabecalho')
  const identTrans = getChild(cabecalho, 'identificacaoTransacao')
  const origem = getChild(cabecalho, 'origem')
  const identPrestador = getChild(origem, 'identificacaoPrestador')
  const destino = getChild(cabecalho, 'destino')
  const prestadorParaOperadora = getChild(root, 'prestadorParaOperadora')
  const loteGuias = getChild(prestadorParaOperadora, 'loteGuias')

  const guiaElements = []
  if (loteGuias) {
    for (const el of loteGuias.getElementsByTagName('*')) {
      if (el.localName === 'guiaSP-SADT') {
        guiaElements.push(el)
      }
    }
  }

  return {
    header: {
      tipoTransacao: getText(identTrans, 'tipoTransacao'),
      sequencialTransacao: getText(identTrans, 'sequencialTransacao'),
      dataRegistroTransacao: getText(identTrans, 'dataRegistroTransacao'),
      horaRegistroTransacao: getText(identTrans, 'horaRegistroTransacao'),
      codigoPrestadorNaOperadora: getText(identPrestador, 'codigoPrestadorNaOperadora'),
      registroANS: getText(destino, 'registroANS'),
      padrao: getText(cabecalho, 'Padrao'),
    },
    lote: {
      numeroLote: getText(loteGuias, 'numeroLote'),
    },
    guias: guiaElements.map(parseGuia),
  }
}
