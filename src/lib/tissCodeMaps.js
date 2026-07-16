export const UF_MAP = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA',
  '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE',
  '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE',
  '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT',
  '52': 'GO', '53': 'DF', '98': 'EX',
}

export const CONSELHO_MAP = {
  '01': 'CRESS', '02': 'COREN', '03': 'CRF', '04': 'CREFONO',
  '05': 'CREFITO', '06': 'CRM', '07': 'CRN', '08': 'CRO',
  '09': 'CRP', '10': 'Outros Conselhos', '11': 'CRBio',
  '12': 'CRBM', '13': 'CREF', '14': 'CRMV', '15': 'CRTR',
}

export const CARATER_ATENDIMENTO_MAP = {
  '1': 'Eletivo', '2': 'Urgência/Emergência',
}

export const TIPO_ATENDIMENTO_MAP = {
  '01': 'Remoção', '02': 'Pequena Cirurgia', '03': 'Outras Terapias',
  '04': 'Consulta', '08': 'Quimioterapia', '09': 'Radioterapia',
  '10': 'Terapia Renal Substitutiva (TRS)', '13': 'Pequeno atendimento (sutura, gesso e outros)',
  '23': 'Exame',
}

export const ATENDIMENTO_RN_MAP = {
  'N': 'Não', 'S': 'Sim',
}

export const TIPO_CONSULTA_MAP = {
  '1': 'Primeira Consulta', '2': 'Retorno', '3': 'Pré-natal', '4': 'Por encaminhamento',
}

export const INDICACAO_ACIDENTE_MAP = {
  '0': 'Trabalho', '1': 'Trânsito', '2': 'Outros', '9': 'Não Acidente',
}

export const REGIME_ATENDIMENTO_MAP = {
  '01': 'Ambulatorial', '02': 'Domiciliar', '03': 'Internação',
  '04': 'Pronto-socorro', '05': 'TELESSAÚDE',
}

export const CODE_MAPS = {
  ufProfissional: UF_MAP,
  conselhoProfissional: CONSELHO_MAP,
  caraterAtendimento: CARATER_ATENDIMENTO_MAP,
  tipoAtendimento: TIPO_ATENDIMENTO_MAP,
  atendimentoRN: ATENDIMENTO_RN_MAP,
  tipoConsulta: TIPO_CONSULTA_MAP,
  indicacaoAcidente: INDICACAO_ACIDENTE_MAP,
  regimeAtendimento: REGIME_ATENDIMENTO_MAP,
}

export function getTissLabel(map, code, fallback = code) {
  if (code == null || code === '') return ''
  const key = String(code).trim()
  return map[key] ?? map[key.padStart(2, '0')] ?? fallback
}

export function formatDateBr(value) {
  if (!value) return ''
  const v = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-')
    return `${d}/${m}/${y}`
  }
  return v
}

export function formatDateInput(value) {
  if (!value) return ''
  const v = String(value).trim()
  // Se vier no formato ISO (do XML ou do banco), converte para dd/mm/aaaa
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDateBr(v)

  // A partir daqui, aplica máscara de data enquanto o usuário digita
  const digits = v.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length <= 2) {
    return digits
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`
}
