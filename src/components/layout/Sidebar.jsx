import { Home, Users, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext.jsx'

export default function Sidebar() {
  const { role } = useAuth()
  const canAdmin = role === 'admin' || role === 'super'
  const items = [
    { to: '/', label: 'Início', icon: Home, show: true },
    { to: '/collaborators', label: 'Colaboradores', icon: Users, show: canAdmin },
    { to: '/functions', label: 'Funções', icon: Settings, show: canAdmin },
    { to: '/users', label: 'Usuários', icon: Users, show: canAdmin },
    { to: '/settings', label: 'Configurações', icon: Settings, show: canAdmin },
  ]
  return (
    <aside className="w-60 border-r border-neutral-200 dark:border-neutral-800 p-3 hidden md:block">
      <nav className="space-y-1">
        {items.filter(i=>i.show).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 ${isActive ? 'bg-neutral-100 dark:bg-neutral-800' : ''}`}>
            <Icon className="size-4" />
            <span className="text-sm font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
