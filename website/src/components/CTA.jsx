export default function CTA() {
  return (
    <section className="section bg-emerald-600">
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-white">
          <h3 className="text-2xl font-semibold">Agende sua coleta ou tire suas dúvidas</h3>
          <p className="text-emerald-100">Fale com nossa equipe e receba orientações sobre preparo de exames.</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://wa.me/556436615886?text=Olá!%20Gostaria%20de%20mais%20informa%C3%A7%C3%B5es." target="_blank" className="inline-flex items-center justify-center rounded-xl bg-white text-emerald-700 px-4 py-2 font-medium hover:bg-emerald-50 transition">Fale conosco</a>
          {/* <a href="#exams" className="inline-flex items-center justify-center rounded-xl border border-white text-white px-4 py-2 font-medium hover:bg-emerald-500 transition">Ver exames</a>
          */}
        </div>
      </div>
    </section>
  )
}
