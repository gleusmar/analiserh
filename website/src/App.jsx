import Header from './components/Header.jsx'
import Banner from './components/Banner.jsx'
import Hero from './components/Hero.jsx'
import Features from './components/Features.jsx'
import Exams from './components/Exams.jsx'
import Gallery from './components/Gallery.jsx'
import CTA from './components/CTA.jsx'
import Footer from './components/Footer.jsx'

export default function App() {
  return (
    <div className="min-h-dvh flex flex-col">
      <Header />
      <Banner />
      <main className="flex-1">
        <Hero />
        <Features />
        {/*
        <Exams />
        <Gallery />
        */}
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
