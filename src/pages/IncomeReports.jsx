import { useEffect, useMemo, useState } from 'react'
import { Upload, FileDown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { listAllCollaboratorsSimple, listIncomeReports, createIncomeReports, uploadIncomeReport, getIncomeReportUrl } from '../lib/db'

function currentYear() {
  return new Date().getFullYear()
}

export default function IncomeReports() {
  const { role, profile } = useAuth()
  const canAdmin = role === 'admin' || role === 'super'
  const isUser = role === 'user'

  const [year, setYear] = useState(currentYear())
  const [collaborators, setCollaborators] = useState([])
  const [selectedCollaborators, setSelectedCollaborators] = useState([])
  const [reports, setReports] = useState([])
  const [hasPdf, setHasPdf] = useState({}) // key: `${year}:${collaborator_id}` -> bool
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingKey, setUploadingKey] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        if (canAdmin) {
          const [cols, reps] = await Promise.all([
            listAllCollaboratorsSimple(),
            listIncomeReports(),
          ])
          if (cancelled) return
          setCollaborators(cols || [])
          setReports(reps || [])
          await preloadHasPdf(reps || [])
        } else if (isUser) {
          const colId = profile?.collaborator_id
          if (!colId) {
            setReports([])
            setHasPdf({})
          } else {
            const reps = await listIncomeReports({ collaboratorId: colId })
            if (cancelled) return
            setReports(reps || [])
            await preloadHasPdf(reps || [])
          }
        } else {
          // gestor-plantoes ou outros: apenas leitura de todos os informes
          const reps = await listIncomeReports()
          if (cancelled) return
          setReports(reps || [])
          await preloadHasPdf(reps || [])
        }
      } catch (e) {
        console.error(e)
        alert(e.message || 'Falha ao carregar informes de rendimentos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [canAdmin, isUser, profile])

  async function preloadHasPdf(list) {
    const entries = list || []
    if (!entries.length) {
      setHasPdf({})
      return
    }
    const map = {}
    await Promise.all(entries.map(async (r) => {
      const key = `${r.year}:${r.collaborator_id}`
      try {
        const url = await getIncomeReportUrl(r.year, r.collaborator_id, 60)
        map[key] = !!url
      } catch (_) {
        map[key] = false
      }
    }))
    setHasPdf(map)
  }

  const groupedByYear = useMemo(() => {
    const byYear = {}
    ;(reports || []).forEach(r => {
      const y = r.year
      if (!byYear[y]) byYear[y] = []
      byYear[y].push(r)
    })
    const entries = Object.entries(byYear)
    entries.forEach(([, arr]) => {
      arr.sort((a, b) => {
        const an = a.collaborators?.name || ''
        const bn = b.collaborators?.name || ''
        return an.localeCompare(bn, 'pt-BR')
      })
    })
    entries.sort((a, b) => Number(b[0]) - Number(a[0]))
    return entries
  }, [reports])

  function toggleCollaborator(id) {
    setSelectedCollaborators((prev) => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      return [...prev, id]
    })
  }

  function selectAllCollaborators() {
    setSelectedCollaborators(collaborators.map(c => c.id))
  }

  function clearSelectedCollaborators() {
    setSelectedCollaborators([])
  }

  async function onCreateReports(e) {
    e.preventDefault()
    if (!canAdmin) return
    if (!year || !selectedCollaborators.length) {
      alert('Selecione o ano e pelo menos um colaborador')
      return
    }
    try {
      setSaving(true)
      const created = await createIncomeReports(year, selectedCollaborators)
      if (created && created.length) {
        const all = [...reports, ...created]
        setReports(all)
        await preloadHasPdf(all)
        clearSelectedCollaborators()
      } else {
        // Nenhum novo registro criado (já existiam)
        const refreshed = await listIncomeReports()
        setReports(refreshed || [])
        await preloadHasPdf(refreshed || [])
      }
    } catch (e) {
      console.error(e)
      alert(e.message || 'Falha ao criar informes de rendimentos')
    } finally {
      setSaving(false)
    }
  }

  async function onUpload(report, file) {
    if (!canAdmin || !file) return
    const key = `${report.year}:${report.collaborator_id}`
    try {
      setUploadingKey(key)
      await uploadIncomeReport(report.year, report.collaborator_id, file)
      setHasPdf(prev => ({ ...prev, [key]: true }))
    } catch (e) {
      console.error(e)
      alert(e.message || 'Falha ao enviar informe de rendimentos')
    } finally {
      setUploadingKey(null)
    }
  }

  async function onDownload(report) {
    try {
      const url = await getIncomeReportUrl(report.year, report.collaborator_id)
      if (!url) {
        alert('Informe de rendimentos não encontrado')
        return
      }
      window.open(url, '_blank')
    } catch (e) {
      console.error(e)
      alert(e.message || 'Falha ao baixar informe de rendimentos')
    }
  }

  const title = 'Informe de Rendimentos'

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-neutral-900">{title}</h1>
        {canAdmin && (
          <form onSubmit={onCreateReports} className="flex flex-col md:flex-row gap-3 items-start md:items-end bg-neutral-50 border border-neutral-200 rounded-xl p-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-700">Ano</label>
              <input
                type="number"
                min="2000"
                max="2100"
                value={year}
                onChange={e => setYear(Number(e.target.value) || currentYear())}
                className="w-24 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
              />
            </div>
            <div className="flex-1 flex flex-col gap-2 min-w-[220px]">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-neutral-700">Colaboradores (inclui inativos)</div>
                <div className="flex gap-2 text-[11px]">
                  <button type="button" onClick={selectAllCollaborators} className="text-blue-700 hover:underline">Selecionar todos</button>
                  <button type="button" onClick={clearSelectedCollaborators} className="text-neutral-600 hover:underline">Limpar</button>
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto border border-neutral-200 rounded-lg bg-white p-2 space-y-1 text-xs">
                {(collaborators || []).map(c => (
                  <label key={c.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selectedCollaborators.includes(c.id)}
                      onChange={() => toggleCollaborator(c.id)}
                    />
                    <span className="truncate">{c.name} {c.status === 'inactive' && <span className="text-[10px] text-red-600">(inativo)</span>}</span>
                  </label>
                ))}
                {!collaborators.length && (
                  <div className="text-[11px] text-neutral-500">Nenhum colaborador encontrado.</div>
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Criar registros'}
            </button>
          </form>
        )}
      </div>

      {isUser && !profile?.collaborator_id && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
          Seu usuário não está vinculado a um colaborador. Não há informes de rendimentos para exibir.
        </div>
      )}

      {loading ? (
        <div className="text-sm text-neutral-600">Carregando informes...</div>
      ) : groupedByYear.length === 0 ? (
        <div className="text-sm text-neutral-600">Nenhum informe de rendimentos cadastrado.</div>
      ) : (
        <div className="space-y-4">
          {groupedByYear.map(([y, list]) => (
            <div key={y} className="border border-neutral-200 rounded-xl bg-white">
              <div className="px-3 py-2 border-b border-neutral-200 flex items-center justify-between">
                <div className="font-semibold text-sm text-neutral-900">Ano {y}</div>
                <div className="text-[11px] text-neutral-500">{list.length} colaborador(es)</div>
              </div>
              <div className="divide-y divide-neutral-100">
                {list.map(r => {
                  const key = `${r.year}:${r.collaborator_id}`
                  const col = r.collaborators || {}
                  const pdfExists = !!hasPdf[key]
                  const disabledUpload = uploadingKey === key
                  return (
                    <div key={r.id} className="px-3 py-2 flex items-center justify-between gap-3 text-xs md:text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-neutral-900">{col.name || 'Colaborador'}</div>
                        {col.status === 'inactive' && (
                          <div className="text-[11px] text-red-600">Inativo</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onDownload(r)}
                          className={
                            'w-8 h-8 grid place-items-center rounded-md text-white ' +
                            (pdfExists ? 'bg-blue-600 hover:bg-blue-700' : 'bg-neutral-300')
                          }
                          title={pdfExists ? 'Baixar informe de rendimentos' : 'Informe ainda não enviado'}
                          disabled={!pdfExists}
                        >
                          <FileDown className="size-4" />
                        </button>
                        {canAdmin && (
                          <label className="w-8 h-8 grid place-items-center rounded-md bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer text-[11px]">
                            <Upload className="size-4" />
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                e.target.value = ''
                                if (file) onUpload(r, file)
                              }}
                              disabled={disabledUpload}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
