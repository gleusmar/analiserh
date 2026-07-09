import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function Sulamerica() {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()
  const [toast, setToast] = useState(null)
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (loading) return
    // Se o perfil ainda não foi carregado, não decidir ainda
    if (!profile) return
    if (profile.can_access_sulamerica) return
    setToast({ title: 'Acesso restrito', message: 'Você não tem permissão para acessar o portal SulAmérica.' })
    const timer = setTimeout(() => {
      // Redirecionar para o domínio principal de RH
      window.location.href = 'https://rh.analiselabclinico.com.br'
    }, 2500)
    return () => clearTimeout(timer)
  }, [loading, profile, navigate])

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-neutral-500">Carregando...</div>
  }

  // Enquanto o perfil não estiver carregado, evitar piscar tela de acesso negado
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

  const onFileChange = (e) => {
    const f = e.target.files?.[0] || null
    setFile(f)
    setResult(null)
    setError('')
  }

  const readFileAsBase64 = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = (err) => reject(err)
    reader.readAsDataURL(f)
  })

  const onImport = async (e) => {
    e.preventDefault()
    if (!file) {
      setError('Selecione um arquivo PDF no padrão TISS para continuar.')
      return
    }
    try {
      setImporting(true)
      setError('')
      setResult(null)
      const base64 = await readFileAsBase64(file)

      const res = await fetch('http://localhost:3001/api/sulamerica/parse-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: base64 }),
      })

      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Falha ao processar PDF')
      }
      setResult(json)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Falha ao importar PDF')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <h1 className="text-2xl font-semibold">Portal SulAmérica</h1>
        <p className="mt-2 text-sm text-neutral-600">Importe o PDF da guia TISS para visualizar os dados extraídos.</p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700 space-y-4">
        <form className="space-y-4" onSubmit={onImport}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-800">Arquivo da guia TISS (PDF)</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={onFileChange}
              className="block w-full text-sm text-neutral-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-neutral-300 file:text-sm file:font-medium file:bg-neutral-50 file:text-neutral-800 hover:file:bg-neutral-100"
            />
            <p className="text-xs text-neutral-500">Selecione o PDF padronizado da guia médica de plano de saúde SulAmérica.</p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={importing}
            className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {importing ? 'Importando...' : 'Importar PDF'}
          </button>
        </form>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
            <h2 className="text-base font-semibold mb-3">Dados da guia</h2>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs md:text-sm">
              <div>
                <dt className="font-medium text-neutral-800">Registro ANS</dt>
                <dd>{result.header?.registro_ANS || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Código na Operadora</dt>
                <dd>{result.header?.codigo_operadora || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Nome do Contratado</dt>
                <dd>{result.header?.nome_contratado || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Nº da Requisição</dt>
                <dd>{result.header?.numero_requisicao || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Data da Autorização</dt>
                <dd>{result.header?.data_autorizacao || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Número da Carteira</dt>
                <dd>{result.header?.numero_carteira || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Validade da Carteira</dt>
                <dd>{result.header?.validade_carteira || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Nome do Beneficiário</dt>
                <dd>{result.header?.beneficiario_nome || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Cartão Nacional de Saúde (CNS)</dt>
                <dd>{result.header?.cns || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Atendimento RN</dt>
                <dd>{result.header?.atendimento_RN || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Profissional Solicitante</dt>
                <dd>{result.header?.profissional_nome || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Conselho Profissional</dt>
                <dd>{result.header?.conselho_profissional || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Número no Conselho</dt>
                <dd>{result.header?.numero_conselho || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">UF do Conselho</dt>
                <dd>{result.header?.uf_conselho || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">CBOS</dt>
                <dd>{result.header?.cbos || '\u2014'}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="font-medium text-neutral-800">Indicação Clínica</dt>
                <dd>{result.header?.indicacao_clinica || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Tipo de Atendimento</dt>
                <dd>{result.header?.tipo_atendimento || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Indicação de Acidente</dt>
                <dd>{result.header?.indicacao_acidente || '\u2014'}</dd>
              </div>
              <div>
                <dt className="font-medium text-neutral-800">Tipo de Consulta</dt>
                <dd>{result.header?.tipo_consulta || '\u2014'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
            <h2 className="text-base font-semibold mb-3">Exames</h2>
            {(!result.exams || result.exams.length === 0) ? (
              <p className="text-xs text-neutral-500">Nenhum exame encontrado no PDF.</p>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-xs md:text-sm border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-700">
                      <th className="border border-neutral-200 px-2 py-1 text-left">Data</th>
                      <th className="border border-neutral-200 px-2 py-1 text-left">Código</th>
                      <th className="border border-neutral-200 px-2 py-1 text-left">Descrição</th>
                      <th className="border border-neutral-200 px-2 py-1 text-right">Quantidade</th>
                      <th className="border border-neutral-200 px-2 py-1 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.exams.map((ex, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                        <td className="border border-neutral-200 px-2 py-1 whitespace-nowrap">{ex.date || '\u2014'}</td>
                        <td className="border border-neutral-200 px-2 py-1 whitespace-nowrap">{ex.code || '\u2014'}</td>
                        <td className="border border-neutral-200 px-2 py-1">{ex.description || '\u2014'}</td>
                        <td className="border border-neutral-200 px-2 py-1 text-right">{ex.quantity ?? '\u2014'}</td>
                        <td className="border border-neutral-200 px-2 py-1 text-right">{ex.value || '\u2014'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
