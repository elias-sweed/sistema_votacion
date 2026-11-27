type ConfigErrorPageProps = {
  problemas: string[]
}

// Pantalla mostrada cuando faltan variables de entorno de Supabase.
// Evita que la app arranque con un cliente inválido y errores confusos.
export default function ConfigErrorPage({ problemas }: ConfigErrorPageProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(239,68,68,0.14),transparent_62%)]"
      />

      <div className="relative w-full max-w-lg rounded-2xl border border-red-400/25 bg-slate-950/80 p-6 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
        <h1 className="text-xl font-semibold text-white">Configuración incompleta</h1>
        <p className="mt-2 text-sm text-slate-400">
          La aplicación no puede conectarse a Supabase porque faltan variables de entorno.
        </p>

        <ul className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-red-200">
          {problemas.map((problema) => (
            <li key={problema} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>{problema}</span>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Define <code className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200">VITE_SUPABASE_URL</code> y{' '}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200">VITE_SUPABASE_ANON_KEY</code> en{' '}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-slate-200">webapp/.env</code> para desarrollo y en
          las variables de entorno del proyecto de Vercel para producción. Después vuelve a desplegar.
        </p>
      </div>
    </main>
  )
}
