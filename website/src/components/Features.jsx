export default function Features() {
  const items = [
    { title: 'Coleta domiciliar', desc: 'Comodidade e segurança na coleta de exames em sua casa.' },
    { title: 'Resultados rápidos', desc: 'Laudos com agilidade, disponíveis também online.' },
    { title: 'Equipe qualificada', desc: 'Profissionais experientes e atendimento humanizado.' },
  ]
  return (
    <section className="section">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-6">
          {items.map((it, idx) => (
            <div key={idx} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6">
              <h3 className="font-semibold text-lg text-brand">{it.title}</h3>
              <p className="text-neutral-700 mt-1">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
