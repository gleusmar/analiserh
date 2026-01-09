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
        { to: '/shifts/dashboard', label: 'Por mês', icon: BarChart, show: canAdmin || canGestor || isUser },
      ],
    },
    {
      title: 'Folha de Pagamento',
      items: [
        { to: '/payroll', label: 'Folha Mensal', icon: BarChart, show: canAdmin || canGestor || isUser },
        { to: '/payroll/vacations', label: 'Férias', icon: BarChart, show: canAdmin || canGestor || isUser },
        { to: '/payroll/overtime', label: 'Horas Extras', icon: BarChart, show: canAdmin || canGestor },
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
      <nav className="hidden" />

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <aside className="relative w-64 h-full border-r p-3 bg-white text-neutral-900 border-neutral-200">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Menu</div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100" aria-label="Fechar menu">
                <X className="size-4" />
              </button>
            </div>
            <nav className="space-y-4">
              {sections.map((sec, idx) => (
                <div key={idx} className="space-y-1">
                  {sec.title && <div className="px-3 text-xs uppercase tracking-wide text-neutral-500">{sec.title}</div>}
                  {sec.items.filter(i=>i.show).map(({ to, label, icon: Icon }) => (
                    <NavLink
                      onClick={onClose}
                      key={to}
                      to={to}
                      end
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100 ${isActive ? 'bg-neutral-100' : ''}`
                      }
                    >
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
