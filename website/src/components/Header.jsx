export default function Header() {
  const internalUrl = import.meta.env.VITE_INTERNAL_APP_URL || 'http://localhost:5173/'
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2">
          <img src="/logoanalise.png" alt="Logo" className="h-12" />
        </a>
        <nav className="hidden sm:flex items-center gap-6 text-lg text-neutral-700">
          {/*<a href="#exams" className="hover:text-brand">Exames</a>
          <a href="#gallery" className="hover:text-brand">Galeria</a>*/}
          <a href="https://wa.me/556436615886?text=Olá!%20Gostaria%20de%20mais%20informa%C3%A7%C3%B5es." className="hover:text-brand">Contato</a>
        </nav>
        <div className="flex items-center gap-2">
          <a href="https://web28.concentsistemas.com.br/ConcentWebCli1376/servlet/hlab8000" target="_blank" className="inline-flex items-center justify-center rounded-xl text-white px-4 py-2 font-medium bg-rose-500 hover:bg-rose-600 transition">Resultados</a>
          <a href={internalUrl} className="btn-primary">Área Interna</a>
        </div>
      </div>
    </header>
  )
}
