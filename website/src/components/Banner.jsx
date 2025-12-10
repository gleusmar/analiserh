import { useEffect, useMemo, useRef, useState } from 'react'

// Rotates all images found in src/assets/banners
// Supported: jpg, jpeg, png, webp, gif
export default function Banner({ intervalMs = 5000 }) {
  // Load all images from the folder as URLs at build time
  const localImages = useMemo(() => {
    // Vite will replace this with URLs for matching assets
    const mods = import.meta.glob('/src/assets/banners/*.{jpg,jpeg,png,webp,gif}', { eager: true, as: 'url' })
    const urls = Object.values(mods)
    return urls
      .filter(Boolean)
      .map(String)
      .sort((a, b) => a.localeCompare(b))
  }, [])

  // Fallback to remote images if folder is empty
  const fallback = [
    'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?q=80&w=1600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1581091014534-8987c1d647c1?q=80&w=1600&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1581594695181-99b6a53386f6?q=80&w=1600&auto=format&fit=crop',
  ]

  const images = localImages.length > 0 ? localImages : fallback
  const [index, setIndex] = useState(0)
  const timerRef = useRef(null)
  const count = images.length

  function next() { setIndex(i => (i + 1) % count) }
  function prev() { setIndex(i => (i - 1 + count) % count) }
  function go(i) { setIndex(i % count) }

  useEffect(() => {
    if (count <= 1) return
    timerRef.current = setInterval(next, Math.max(2500, intervalMs))
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, intervalMs])

  if (count === 0) return null

  return (
    <section className="relative">
      {/* 2880x6912 (h×l) => ratio 2880/6912 = 41.6667% */}
      <div className="relative w-full pb-[41.6667%] overflow-hidden">
        {images.map((src, i) => (
          <img
            key={src}
            src={src}
            alt={`Banner ${i+1}`}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-700 ${i===index ? 'opacity-100' : 'opacity-0'}`}
            loading={i===0? 'eager' : 'lazy'}
          />
        ))}
        {/* Gradient overlay for readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-black/10 to-transparent" />
        {/* Controls */}
        {count > 1 && (
          <div className="absolute inset-0 flex items-center justify-between px-2">
            <button aria-label="Anterior" onClick={prev} className="rounded-full bg-black/30 hover:bg-black/50 text-white p-2">‹</button>
            <button aria-label="Próximo" onClick={next} className="rounded-full bg-black/30 hover:bg-black/50 text-white p-2">›</button>
          </div>
        )}
        {/* Dots */}
        {count > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                aria-label={`Ir ao banner ${i+1}`}
                onClick={() => go(i)}
                className={`h-2 w-2 rounded-full ${i===index ? 'bg-white' : 'bg-white/50 hover:bg-white/80'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
