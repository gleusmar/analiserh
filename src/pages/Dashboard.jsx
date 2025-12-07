export default function Dashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Bem-vindo ao Sistema de RH</h1>
      <p className="text-neutral-600 dark:text-neutral-400">Esta é a página inicial após o login. O menu lateral será usado para navegar entre as seções.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4">
          <div className="text-sm text-neutral-500">Atalhos</div>
          <div className="mt-2 text-neutral-800 dark:text-neutral-200">Crie usuários, gerencie cargos, configure integrações.</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-sm text-neutral-500">Status</div>
          <div className="mt-2 text-neutral-800 dark:text-neutral-200">Tudo funcionando normalmente.</div>
        </div>
        <div className="glass rounded-xl p-4">
          <div className="text-sm text-neutral-500">Próximos passos</div>
          <div className="mt-2 text-neutral-800 dark:text-neutral-200">Implementar páginas internas e funcionalidades.</div>
        </div>
      </div>
    </div>
  )
}
