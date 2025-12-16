import { useAuth } from '../../contexts/AuthContext.jsx'
import { useTheme } from '../../contexts/ThemeContext.jsx'
import { Moon, Sun, LogOut, Menu } from 'lucide-react'

export default function Header({ onToggleSidebar }) {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center gap-2">
        <button onClick={onToggleSidebar} className="md:hidden p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Abrir menu">
          <Menu className="size-5" />
        </button>
        <div className="font-semibold">Análise RH</div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Alternar tema">
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <div className="text-sm text-neutral-600 dark:text-neutral-300 hidden sm:block">{user?.email}</div>
        <button onClick={signOut} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Sair">
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  )
}
