import { Home, Users, Settings, Calendar, BarChart, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.jsx'

export default function Sidebar({ open = false, onClose = () => {} }) {
  const { role } = useAuth()
  const canAdmin = role === 'admin' || role === 'super'
  const canGestor = role === 'gestor-plantoes'
  const isUser = role === 'user'
  const sections = [
    {
      title: null,
      items: [
        { to: '/', label: 'Início', icon: Home, show: true },
      ],
    },
    {
      title: 'Plantões',
      items: [
        { to: '/shifts', label: 'Calendário', icon: Calendar, show: canAdmin || canGestor || isUser },
        { to: '/shifts/dashboard', label: 'Dashboard', icon: BarChart, show: canAdmin || canGestor },
      ],
    },
    {
      title: 'Folha de Pagamento',
      items: [
        { to: '/payroll', label: 'Folha Mensal', icon: BarChart, show: canAdmin || canGestor || isUser },
        { to: '/payroll/vacations', label: 'Férias', icon: BarChart, show: canAdmin || canGestor || isUser },
      ],
    },
    {
      title: 'Configurações',
      items: [
        { to: '/users', label: 'Usuários', icon: Users, show: canAdmin },
        { to: '/collaborators', label: 'Colaboradores', icon: Users, show: canAdmin },
        { to: '/functions', label: 'Funções', icon: Settings, show: canAdmin },
        { to: '/shift-functions', label: 'Valores de Plantões', icon: Settings, show: canAdmin },
        { to: '/settings/payroll-entries', label: 'Lançamentos', icon: Settings, show: canAdmin },
        { to: '/logs', label: 'Logs', icon: BarChart, show: canAdmin },
      ],
    },
  ]
  return (
    <>
      {/* Desktop: Top navigation bar with hover dropdowns */}
      <nav className="hidden md:block border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="px-3 py-2 flex items-center gap-6">
          {sections.map((sec, idx) => {
            const items = sec.items.filter(i=>i.show)
            if (!sec.title) {
              return (
                <div key={idx} className="flex items-center gap-2">
                  {items.map(({ to, label, icon: Icon }) => (
                    <NavLink key={to} to={to} end className={({ isActive }) => `flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 ${isActive ? 'bg-neutral-100 dark:bg-neutral-800' : ''}`}>
                      <Icon className="size-4" />
                      <span className="text-sm font-medium">{label}</span>
                    </NavLink>
                  ))}
                </div>
              )
            }
            return (
              <div key={idx} className="relative group">
                <button className="px-3 py-1.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md">
                  {sec.title}
                </button>
                <div className="absolute left-0 mt-1 hidden group-hover:block z-40">
                  <div className="min-w-56 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-lg p-2">
                    <div className="flex flex-col">
                      {items.map(({ to, label, icon: Icon }) => (
                        <NavLink key={to} to={to} end className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 ${isActive ? 'bg-neutral-100 dark:bg-neutral-800' : ''}`}>
                          <Icon className="size-4" />
                          <span className="text-sm font-medium">{label}</span>
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <aside className="relative w-64 h-full bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Menu</div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Fechar menu">
                <X className="size-4" />
              </button>
            </div>
            <nav className="space-y-4">
              {sections.map((sec, idx) => (
                <div key={idx} className="space-y-1">
                  {sec.title && <div className="px-3 text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{sec.title}</div>}
                  {sec.items.filter(i=>i.show).map(({ to, label, icon: Icon }) => (
                    <NavLink onClick={onClose} key={to} to={to} end className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 ${isActive ? 'bg-neutral-100 dark:bg-neutral-800' : ''}`}>
                      <Icon className="size-4" />
                      <span className="text-sm font-medium">{label}</span>
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  )
}
