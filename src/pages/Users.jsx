import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  listProfiles,
  updateProfileRole,
  updateProfileStatus,
  listInvitations,
  createInvitation,
  revokeInvitation,
  listAuditLogs,
  listProfilesPaged,
  listAuditLogsPaged,
  listCollaboratorsSimple,
} from '../lib/db'
import { createUser, linkProfileCollaborator } from '../lib/adminApi'
import { CreateUserModal } from '../components/CreateUserModal.jsx'

function classNames(...xs) { return xs.filter(Boolean).join(' ') }

export default function Users() {
  const { user, role } = useAuth()
  const superEmail = import.meta.env.VITE_SUPER_EMAIL
  const [tab, setTab] = useState('users')
  const [loading, setLoading] = useState(true)
  const [usersList, setUsersList] = useState([])
  const [invites, setInvites] = useState([])
  const [logs, setLogs] = useState([])
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ email: '', role: 'user' })
  const [creating, setCreating] = useState(false)
  const [justCreatedInvite, setJustCreatedInvite] = useState(null)
  const [collaborators, setCollaborators] = useState([])
  const [pendingLinks, setPendingLinks] = useState({})
  const [linking, setLinking] = useState({})

  const isSuper = useMemo(() => (user?.email && user.email === superEmail) || role === 'super', [user, superEmail, role])
  const canAdmin = useMemo(() => isSuper || role === 'admin', [isSuper, role])

  // Filtros e paginação - Usuários
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [usersPage, setUsersPage] = useState(1)
  const [usersPageSize, setUsersPageSize] = useState(10)
  const [usersTotal, setUsersTotal] = useState(0)

  // Filtros e paginação - Auditoria
  const [auditQ, setAuditQ] = useState('')
  const [auditAction, setAuditAction] = useState('all')
  const [auditPage, setAuditPage] = useState(1)
  const [auditPageSize, setAuditPageSize] = useState(20)
  const [auditTotal, setAuditTotal] = useState(0)

  // Modal de criação de usuário
  const [openCreate, setOpenCreate] = useState(false)
  const [createData, setCreateData] = useState({ email: '', password: '', role: 'user' })
  const [creatingUser, setCreatingUser] = useState(false)
  const [createError, setCreateError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [profilesPaged, invs, logsPaged] = await Promise.all([
        listProfilesPaged({ q, role: roleFilter, status: statusFilter, page: usersPage, pageSize: usersPageSize, orderBy: 'created_at', direction: 'asc' }),
        listInvitations(),
        listAuditLogsPaged({ q: auditQ, action: auditAction, page: auditPage, pageSize: auditPageSize }),
      ])
      setUsersList(profilesPaged?.data || [])
      setUsersTotal(profilesPaged?.count || 0)
      setInvites(invs || [])
      setLogs(logsPaged?.data || [])
      setAuditTotal(logsPaged?.count || 0)
    } catch (e) {
      setError(e.message || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [q, roleFilter, statusFilter, usersPage, usersPageSize, auditQ, auditAction, auditPage, auditPageSize])

  useEffect(() => {
    let active = true
    async function loadCollabs() {
      try {
        const xs = await listCollaboratorsSimple()
        if (active) setCollaborators(xs || [])
      } catch (_) {}
    }
    loadCollabs()
    return () => { active = false }
  }, [])

  function collabNameById(id) {
    const c = (collaborators||[]).find(x => x.id === id)
    return c ? `${c.name}${c.concent_id ? ` (${c.concent_id})` : ''}` : '-'
  }

  function onChangeUserCollaborator(u, cid) {
    const val = cid === null || cid === '' ? null : (isNaN(Number(cid)) ? cid : Number(cid))
    setPendingLinks((m) => ({ ...m, [u.id]: val }))
  }

  async function onSaveUserCollaborator(u) {
    const cid = pendingLinks[u.id] ?? null
    setLinking((m) => ({ ...m, [u.id]: true }))
    try {
      await linkProfileCollaborator(u.id, cid, { id: user?.id, email: user?.email })
      setUsersList((xs) => xs.map((x) => (x.id === u.id ? { ...x, collaborator_id: cid || null } : x)))
    } catch (e) {
      alert(e.message || 'Erro ao vincular colaborador')
    } finally {
      setLinking((m) => ({ ...m, [u.id]: false }))
    }
  }

  function roleLabel(item) {
    if (item.email === superEmail) return 'super'
    return item.role || 'user'
  }

  async function onChangeRole(u, role) {
    try {
      await updateProfileRole(u.id, role)
      setUsersList((xs) => xs.map((x) => (x.id === u.id ? { ...x, role } : x)))
    } catch (e) {
      alert(e.message || 'Erro ao atualizar papel')
    }
  }

  async function onChangeStatus(u, status) {
    try {
      await updateProfileStatus(u.id, status)
      setUsersList((xs) => xs.map((x) => (x.id === u.id ? { ...x, status } : x)))
    } catch (e) {
      alert(e.message || 'Erro ao atualizar status')
    }
  }

  async function onInvite(e) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    setJustCreatedInvite(null)
    try {
      const inv = await createInvitation(form.email, form.role)
      setInvites((xs) => [inv, ...xs])
      setJustCreatedInvite(inv)
      setForm({ email: '', role: 'user' })
    } catch (e) {
      setError(e.message || 'Erro ao criar convite')
    } finally {
      setCreating(false)
    }
  }

  async function onRevoke(inv) {
    try {
      await revokeInvitation(inv.id)
      setInvites((xs) => xs.map((x) => (x.id === inv.id ? { ...x, status: 'revoked' } : x)))
    } catch (e) {
      alert(e.message || 'Erro ao revogar convite')
    }
  }

  function inviteLink(inv) {
    return `${window.location.origin}/invite/${inv.token}`
  }

  async function copyLink(inv) {
    try {
      await navigator.clipboard.writeText(inviteLink(inv))
      alert('Link copiado!')
    } catch (_) {
      alert('Falha ao copiar')
    }
  }

  async function onCreateUser(e) {
    e.preventDefault()
    setCreatingUser(true)
    setCreateError(null)
    try {
      await createUser(createData, { id: user?.id, email: user?.email })
      setOpenCreate(false)
      setCreateData({ email: '', password: '', role: 'user' })
      setUsersPage(1)
      await load()
      alert('Usuário criado com sucesso.')
    } catch (err) {
      try {
        await createInvitation(createData.email, createData.role)
        setOpenCreate(false)
        setCreateData({ email: '', password: '', role: 'user' })
        alert('Backend de criação não configurado. Convite gerado como alternativa.')
      } catch (e2) {
        setCreateError(err.message || 'Falha ao criar usuário')
      }
    } finally {
      setCreatingUser(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gestão de Usuários</h1>
      </div>

      <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-800">
        <button className={classNames('px-3 py-2 text-sm', tab==='users' && 'border-b-2 border-neutral-900 dark:border-white font-semibold')} onClick={()=>setTab('users')}>Usuários</button>
        <button className={classNames('px-3 py-2 text-sm', tab==='invites' && 'border-b-2 border-neutral-900 dark:border-white font-semibold')} onClick={()=>setTab('invites')}>Convites</button>
        <button className={classNames('px-3 py-2 text-sm', tab==='audit' && 'border-b-2 border-neutral-900 dark:border-white font-semibold')} onClick={()=>setTab('audit')}>Auditoria</button>
      </div>

      {loading ? (
        <div className="text-neutral-500">Carregando...</div>
      ) : error ? (
        <div className="text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30 rounded-xl px-3 py-2 text-sm">{error}</div>
      ) : (
        <>
          {tab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                <div className="flex flex-wrap gap-2 items-center">
                  <input value={q} onChange={(e)=>{setUsersPage(1);setQ(e.target.value)}} placeholder="Buscar e-mail" className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 px-3 py-2.5"/>
                  <select value={roleFilter} onChange={(e)=>{setUsersPage(1);setRoleFilter(e.target.value)}} className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 px-3 py-2.5">
                    <option value="all">papel: todos</option>
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    <option value="gestor-plantoes">gestor-plantoes</option>
                  </select>
                  <select value={statusFilter} onChange={(e)=>{setUsersPage(1);setStatusFilter(e.target.value)}} className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 px-3 py-2.5">
                    <option value="all">status: todos</option>
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </div>
                {isSuper && (
                  <div className="flex items-center gap-2">
                    <button onClick={()=>setOpenCreate(true)} className="rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-3 py-2.5">Criar usuário</button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-neutral-500">
                    <tr>
                      <th className="py-2">E-mail</th>
                      <th className="py-2">Papel</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Colaborador</th>
                      <th className="py-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => {
                      const currentRole = roleLabel(u)
                      const lock = u.email === superEmail
                      return (
                        <tr key={u.id} className="border-t border-neutral-200 dark:border-neutral-800">
                          <td className="py-2">{u.email}</td>
                          <td className="py-2 capitalize">{currentRole}</td>
                          <td className="py-2 capitalize">{u.status || 'active'}</td>
                          <td className="py-2">
                            {canAdmin ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={(pendingLinks[u.id] ?? u.collaborator_id ?? '').toString()}
                                  onChange={(e)=>onChangeUserCollaborator(u, e.target.value || null)}
                                  className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 px-2 py-1.5 min-w-[220px]"
                                >
                                  <option value="">— não vinculado —</option>
                                  {collaborators.map((c) => (
                                    <option key={c.id} value={c.id.toString()}>{c.name}{c.concent_id ? ` (${c.concent_id})` : ''}</option>
                                  ))}
                                </select>
                                <button
                                  disabled={linking[u.id] || ((pendingLinks[u.id] ?? u.collaborator_id ?? null) === (u.collaborator_id ?? null))}
                                  onClick={()=>onSaveUserCollaborator(u)}
                                  className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 disabled:opacity-50"
                                >{linking[u.id] ? 'Salvando...' : 'Salvar'}</button>
                              </div>
                            ) : (
                              <span className="text-sm text-neutral-700 dark:text-neutral-300">{u.collaborator_id ? collabNameById(u.collaborator_id) : '-'}</span>
                            )}
                          </td>
                          <td className="py-2">
                            {isSuper ? (
                              <div className="inline-flex gap-2">
                                <button disabled={lock || currentRole==='admin'} onClick={()=>onChangeRole(u,'admin')} className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 disabled:opacity-50">Tornar admin</button>
                                <button disabled={lock || currentRole==='user'} onClick={()=>onChangeRole(u,'user')} className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 disabled:opacity-50">Tornar user</button>
                                <button disabled={lock || currentRole==='gestor-plantoes'} onClick={()=>onChangeRole(u,'gestor-plantoes')} className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 disabled:opacity-50">Tornar gestor</button>
                                <button disabled={lock || (u.status==='inactive')} onClick={()=>onChangeStatus(u,'inactive')} className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 disabled:opacity-50">Desativar</button>
                                <button disabled={lock || (u.status==='active' || !u.status)} onClick={()=>onChangeStatus(u,'active')} className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 disabled:opacity-50">Ativar</button>
                              </div>
                            ) : (
                              <div className="text-xs text-neutral-500">Somente visualização</div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
                <div>
                  {usersTotal === 0 ? '0 resultados' : `${(usersPage-1)*usersPageSize+1}-${Math.min(usersPage*usersPageSize, usersTotal)} de ${usersTotal}`}
                </div>
                <div className="inline-flex items-center gap-2">
                  <select value={usersPageSize} onChange={(e)=>{setUsersPage(1);setUsersPageSize(parseInt(e.target.value)||10)}} className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent px-2 py-1">
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <button disabled={usersPage<=1} onClick={()=>setUsersPage(p=>Math.max(1,p-1))} className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 disabled:opacity-50">Anterior</button>
                  <button disabled={usersPage*usersPageSize>=usersTotal} onClick={()=>setUsersPage(p=>p+1)} className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 disabled:opacity-50">Próxima</button>
                </div>
              </div>
              <CreateUserModal
                open={openCreate}
                onClose={()=>setOpenCreate(false)}
                data={createData}
                setData={setCreateData}
                onSubmit={onCreateUser}
                busy={creatingUser}
                error={createError}
              />
            </div>
          )}

          {tab === 'invites' && (
            <div className="space-y-6">
              {isSuper && (
              <form onSubmit={onInvite} className="glass rounded-xl p-4 space-y-3">
                <div className="grid sm:grid-cols-3 gap-2">
                  <input type="email" required value={form.email} onChange={(e)=>setForm((f)=>({...f,email:e.target.value}))} placeholder="E-mail para convite" className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 px-3 py-2.5 outline-none focus:ring-4 ring-sky-100 dark:ring-sky-900/30"/>
                  <select value={form.role} onChange={(e)=>setForm((f)=>({...f,role:e.target.value}))} className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 px-3 py-2.5">
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    <option value="gestor-plantoes">gestor-plantoes</option>
                  </select>
                  <button disabled={creating} className="rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-3 py-2.5">{creating? 'Enviando...' : 'Gerar convite'}</button>
                </div>
                {justCreatedInvite && (
                  <div className="text-sm text-neutral-700 dark:text-neutral-300">
                    Link do convite: 
                    <button type="button" onClick={()=>copyLink(justCreatedInvite)} className="ml-2 underline text-sky-600 dark:text-sky-400">copiar</button>
                  </div>
                )}
              </form>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-neutral-500">
                    <tr>
                      <th className="py-2">E-mail</th>
                      <th className="py-2">Papel</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((inv) => (
                      <tr key={inv.id} className="border-t border-neutral-200 dark:border-neutral-800">
                        <td className="py-2">{inv.email}</td>
                        <td className="py-2">{inv.role}</td>
                        <td className="py-2 capitalize">{inv.status}</td>
                        <td className="py-2">
                          <div className="inline-flex gap-2">
                            <button onClick={()=>copyLink(inv)} className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800">Copiar link</button>
                            <button disabled={inv.status!=='pending'} onClick={()=>onRevoke(inv)} className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 disabled:opacity-50">Revogar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400">
                <div>
                  {auditTotal === 0 ? '0 resultados' : `${(auditPage-1)*auditPageSize+1}-${Math.min(auditPage*auditPageSize, auditTotal)} de ${auditTotal}`}
                </div>
                <div className="inline-flex items-center gap-2">
                  <select value={auditPageSize} onChange={(e)=>{setAuditPage(1);setAuditPageSize(parseInt(e.target.value)||20)}} className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent px-2 py-1">
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <button disabled={auditPage<=1} onClick={()=>setAuditPage(p=>Math.max(1,p-1))} className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 disabled:opacity-50">Anterior</button>
                  <button disabled={auditPage*auditPageSize>=auditTotal} onClick={()=>setAuditPage(p=>p+1)} className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 disabled:opacity-50">Próxima</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'audit' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <input value={auditQ} onChange={(e)=>{setAuditPage(1);setAuditQ(e.target.value)}} placeholder="Buscar ator/alvo" className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 px-3 py-2.5"/>
                <select value={auditAction} onChange={(e)=>{setAuditPage(1);setAuditAction(e.target.value)}} className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/60 px-3 py-2.5">
                  <option value="all">todas ações</option>
                  <option value="profile:role:update">profile:role:update</option>
                  <option value="profile:status:update">profile:status:update</option>
                  <option value="profile:collaborator:link">profile:collaborator:link</option>
                  <option value="invite:create">invite:create</option>
                  <option value="invite:revoke">invite:revoke</option>
                  <option value="invite:accept">invite:accept</option>
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-neutral-500">
                    <tr>
                      <th className="py-2">Ação</th>
                      <th className="py-2">Ator</th>
                      <th className="py-2">Alvo</th>
                      <th className="py-2">Detalhes</th>
                      <th className="py-2">Quando</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-t border-neutral-200 dark:border-neutral-800">
                        <td className="py-2">{log.action}</td>
                        <td className="py-2">{log.actor_email || '-'}</td>
                        <td className="py-2">{log.target_email || '-'}</td>
                        <td className="py-2">{log.details?.to ? `to=${log.details.to}` : '-'}</td>
                        <td className="py-2">{new Date(log.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
