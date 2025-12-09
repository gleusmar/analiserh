import { Home, Users, Settings, Calendar, BarChart } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.jsx'

export default function Sidebar() {
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
    <aside className="w-60 border-r border-neutral-200 dark:border-neutral-800 p-3 hidden md:block">
      <nav className="space-y-4">
        {sections.map((sec, idx) => (
          <div key={idx} className="space-y-1">
            {sec.title && <div className="px-3 text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{sec.title}</div>}
            {sec.items.filter(i=>i.show).map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 ${isActive ? 'bg-neutral-100 dark:bg-neutral-800' : ''}`}>
                <Icon className="size-4" />
                <span className="text-sm font-medium">{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
