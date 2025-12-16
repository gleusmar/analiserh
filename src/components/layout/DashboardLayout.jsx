import { useState } from 'react'
import Header from './Header.jsx'
import Sidebar from './Sidebar.jsx'

export default function DashboardLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <div className="min-h-screen flex flex-col">
      <Header onToggleSidebar={() => setMobileOpen(v => !v)} />
      {/* Top navigation bar (desktop) + Mobile drawer (controlled by open) */}
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main className="flex-1 p-4">{children}</main>
    </div>
  )
}
