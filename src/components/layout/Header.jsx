import { useAuth } from '../../contexts/AuthContext.jsx'
import { useTheme } from '../../contexts/ThemeContext.jsx'
import { Moon, Sun, LogOut, Menu } from 'lucide-react'

export default function Header({ onToggleSidebar }) {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <header className={`sticky top-0 z-50 h-14 flex items-center justify-between px-4 border-b ${isDark ? 'bg-neutral-900 text-neutral-100 border-neutral-800' : 'bg-white text-neutral-900 border-neutral-200'}`}>
      <div className="flex items-center gap-2">
        <button onClick={onToggleSidebar} className={`md:hidden p-2 rounded-lg ${isDark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'}`} aria-label="Abrir menu">
          <Menu className="size-5" />
        </button>
        <div className="font-semibold">Análise RH</div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={toggleTheme} className={`p-2 rounded-lg ${isDark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'}`} aria-label="Alternar tema">
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <div className={`text-sm hidden sm:block ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>{user?.email}</div>
        <button onClick={signOut} className={`p-2 rounded-lg ${isDark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'}`} aria-label="Sair">
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  )
}
