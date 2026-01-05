import { useEffect, useMemo, useRef, useState } from 'react'
import { listCollaboratorsPaged, createCollaborator, updateCollaborator, deleteCollaborator, listAuditLogsForTarget, listFunctions, createFunction } from '../lib/db'
import { useAuth } from '../contexts/AuthContext.jsx'
import { onlyDigits, maskCPF, validateCPF, maskCEP, formatDateISO, parseBRL, formatBRL, maskPhone, formatDateBR } from '../lib/format'

const BANKS = [
  { code: '001', name: 'Banco do Brasil' },
  { code: '033', name: 'Santander' },
  { code: '041', name: 'Banrisul' },
  { code: '077', name: 'Banco Inter' },
  { code: '104', name: 'Caixa Econômica Federal' },
  { code: '208', name: 'BTG Pactual' },
  { code: '212', name: 'Banco Original' },
  { code: '237', name: 'Bradesco' },
  { code: '260', name: 'Nubank' },
  { code: '323', name: 'Mercado Pago' },
  { code: '336', name: 'C6 Bank' },
  { code: '422', name: 'Banco Safra' },
  { code: '748', name: 'Sicredi' },
  { code: '756', name: 'Sicoob' },
]

function classNames(...xs) { return xs.filter(Boolean).join(' ') }

const FIELD_LABELS = {
  name: 'Nome',
  cpf: 'CPF',
  dob: 'Nascimento',
  mother_name: 'Nome da Mãe',
  street: 'Rua',
  number: 'Número',
  complement: 'Complemento',
  district: 'Bairro',
  city: 'Cidade',
  state: 'UF',
  cep: 'CEP',
  concent_id: 'ID Concent',
  bank_code: 'Banco (código)',
  bank_name: 'Banco',
  agency: 'Agência',
  account: 'Conta',
  pix_key: 'Chave PIX',
  admission_date: 'Admissão',
  function_id: 'Função',
  salary: 'Salário',
  notes: 'Observações',
  phone: 'Telefone',
  status: 'Status',
}

const CSV_HEADERS = [
  'name','cpf','dob','mother_name','street','number','complement','district','city','state','cep','concent_id','bank_code','agency','account','pix_key','admission_date','function','salary','notes','phone','status'
]
const CSV_REQUIRED = ['name','cpf']

export default function Collaborators() {
  const { role } = useAuth()
  const canAdmin = role === 'admin' || role === 'super'

  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rows, setRows] = useState([])
  const printRef = useRef(null)

  const [toast, setToast] = useState(null) // { title, message }

  const [openForm, setOpenForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const empty = { name: '', cpf: '', dob: '', mother_name: '', street: '', number: '', complement: '', district: '', city: '', state: '', cep: '', concent_id: '', bank_code: '', bank_name: '', agency: '', account: '', pix_key: '', admission_date: '', function_id: null, salary: '', notes: '', phone: '', status: 'active' }
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)
  const [formErrors, setFormErrors] = useState({})

  // Mask refs
  const cpfInputRef = useRef(null)
  const cepInputRef = useRef(null)
  const salaryInputRef = useRef(null)
  const masksRef = useRef({ cpf: null, cep: null, salary: null })

  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Drawer de detalhes
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailRow, setDetailRow] = useState(null)
  const [detailLogs, setDetailLogs] = useState([])

  // Import CSV
  const fileInputRef = useRef(null)

  // Functions list
  const [functions, setFunctions] = useState([])
  const functionMap = useMemo(() => Object.fromEntries((functions||[]).map(f => [f.id, f.name])), [functions])

  // Column selection for table/export
  const [columnsOpen, setColumnsOpen] = useState(false)
  const COLS = useMemo(() => ([
    { key: 'concent_id', label: 'ID Concent' },
    { key: 'name', label: 'Nome' },
    { key: 'cpf', label: 'CPF' },
    { key: 'function', label: 'Função' },
    { key: 'phone', label: 'Telefone' },
    { key: 'salary', label: 'Salário' },
    { key: 'bank_name', label: 'Banco' },
    { key: 'agency', label: 'Agência' },
    { key: 'account', label: 'Conta' },
    { key: 'pix_key', label: 'Chave PIX' },
    { key: 'dob', label: 'Nascimento' },
    { key: 'admission_date', label: 'Admissão' },
    { key: 'status', label: 'Status' },
  ]), [])
  const [selectedColumns, setSelectedColumns] = useState(['concent_id','name','cpf','function','phone'])
  const [orderBy, setOrderBy] = useState('name')
  const [direction, setDirection] = useState('asc')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [{ data, count } , fnList] = await Promise.all([
        listCollaboratorsPaged({ q, page, pageSize, orderBy, direction }),
        listFunctions(),
      ])
      const fnMapLocal = Object.fromEntries((fnList || []).map(f => [f.id, f.name]))
      let out = data || []
      if (orderBy === 'function') {
        out = [...out].sort((a, b) => {
          const an = (fnMapLocal[a.function_id] || '').toLowerCase()
          const bn = (fnMapLocal[b.function_id] || '').toLowerCase()
          return direction === 'asc' ? an.localeCompare(bn) : bn.localeCompare(an)
        })
      } else if (orderBy === 'concent_id') {
        out = [...out].sort((a, b) => {
          const an = parseInt(String(a.concent_id || '').replace(/\D/g, '')) || 0
          const bn = parseInt(String(b.concent_id || '').replace(/\D/g, '')) || 0
          return direction === 'asc' ? an - bn : bn - an
        })
      }
      setRows(out)
      setTotal(count || 0)
      setFunctions(fnList || [])
    } catch (e) {
      setError(e.message || 'Erro ao carregar colaboradores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [q, page, pageSize, orderBy, direction])

  // Initialize IMask when form opens
  useEffect(() => {
    if (!openForm) return
    let disposed = false
    ;(async () => {
      try {
        const IMask = (await import('imask')).default
        if (disposed) return
        if (cpfInputRef.current && !masksRef.current.cpf) {
          masksRef.current.cpf = IMask(cpfInputRef.current, { mask: '000.000.000-00' })
          masksRef.current.cpf.on('accept', () => setForm(f => ({ ...f, cpf: masksRef.current.cpf?.value || '' })))
        }
        if (cepInputRef.current && !masksRef.current.cep) {
          masksRef.current.cep = IMask(cepInputRef.current, { mask: '00000-000' })
          masksRef.current.cep.on('accept', () => setForm(f => ({ ...f, cep: masksRef.current.cep?.value || '' })))
        }
        if (salaryInputRef.current && !masksRef.current.salary) {
          masksRef.current.salary = IMask(salaryInputRef.current, {
            mask: Number,
            radix: ',',
            mapToRadix: ['.'],
            thousandsSeparator: '.',
            scale: 2,
            signed: false,
          })
          masksRef.current.salary.on('accept', () => setForm(f => ({ ...f, salary: salaryInputRef.current.value })))
        }
      } catch (_) {
        // fallback silencioso: utilitários de máscara já garantem formatação básica
      }
    })()
    return () => { disposed = true }
  }, [openForm])

  function toggleSort(key) {
    const k = key
    if (orderBy === k) {
      setDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setOrderBy(k)
      setDirection('asc')
    }
    setPage(1)
  }

  function onEdit(row) {
    setEditing(row)
    setForm({ ...empty, ...row })
    setOpenForm(true)
  }
  function onCreate() {
    setEditing(null)
    setForm(empty)
    setOpenForm(true)
  }

  async function onDetail(row) {
    setDetailRow(row)
    setDetailOpen(true)
    try {
      const logs = await listAuditLogsForTarget(row.id, 100)
      setDetailLogs(logs || [])
    } catch (_) {
      setDetailLogs([])
    }
  }

  async function onSave(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      // validações
      const errors = {}
      if (!validateCPF(form.cpf)) errors.cpf = 'CPF inválido'
      const cepDigits = onlyDigits(form.cep)
      if (form.cep && cepDigits.length !== 8) errors.cep = 'CEP inválido'
      setFormErrors(errors)
      if (Object.keys(errors).length) throw new Error('Verifique os campos destacados')

      const payload = {
        ...form,
        cpf: onlyDigits(form.cpf),
        cep: cepDigits,
        admission_date: formatDateISO(form.admission_date) || null,
        dob: formatDateISO(form.dob) || null,
        bank_name: (BANKS.find(b=>b.code===form.bank_code)?.name || form.bank_name || ''),
        salary: parseBRL(form.salary),
        phone: onlyDigits(form.phone),
        status: form.status,
      }
      if (editing) {
        await updateCollaborator(editing.id, payload)
      } else {
        await createCollaborator(payload)
      }
      setOpenForm(false)
      setEditing(null)
      setForm(empty)
      setPage(1)
      await load()
    } catch (e) {
      setError(e.message || 'Falha ao salvar colaborador')
    } finally {
      setSaving(false)
    }
  }

  async function onConfirmDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    setError(null)
    try {
      await deleteCollaborator(confirmDelete.id)
      setConfirmDelete(null)
      await load()
    } catch (e) {
      setError(e.message || 'Falha ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  async function onToggleStatus(row) {
    try {
      const next = row.status === 'active' ? 'inactive' : 'active'
      await updateCollaborator(row.id, { status: next })
      await load()
    } catch (e) {
      setError(e.message || 'Falha ao atualizar status')
    }
  }
  async function fillFromCep(cep) {
    const onlyDigits = (cep || '').replace(/\D/g, '')
    if (onlyDigits.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${onlyDigits}/json/`)
      const data = await res.json()
      if (data?.erro) return
      setForm((f) => ({
        ...f,
        cep: maskCEP(onlyDigits),
        street: data.logradouro || f.street,
        district: data.bairro || f.district,
        city: data.localidade || f.city,
        state: data.uf || f.state,
      }))
    } catch (_) {}
  }

  function onExportCSV() {
    const base = ['id', ...CSV_HEADERS]
    const headers = base.filter(h => h === 'id' || selectedColumns.includes(h) || ['name','cpf'].includes(h))
    const lines = [headers.join(',')]
    rows.forEach(r => {
      const vals = headers.map(h => {
        if (h === 'function') return functionMap[r.function_id] || ''
        if (h === 'salary') return formatBRL(r.salary)
        if (h === 'phone') return maskPhone(r.phone)
        if (h === 'dob' || h === 'admission_date') return formatDateBR(r[h])
        return (r[h] ?? '')
      })
      // escape simple commas/quotes
      const safe = vals.map(v => {
        const s = String(v)
        return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s
      })
      lines.push(safe.join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'colaboradores.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function onDownloadTemplate() {
    const headers = CSV_HEADERS
    const sample = [
      'Fulano de Tal',
      '123.456.789-09',
      '1990-01-01',
      'Mãe do Fulano',
      'Av. Brasil',
      '100',
      'Apto 101',
      'Centro',
      'Rio de Janeiro',
      'RJ',
      '20000-000',
      'ABC123',
      '237',
      '1234',
      '123456-7',
      'fulano@pix.com',
      '2020-02-01',
      'Analista',
      '1.234,56',
      'Observações livres',
      '(11) 99999-0000',
      'active',
    ]
    const lines = [headers.join(','), sample.join(',')]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo_colaboradores.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function onImportCSV(file) {
    if (!file) return
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(Boolean)
      if (lines.length < 2) return
      const sep = lines[0].includes(';') ? ';' : ','
      const headers = lines[0].split(sep).map(h => h.trim())
      const idx = (name) => headers.indexOf(name)
      // build function cache
      const fnCache = new Map((functions||[]).map(f => [f.name.toLowerCase(), f.id]))
      for (let i=1;i<lines.length;i++) {
        const cols = parseCSVLine(lines[i], sep)
        const get = (name) => (idx(name) >= 0 ? cols[idx(name)] : '')
        let function_id = null
        const fnName = (get('function') || '').trim()
        if (fnName) {
          const key = fnName.toLowerCase()
          if (fnCache.has(key)) function_id = fnCache.get(key)
          else {
            const created = await createFunction({ name: fnName })
            function_id = created.id
            fnCache.set(key, created.id)
          }
        }
        const payload = {
          name: get('name'),
          cpf: onlyDigits(get('cpf')),
          dob: formatDateISO(get('dob')),
          mother_name: get('mother_name'),
          street: get('street'),
          number: get('number'),
          complement: get('complement'),
          district: get('district'),
          city: get('city'),
          state: get('state'),
          cep: onlyDigits(get('cep')),
          concent_id: get('concent_id'),
          bank_code: get('bank_code'),
          agency: get('agency'),
          account: get('account'),
          pix_key: get('pix_key'),
          admission_date: formatDateISO(get('admission_date')),
          function_id,
          salary: parseBRL(get('salary')),
          notes: get('notes'),
          phone: onlyDigits(get('phone')),
          status: (get('status') || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active',
        }
        if (payload.name && payload.cpf) {
          await createCollaborator(payload)
        }
      }
      await load()
      alert('Importação concluída')
    } catch (e) {
      alert(e.message || 'Falha ao importar CSV')
    }
  }

  function parseCSVLine(line, sep=',') {
    const out = []
    let cur = ''
    let inQ = false
    for (let i=0;i<line.length;i++) {
      const ch = line[i]
      if (inQ) {
        if (ch === '"') {
          if (line[i+1] === '"') { cur += '"'; i++ } else { inQ = false }
        } else cur += ch
      } else {
        if (ch === '"') inQ = true
        else if (ch === sep) { out.push(cur); cur = '' }
        else cur += ch
      }
    }
    out.push(cur)
    return out.map(s => s.trim())
  }

  function onPrintPDF() {
    const node = printRef.current
    if (!node) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<html><head><title>Colaboradores</title><style>body{font-family:sans-serif} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:6px;font-size:12px;text-align:left}</style></head><body>${node.innerHTML}</body></html>`)
    w.document.close()
    w.focus()
    w.print()
    w.close()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Colaboradores</h1>
        {canAdmin && (
          <button onClick={onCreate} className="text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white px-3 py-2">Novo colaborador</button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e)=>{setPage(1);setQ(e.target.value)}} placeholder="Buscar por nome ou CPF" className="rounded-xl border border-neutral-200 bg-white/60 px-3 py-2.5"/>
        <button onClick={onExportCSV} className="px-3 py-2 text-xs rounded-xl border border-neutral-200">Exportar CSV</button>
        <button onClick={onDownloadTemplate} className="px-3 py-2 text-xs rounded-xl border border-neutral-200">Baixar modelo CSV</button>
        <button onClick={() => { setToast({ title: 'Modelo de CSV', message: `Cabeçalhos (ordem): ${CSV_HEADERS.join(', ')}\nObrigatórios: ${CSV_REQUIRED.join(', ')}` }); clearTimeout(window.__csv_toast_timer); window.__csv_toast_timer = setTimeout(() => setToast(null), 6000); fileInputRef.current?.click() }} className="px-3 py-2 text-xs rounded-xl border border-neutral-200">Importar CSV</button>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e)=>onImportCSV(e.target.files?.[0])} />
        <button onClick={onPrintPDF} className="px-3 py-2 text-xs rounded-xl border border-neutral-200">Exportar PDF</button>
        <div className="relative">
          <button onClick={()=>setColumnsOpen(v=>!v)} className="px-3 py-2 text-xs rounded-xl border border-neutral-200">Colunas</button>
          {columnsOpen && (
            <div className="absolute z-10 mt-2 w-64 rounded-xl border border-neutral-200 bg-white p-3 shadow">
              <div className="text-sm font-medium mb-2">Selecionar colunas</div>
              <div className="space-y-1">
                {COLS.map(col => (
                  <label key={col.key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={selectedColumns.includes(col.key)} onChange={(e)=>{
                      setSelectedColumns(prev => e.target.checked ? [...prev, col.key] : prev.filter(k => k !== col.key))
                    }} />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-neutral-500">Carregando...</div>
      ) : error ? (
        <div className="text-red-600 bg-red-50 rounded-xl px-3 py-2 text-sm">{error}</div>
      ) : (
        <>
          <div className="overflow-x-auto" ref={printRef}>
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr>
                  {COLS.filter(c => selectedColumns.includes(c.key)).map(c => (
                    <th key={c.key} className="py-2"><button onClick={()=>toggleSort(c.key)} className="inline-flex items-center gap-1 hover:underline"><span>{c.label}</span>{orderBy===c.key ? (<span>{direction==='asc' ? '↑' : '↓'}</span>) : null}</button></th>
                  ))}
                  <th className="py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-200">
                    {COLS.filter(c => selectedColumns.includes(c.key)).map(c => {
                      let val = r[c.key]
                      if (c.key === 'function') val = functionMap[r.function_id] || ''
                      if (c.key === 'salary') val = formatBRL(r.salary)
                      if (c.key === 'bank_name') val = r.bank_name || r.bank_code
                if (c.key === 'phone') val = maskPhone(r.phone)
                if (c.key === 'dob' || c.key === 'admission_date') val = formatDateBR(r[c.key])
                let cls = 'py-2'
                if (c.key === 'name' || c.key === 'function') cls += ' text-left'
                      return <td key={c.key} className={cls}>{val}</td>
                    })}
                    <td className="py-2">
                      <div className="inline-flex gap-2">
                        <button onClick={()=>onEdit(r)} className="px-2 py-1 text-xs rounded-lg border border-neutral-200">Editar</button>
                        <button onClick={()=>setConfirmDelete(r)} className="px-2 py-1 text-xs rounded-lg border border-red-200 text-red-600">Excluir</button>
                        <button onClick={()=>onDetail(r)} className="px-2 py-1 text-xs rounded-lg border border-neutral-200">Detalhes</button>
                        <button onClick={()=>onToggleStatus(r)} className={"px-2 py-1 text-xs rounded-lg border " + (r.status==='active' ? 'border-amber-300 text-amber-700' : 'border-green-300 text-green-700')}>{r.status==='active'?'Inativar':'Ativar'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-neutral-600">
            <div>
              {total === 0 ? '0 resultados' : `${(page-1)*pageSize+1}-${Math.min(page*pageSize, total)} de ${total}`}
            </div>
            <div className="inline-flex items-center gap-2">
              <select value={pageSize} onChange={(e)=>{setPage(1);setPageSize(parseInt(e.target.value)||10)}} className="rounded-lg border border-neutral-200 bg-transparent px-2 py-1">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-2 py-1 text-xs rounded-lg border border-neutral-200 disabled:opacity-50">Anterior</button>
              <button disabled={page*pageSize>=total} onClick={()=>setPage(p=>p+1)} className="px-2 py-1 text-xs rounded-lg border border-neutral-200 disabled:opacity-50">Próxima</button>
            </div>
          </div>
        </>
      )}

      {openForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-2xl p-6 bg-neutral-50 border border-neutral-200">
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Editar colaborador' : 'Novo colaborador'}</h2>
            <form onSubmit={onSave} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <input required placeholder="Nome" value={form.name} onChange={(e)=>setForm(f=>({...f,name:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
                <div>
                  <input ref={cpfInputRef} required placeholder="CPF" value={maskCPF(form.cpf)} onChange={(e)=>{ const v=e.target.value; setForm(f=>({...f,cpf:v})); setFormErrors(err => ({...err, cpf: validateCPF(v) ? '' : 'CPF inválido'})) }} className="rounded-xl border border-neutral-200 px-3 py-2.5 w-full"/>
                  {formErrors.cpf ? <div className="text-xs text-red-600 mt-1">{formErrors.cpf}</div> : null}
                </div>
                <label className="text-sm flex flex-col">
                  <span className="text-neutral-500 mb-1">Data de Nascimento</span>
                  <input type="date" value={form.dob} onChange={(e)=>setForm(f=>({...f,dob:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
                </label>
                <input placeholder="Nome da Mãe" value={form.mother_name} onChange={(e)=>setForm(f=>({...f,mother_name:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
              </div>

              <div className="grid md:grid-cols-6 gap-3">
                <div className="md:col-span-2">
                  <label className="text-sm flex flex-col">
                    <span className="text-neutral-500 mb-1">CEP</span>
                    <div>
                      <input ref={cepInputRef} placeholder="CEP" value={maskCEP(form.cep)} onChange={(e)=>{ const v=e.target.value; setForm(f=>({...f,cep:v})); setFormErrors(err => ({...err, cep: (!v || onlyDigits(v).length===8) ? '' : 'CEP inválido'})); fillFromCep(v) }} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
                      {formErrors.cep ? <div className="text-xs text-red-600 mt-1">{formErrors.cep}</div> : null}
                    </div>
                  </label>
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm flex flex-col">
                    <span className="text-neutral-500 mb-1">Rua</span>
                    <input value={form.street} onChange={(e)=>setForm(f=>({...f,street:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
                  </label>
                </div>
                <label className="text-sm flex flex-col">
                  <span className="text-neutral-500 mb-1">Nº</span>
                  <input value={form.number} onChange={(e)=>setForm(f=>({...f,number:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
                </label>
                <label className="text-sm flex flex-col">
                  <span className="text-neutral-500 mb-1">Complemento</span>
                  <input value={form.complement} onChange={(e)=>setForm(f=>({...f,complement:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
                </label>
                <label className="text-sm flex flex-col">
                  <span className="text-neutral-500 mb-1">Bairro</span>
                  <input value={form.district} onChange={(e)=>setForm(f=>({...f,district:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
                </label>
                <label className="text-sm flex flex-col">
                  <span className="text-neutral-500 mb-1">Cidade</span>
                  <input value={form.city} onChange={(e)=>setForm(f=>({...f,city:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
                </label>
                <label className="text-sm flex flex-col">
                  <span className="text-neutral-500 mb-1">UF</span>
                  <input value={form.state} onChange={(e)=>setForm(f=>({...f,state:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
                </label>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <input placeholder="ID Concent" value={form.concent_id} onChange={(e)=>setForm(f=>({...f,concent_id:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
                <label className="text-sm flex flex-col">
                  <span className="text-neutral-500 mb-1">Banco</span>
                  <select value={form.bank_code || ''} onChange={(e)=>setForm(f=>({...f,bank_code:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5">
                    <option value="">Selecione</option>
                    {BANKS.map(b => (
                      <option key={b.code} value={b.code}>{b.code} - {b.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm flex flex-col">
                  <span className="text-neutral-500 mb-1">Função</span>
                  <select value={form.function_id || ''} onChange={(e)=>setForm(f=>({...f,function_id:e.target.value||null}))} className="rounded-xl border border-neutral-200 px-3 py-2.5">
                    <option value="">Selecione</option>
                    {functions.map(fn => (
                      <option key={fn.id} value={fn.id}>{fn.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <label className="text-sm flex flex-col">
                  <span className="text-neutral-500 mb-1">Agência</span>
                  <input placeholder="Agência" value={form.agency || ''} onChange={(e)=>setForm(f=>({...f,agency:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
                </label>
                <label className="text-sm flex flex-col">
                  <span className="text-neutral-500 mb-1">Conta</span>
                  <input placeholder="Conta" value={form.account || ''} onChange={(e)=>setForm(f=>({...f,account:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
                </label>
                <label className="text-sm flex flex-col">
                  <span className="text-neutral-500 mb-1">Salário (BRL)</span>
                  <input ref={salaryInputRef} placeholder="0,00" value={form.salary || ''} onChange={(e)=>setForm(f=>({...f,salary:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
                </label>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <label className="text-sm flex flex-col md:col-span-1">
                  <span className="text-neutral-500 mb-1">Chave PIX</span>
                  <input placeholder="PIX" value={form.pix_key || ''} onChange={(e)=>setForm(f=>({...f,pix_key:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
                </label>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <label className="text-sm flex flex-col">
                  <span className="text-neutral-500 mb-1">Telefone</span>
                  <input placeholder="(11) 99999-0000" value={maskPhone(form.phone)} onChange={(e)=>setForm(f=>({...f,phone:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
                </label>
                <label className="text-sm flex flex-col">
                  <span className="text-neutral-500 mb-1">Status</span>
                  <select value={form.status} onChange={(e)=>setForm(f=>({...f,status:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5">
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                  </select>
                </label>
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <label className="text-sm flex flex-col">
                  <span className="text-neutral-500 mb-1">Data de Admissão</span>
                  <input type="date" value={form.admission_date} onChange={(e)=>setForm(f=>({...f,admission_date:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
                </label>
                <label className="text-sm flex flex-col md:col-span-2">
                  <span className="text-neutral-500 mb-1">Observações</span>
                  <textarea rows={3} value={form.notes || ''} onChange={(e)=>setForm(f=>({...f,notes:e.target.value}))} className="rounded-xl border border-neutral-200 px-3 py-2.5"/>
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>{setOpenForm(false);setEditing(null)}} className="px-3 py-2 text-xs rounded-lg border border-neutral-200">Cancelar</button>
                <button type="submit" disabled={saving} className="px-3 py-2 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl p-6 bg-neutral-50 border border-neutral-200">
            <h2 className="text-lg font-semibold mb-2">Confirmar exclusão</h2>
            <p className="text-sm text-neutral-600 mb-4">Deseja realmente excluir o colaborador {confirmDelete.name}?</p>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setConfirmDelete(null)} className="px-3 py-2 rounded-xl border border-neutral-200">Cancelar</button>
              <button onClick={onConfirmDelete} disabled={deleting} className="px-3 py-2 rounded-xl bg-red-600 text-white">{deleting? 'Excluindo...' : 'Excluir'}</button>
            </div>
          </div>
        </div>
      )}

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={()=>setDetailOpen(false)}></div>
          <div className="w-full max-w-xl h-full bg-white border-l border-neutral-200 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Detalhes do colaborador</h2>
              <button onClick={()=>setDetailOpen(false)} className="px-3 py-1.5 rounded-lg border border-neutral-200">Fechar</button>
            </div>
            {detailRow && (
              <div className="space-y-3 text-sm">
                <div><span className="text-neutral-500">Nome:</span> {detailRow.name}</div>
                <div><span className="text-neutral-500">CPF:</span> {detailRow.cpf}</div>
                <div><span className="text-neutral-500">Nascimento:</span> {detailRow.dob}</div>
                <div><span className="text-neutral-500">Mãe:</span> {detailRow.mother_name}</div>
                <div><span className="text-neutral-500">Endereço:</span> {detailRow.street}, {detailRow.number} {detailRow.complement} - {detailRow.district}, {detailRow.city}/{detailRow.state} - {detailRow.cep}</div>
                <div><span className="text-neutral-500">Banco:</span> {detailRow.bank_name || detailRow.bank_code} Ag {detailRow.agency} CC {detailRow.account} | PIX {detailRow.pix_key}</div>
                <div><span className="text-neutral-500">Admissão:</span> {detailRow.admission_date}</div>
              </div>
            )}
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Auditoria</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-neutral-500">
                    <tr>
                      <th className="py-2">Ação</th>
                      <th className="py-2">Ator</th>
                      <th className="py-2">Quando</th>
                      <th className="py-2">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailLogs.map((l)=> (
                      <tr key={l.id} className="border-t border-neutral-200">
                        <td className="py-2">{l.action}</td>
                        <td className="py-2">{l.actor_email || '-'}</td>
                        <td className="py-2">{new Date(l.created_at).toLocaleString()}</td>
                        <td className="py-2">
                          {l.details?.changed ? (
                            <div className="space-y-1">
                              {Object.entries(l.details.changed).map(([k, [from, to]]) => (
                                <div key={k}>
                                  <span className="text-neutral-500">{FIELD_LABELS[k] || k}:</span>
                                  <span className="text-red-600 ml-1">{String(from ?? '')}</span>
                                  <span className="mx-1">→</span>
                                  <span className="text-green-600">{String(to ?? '')}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-md rounded-xl border border-neutral-200 bg-white shadow p-4">
          <div className="font-medium mb-1">{toast.title}</div>
          <div className="text-sm whitespace-pre-wrap text-neutral-700">{toast.message}</div>
        </div>
      )}
    </div>
  )
}
