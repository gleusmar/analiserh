import { useAuth } from '../../contexts/AuthContext.jsx'
import { LogOut, Menu } from 'lucide-react'
import { NavLink } from 'react-router-dom'

export default function Header({ onToggleSidebar }) {
  const { user, role, profile, signOut } = useAuth()

  const canAdmin = role === 'admin' || role === 'super'
  const canGestor = role === 'gestor-plantoes'
  const isUser = role === 'user'
  const canSulamerica = !!profile?.can_access_sulamerica
  const isSulamericaHost = typeof window !== 'undefined' && window.location.hostname === 'sulamerica.analiselabclinico.com.br'
  const rhBaseUrl = 'https://rh.analiselabclinico.com.br'

  const sections = [
    {
      title: null,
      items: [
        { to: '/', label: 'Início', show: true },
      ],
    },
    {
      title: 'Plantões',
      items: [
        { to: '/shifts', label: 'Calendário', show: canAdmin || canGestor || isUser },
        { to: '/shifts/dashboard', label: 'Por mês', show: canAdmin || canGestor || isUser },
      ],
    },
    {
      title: 'Folha',
      items: [
        { to: '/payroll', label: 'Folha Mensal', show: canAdmin || canGestor || isUser },
        { to: '/payroll/vacations', label: 'Férias', show: canAdmin || canGestor || isUser },
        { to: '/payroll/overtime', label: 'Horas Extras', show: canAdmin || canGestor || isUser },
        { to: '/payroll/income-reports', label: 'Informe de Rendimentos', show: canAdmin || canGestor || isUser },
      ],
    },
    {
      title: null,
      items: [
        { to: '/sulamerica', label: 'Sulamérica', show: canSulamerica, variant: 'sulamerica' },
      ],
    },
    {
      title: 'Configuração',
      items: [
        { to: '/users', label: 'Usuários', show: canAdmin },
        { to: '/collaborators', label: 'Colaboradores', show: canAdmin },
        { to: '/functions', label: 'Funções', show: canAdmin },
        { to: '/shift-functions', label: 'Valores de Plantões', show: canAdmin },
        { to: '/settings/payroll-entries', label: 'Lançamentos', show: canAdmin },
        { to: '/logs', label: 'Logs', show: canAdmin },
      ],
    },
  ]
  return (
    <header className="sticky top-0 z-50 h-14 flex items-center px-4 border-b bg-white text-neutral-900 border-neutral-200">
      <div className="flex items-center gap-2 flex-1">
        <button onClick={onToggleSidebar} className="md:hidden p-2 rounded-lg hover:bg-neutral-100" aria-label="Abrir menu">
          <Menu className="size-5" />
        </button>
        {isSulamericaHost ? (
          <a href={`${rhBaseUrl}/`} className="flex items-center gap-2 hover:opacity-80">
            <div><img alt="Meu Análise" className="w-8 h-8 rounded-md" src="/ico.png" /></div>
            <div className="font-semibold text-sm md:text-base">Meu Análise</div>
          </a>
        ) : (
          <NavLink to="/" className="flex items-center gap-2 hover:opacity-80">
            <div><img alt="Meu Análise" className="w-8 h-8 rounded-md" src="/ico.png" /></div>
            <div className="font-semibold text-sm md:text-base">Meu Análise</div>
          </NavLink>
        )}
      </div>

      {/* Navegação principal (desktop) centralizada */}
      <nav className="hidden md:flex flex-1 items-center justify-center gap-6 text-xs md:text-sm">
        {sections.map((sec, idx) => {
          const items = sec.items.filter(i => i.show)
          if (!items.length) return null
          if (!sec.title) {
            return (
              <div key={idx} className="flex items-center gap-2">
                {items.map(({ to, label, variant }) => {
                  if (variant === 'sulamerica') {
                    return (
                      <a
                        key={to}
                        href="https://sulamerica.analiselabclinico.com.br"
                        className="px-2 py-1 rounded-md text-orange-500 hover:bg-neutral-100 hover:text-orange-600"
                      >
                        {label}
                      </a>
                    )
                  }
                  if (isSulamericaHost) {
                    return (
                      <a
                        key={to}
                        href={`${rhBaseUrl}${to}`}
                        className="px-2 py-1 rounded-md hover:bg-neutral-100 text-neutral-700"
                      >
                        {label}
                      </a>
                    )
                  }
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      end
                      className={({ isActive }) => {
                        const base = 'px-2 py-1 rounded-md hover:bg-neutral-100'
                        const activeBg = isActive ? ' bg-neutral-100 font-semibold' : ''
                        const color = isActive ? ' text-neutral-900' : ' text-neutral-700'
                        return base + activeBg + color
                      }}
                    >
                      {label}
                    </NavLink>
                  )
                })}
              </div>
            )
          }
          return (
            <div key={idx} className="relative group">
              <button className="px-2 py-1 text-xs md:text-sm font-semibold rounded-md text-neutral-700 hover:bg-neutral-100">
                {sec.title}
              </button>
              <div className="absolute left-1/2 -translate-x-1/2 top-full hidden group-hover:block z-40">
                <div className="min-w-48 rounded-md border shadow-lg p-2 bg-white text-neutral-900 border-neutral-200">
                  <div className="flex flex-col">
                    {items.map(({ to, label }) => (
                      isSulamericaHost ? (
                        <a
                          key={to}
                          href={`${rhBaseUrl}${to}`}
                          className="px-3 py-1.5 rounded-md text-xs md:text-sm hover:bg-neutral-100 text-neutral-700"
                        >
                          {label}
                        </a>
                      ) : (
                        <NavLink
                          key={to}
                          to={to}
                          end
                          className={({ isActive }) =>
                            `px-3 py-1.5 rounded-md text-xs md:text-sm hover:bg-neutral-100 ${isActive ? 'bg-neutral-100 text-neutral-900 font-semibold' : 'text-neutral-700'}`
                          }
                        >
                          {label}
                        </NavLink>
                      )
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      <div className="flex items-center gap-2 flex-1 justify-end">
        <div className="text-xs md:text-sm hidden sm:block text-neutral-600 truncate max-w-[180px]">
          {user?.email}
        </div>
        <button onClick={signOut} className="p-2 rounded-lg hover:bg-neutral-100" aria-label="Sair">
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  )
}
