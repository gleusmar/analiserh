export default function Hero() {
  return (
    <section className="section bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">Cuidando da sua saúde com tecnologia e precisão</h1>
          <p className="text-neutral-600">Exames laboratoriais com qualidade, resultados rápidos e equipe especializada. Atendimento humanizado para você e sua família.</p>
          <div className="flex gap-3">
            <a href="#exams" className="btn-primary">Conheça nossos exames</a>
            <a href="https://wa.me/556436615886?text=Olá!%20Gostaria%20de%20mais%20informa%C3%A7%C3%B5es." target="_blank" className="inline-flex items-center justify-center rounded-xl border border-brand text-brand px-4 py-2 font-medium hover:bg-emerald-50 transition">Fale conosco</a>
            <a href="https://web28.concentsistemas.com.br/ConcentWebCli1376/servlet/hlab8000" target="_blank" className="inline-flex items-center justify-center rounded-xl text-white px-4 py-2 font-medium bg-rose-500 hover:bg-rose-600 transition">Resultados</a>
          </div>
        </div>

      </div>
    </section>
  )
}