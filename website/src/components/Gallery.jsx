export default function Gallery() {
  const imgs = [
    'https://images.unsplash.com/photo-1581594695181-99b6a53386f6?q=80&w=1460&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1581091870622-7b85bfc08a05?q=80&w=1460&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1579154204511-c48f85703fef?q=80&w=1460&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1460&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1584036561584-b03c19da874c?q=80&w=1460&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1582719478185-2f56f716cf1b?q=80&w=1470&auto=format&fit=crop'
  ]
  return (
    <section id="gallery" className="section bg-emerald-50/40">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-2xl sm:text-3xl font-semibold">Estrutura e tecnologia</h2>
        <p className="text-neutral-600 mt-2">Conheça um pouco do nosso laboratório e equipamentos.</p>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mt-8">
          {imgs.map((src, i) => (
            <img key={i} src={src} alt={`Laboratório ${i+1}`} className="h-48 w-full object-cover rounded-xl border border-neutral-200" />
          ))}
        </div>
      </div>
    </section>
  )
}
