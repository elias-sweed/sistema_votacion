import { Skeleton } from '../../components/ui/Skeleton'

export function DashboardSkeleton() {
  return (
    <div className="space-y-3.5" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Cargando resumen general…</span>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-[354px] rounded-[22px] sm:col-span-2" />
        <Skeleton className="h-[170px] rounded-[22px]" />
        <Skeleton className="h-[170px] rounded-[22px]" />
        <Skeleton className="h-[170px] rounded-[22px] sm:col-span-2" />
        <Skeleton className="h-[170px] rounded-[22px]" />
        <Skeleton className="h-[170px] rounded-[22px]" />
        <Skeleton className="h-[170px] rounded-[22px] sm:col-span-2" />
      </div>
    </div>
  )
}

export function CandidatosSkeleton() {
  return (
    <ul
      className="grid gap-8 justify-items-center sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Cargando candidatos…</span>
      {[0, 1, 2].map((i) => (
        <li key={i}>
          <Skeleton className="h-[300px] w-[240px] rounded-2xl" />
        </li>
      ))}
    </ul>
  )
}

export function MesasSkeleton() {
  return (
    <div
      className="divide-y divide-white/10 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Cargando mesas…</span>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between px-5 py-3">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PadronSkeleton() {
  return (
    <section className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Cargando padrón electoral…</span>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Skeleton className="h-6 w-44" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl"
            >
              <Skeleton className="h-3 w-14" />
              <Skeleton className="mt-2 h-7 w-10" />
            </div>
          ))}
        </div>
      </div>

      <Skeleton className="h-[104px] rounded-3xl" />

      <div className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
        <Skeleton className="h-5 w-56" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-[42px]" />
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-white/10 px-4 py-4 last:border-0"
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </section>
  )
}
