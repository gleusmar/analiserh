import { useAuth } from '../../contexts/AuthContext.jsx'
import { LogOut, Menu } from 'lucide-react'

export default function Header({ onToggleSidebar }) {
  const { user, signOut } = useAuth()
  return (
    <header className="sticky top-0 z-50 h-14 flex items-center justify-between px-4 border-b bg-white text-neutral-900 border-neutral-200">
      <div className="flex items-center gap-2">
        <button onClick={onToggleSidebar} className="md:hidden p-2 rounded-lg hover:bg-neutral-100" aria-label="Abrir menu">
          <Menu className="size-5" />
        </button>
        <div className="font-semibold">Análise RH</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-sm hidden sm:block text-neutral-600">{user?.email}</div>
        <button onClick={signOut} className="p-2 rounded-lg hover:bg-neutral-100" aria-label="Sair">
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  )
}
