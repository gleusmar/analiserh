export default function Footer() {
  return (
    <footer id="contato" className="border-t border-neutral-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 py-12 grid md:grid-cols-4 gap-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Laboratório Análise</span>
          </div>
          <p className="text-neutral-600 text-sm">Excelência em exames laboratoriais com tecnologia e cuidado humano.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-2">Contato</h4>
          <ul className="text-sm space-y-1 text-neutral-700">
            <li><a className="hover:text-brand" href="tel:+556436615886">(64) 3661-5886</a></li>
            <li><a className="hover:text-brand" href="mailto:contato@analiselabclinico.com.br">contato@analiselabclinico.com.br</a></li>
            <li>Rua 15 esquina com Rua 10, nº 40, Centro</li>
            <li>Mineiros/GO</li>
            <li><a className="hover:text-brand" target="_blank" rel="noreferrer" href="https://maps.google.com/?q=Av.%20Exemplo%2C%20123">Ver no mapa</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-2">Atendimento</h4>
          <ul className="text-sm space-y-1 text-neutral-700">
            <li>Seg a Sex: 7h às 17h</li>
            <li>Sábado: 7h às 11h</li>
            <li>Coleta domiciliar sob agendamento</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-2">Localização</h4>
          <iframe
            src="https://www.google.com/maps/embed/v1/place?q=laboratorio%20analise%20mineiros%20goias&key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8"
            width="100%"
            height="200"
            style={{ border: 0 }}
            allowfullscreen loading="lazy"
          ></iframe>
          
        </div>
      </div>
      <div className="border-t border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 py-4 text-xs text-neutral-500 flex items-center justify-between">
          <span>© {new Date().getFullYear()} Laboratório Análise. Todos os direitos reservados.</span>
          <a className="hover:text-brand" href="#">Voltar ao topo</a>
        </div>
      </div>
    </footer>
  )
}
