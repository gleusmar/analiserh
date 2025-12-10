export default function Exams() {
  const exams = [
    { name: 'Hemograma completo', img: 'https://images.unsplash.com/photo-1579154204601-01588f351e12?q=80&w=1470&auto=format&fit=crop' },
    { name: 'Glicemia e Colesterol', img: 'https://images.unsplash.com/photo-1581594695141-5c1a9405ecdd?q=80&w=1470&auto=format&fit=crop' },
    { name: 'Teste de COVID-19', img: 'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?q=80&w=1470&auto=format&fit=crop' },
    { name: 'Urina e Fezes', img: 'https://images.unsplash.com/photo-1582719478185-2f56f716cf1b?q=80&w=1470&auto=format&fit=crop' },
    { name: 'Função hepática e renal', img: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1460&auto=format&fit=crop' },
    { name: 'Hormônios (TSH, T4, etc.)', img: 'https://images.unsplash.com/photo-1582719478442-c0f4e48f4b5b?q=80&w=1470&auto=format&fit=crop' },
  ]
  return (
    <section id="exams" className="section">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-2xl sm:text-3xl font-semibold">Principais exames</h2>
        <p className="text-neutral-600 mt-2">Atendimento para rotina, check-ups e exames específicos. Consulte nossa lista completa.</p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 mt-8">
          {exams.map((ex) => (
            <div key={ex.name} className="rounded-2xl border border-neutral-200 overflow-hidden bg-white">
              <img src={ex.img} alt={ex.name} className="h-40 w-full object-cover" />
              <div className="p-4">
                <div className="font-medium">{ex.name}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
