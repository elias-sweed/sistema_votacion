import { useEffect, useState, useCallback } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeDeError } from '../../lib/supabaseErrors'
import { CLAVES_CACHE, guardarCache, leerCache } from '../../lib/panelCache'
import { useToast } from '../../components/ui/ToastProvider'
import { PadronSkeleton } from '../panel/PanelSkeletons'
import {
  estaActivoEnsayo,
  ensayoListarVotantes,
  ensayoAgregarVotante,
  ensayoContarVotantes,
  ensayoContarVotaron,
} from '../../lib/ensayoStore'

type Votante = {
  dni: string
  nombre: string
  grado: string | null
  seccion: string | null
  ha_votado: boolean
  creado_en: string
}

type Estadisticas = {
  total_votantes: number
  total_votaron: number
  total_pendientes: number
  participacion_pct: number
  por_mesa: Array<{
    mesa_id: string
    mesa_nombre: string
    total: number
    votaron: number
    pendientes: number
    participacion_pct: number
  }>
}

type ImportPreviewItem = {
  fila: number
  dni: string
  nombre: string
  grado: string | null
  seccion: string | null
  valido: boolean
  motivo: string | null
}

type ImportResult = {
  insertados: number
  duplicados: number
  errores: Array<{ fila: number; dni: string; nombre: string; error: string }>
  detalle: Array<{ dni: string; nombre: string; estado: string }>
}

type ListaCache = { votantes: Votante[]; totalCount: number }

// Solo letras (con tildes/ñ) y espacios simples entre palabras.
const NOMBRE_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/

export default function PadronPage() {
  const toast = useToast()
  // Estados principales
  const [listaInicial] = useState(() => leerCache<ListaCache>(CLAVES_CACHE.padronLista))
  const [cargando, setCargando] = useState(listaInicial === null)
  const [tieneDatos, setTieneDatos] = useState(listaInicial !== null)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  // Alta manual de votante
  const [nuevoDni, setNuevoDni] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoApellido, setNuevoApellido] = useState('')
  const [nuevoGrado, setNuevoGrado] = useState('')
  const [nuevaSeccion, setNuevaSeccion] = useState('')
  const [guardandoVotante, setGuardandoVotante] = useState(false)
  const [errorManual, setErrorManual] = useState<string | null>(null)
  const [exitoManual, setExitoManual] = useState<string | null>(null)

  // Datos
  const [votantes, setVotantes] = useState<Votante[]>(() => listaInicial?.votantes ?? [])
  const [totalCount, setTotalCount] = useState(() => listaInicial?.totalCount ?? 0)
  const [estadisticasInicial] = useState(() => leerCache<Estadisticas>(CLAVES_CACHE.padronEstadisticas))
  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(estadisticasInicial)

  // Opciones de grado y sección (solo referencia informativa del estudiante)
  const GRADOS = ['1°', '2°', '3°', '4°', '5°', '6°'] as const
  const SECCIONES = ['A', 'B', 'C', 'D', 'E', 'F'] as const

  // Filtros y paginación
  const [busqueda, setBusqueda] = useState('')
  const [soloPendientes, setSoloPendientes] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [pageSize] = useState(50)
  const totalPages = Math.ceil(totalCount / pageSize)

  // Importación
  const [importando, setImportando] = useState(false)
  const [pasoImportacion, setPasoImportacion] = useState<'archivo' | 'preview' | 'confirmar' | 'resultado'>('archivo')
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<ImportPreviewItem[]>([])
  const [previewValidos, setPreviewValidos] = useState(0)
  const [previewInvalidos, setPreviewInvalidos] = useState(0)
  const [resultadoImportacion, setResultadoImportacion] = useState<ImportResult | null>(null)

  // Cargar estadísticas
  const cargarEstadisticas = useCallback(async () => {
    if (estaActivoEnsayo()) {
      const total = ensayoContarVotantes()
      const votaron = ensayoContarVotaron()
      setEstadisticas({
        total_votantes: total,
        total_votaron: votaron,
        total_pendientes: total - votaron,
        participacion_pct: total > 0 ? Math.round((votaron / total) * 100 * 100) / 100 : 0,
        por_mesa: [],
      })
      return
    }

    const { data, error: err } = await supabase.rpc('obtener_estadisticas_padron')
    if (err) {
      console.error('Error cargando estadísticas:', err)
      setError(mensajeDeError(err, 'No se pudieron cargar las estadísticas del padrón.'))
      return
    }
    if (data?.[0]) {
      const est = data[0] as Estadisticas
      setEstadisticas(est)
      guardarCache(CLAVES_CACHE.padronEstadisticas, est)
    }
  }, [])

  // Cargar votantes con filtros
  const cargarVotantes = useCallback(async () => {
    setCargando(true)
    setError(null)

    if (estaActivoEnsayo()) {
      const { votantes: listaEnsayo, total } = ensayoListarVotantes({
        busqueda,
        soloPendientes,
        pagina,
        pageSize,
      })
      const lista: Votante[] = listaEnsayo.map((v) => ({
        dni: v.dni,
        nombre: v.nombre,
        grado: v.grado ?? null,
        seccion: v.seccion ?? null,
        ha_votado: v.ha_votado,
        creado_en: v.creado_en,
      }))
      setVotantes(lista)
      setTotalCount(total)
      setTieneDatos(true)
      setCargando(false)
      return
    }

    const vistaPorDefecto = !busqueda && !soloPendientes && pagina === 1
    const { data, error: err } = await supabase.rpc('listar_votantes', {
      p_busqueda: busqueda || null,
      p_solo_pendientes: soloPendientes,
      p_limit: pageSize,
      p_offset: (pagina - 1) * pageSize
    })
    setCargando(false)
    if (err) { setError(mensajeDeError(err, 'No se pudo cargar el padrón.')); return }
    if (data) {
      const lista: Votante[] = data.map((v: any) => ({
        dni: v.dni,
        nombre: v.nombre,
        grado: v.grado ?? null,
        seccion: v.seccion ?? null,
        ha_votado: v.ha_votado,
        creado_en: v.creado_en,
      }))
      const total = data[0]?.total_count ?? 0
      setVotantes(lista)
      setTotalCount(total)
      setTieneDatos(true)
      if (vistaPorDefecto) {
        guardarCache(CLAVES_CACHE.padronLista, { votantes: lista, totalCount: total })
      }
    }
  }, [busqueda, soloPendientes, pagina, pageSize])

  useEffect(() => {
    cargarEstadisticas()
  }, [cargarEstadisticas])

  useEffect(() => {
    cargarVotantes()
  }, [cargarVotantes])

  // --- ALTA MANUAL ---

  async function agregarVotanteManual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorManual(null)
    setExitoManual(null)

    const dni = nuevoDni.trim()
    const nombre = nuevoNombre.trim().replace(/\s+/g, ' ')
    const apellido = nuevoApellido.trim().replace(/\s+/g, ' ')

    if (!/^[0-9]{8}$/.test(dni)) {
      setErrorManual('El DNI debe tener exactamente 8 dígitos numéricos.')
      return
    }
    if (nombre.length < 2 || !NOMBRE_REGEX.test(nombre)) {
      setErrorManual('El nombre debe tener al menos 2 letras (solo letras y espacios).')
      return
    }
    if (apellido.length < 2 || !NOMBRE_REGEX.test(apellido)) {
      setErrorManual('El apellido debe tener al menos 2 letras (solo letras y espacios).')
      return
    }

    setGuardandoVotante(true)

    if (estaActivoEnsayo()) {
      ensayoAgregarVotante({
        dni,
        nombre: `${nombre} ${apellido}`,
        grado: nuevoGrado || null,
        seccion: nuevaSeccion || null,
        ha_votado: false,
      })
      setGuardandoVotante(false)
      setExitoManual(`Votante ${dni} agregado correctamente (modo ensayo).`)
      toast({
        title: 'Votante agregado (ensayo)',
        description: `${nombre} ${apellido} · DNI ${dni}`,
        variant: 'success',
        duration: 4000,
      })
      setNuevoDni('')
      setNuevoNombre('')
      setNuevoApellido('')
      setNuevoGrado('')
      setNuevaSeccion('')
      await cargarVotantes()
      await cargarEstadisticas()
      return
    }

    const { error: err } = await supabase.from('votantes').insert({
      dni,
      nombre: `${nombre} ${apellido}`,
      grado: nuevoGrado || null,
      seccion: nuevaSeccion || null
    })
    setGuardandoVotante(false)

    if (err) {
      if (err.code === '23505') {
        setErrorManual(`El DNI ${dni} ya está registrado en el padrón.`)
      } else if (err.code === '23514') {
        setErrorManual('El DNI debe tener exactamente 8 dígitos numéricos.')
      } else if (err.code === '23502') {
        setErrorManual('Falta un dato obligatorio (DNI o nombre).')
      } else {
        setErrorManual(mensajeDeError(err, 'No se pudo agregar al votante.'))
      }
      return
    }

    setExitoManual(`Votante ${dni} agregado correctamente.`)
    toast({
      title: 'Votante agregado',
      description: `${nombre} ${apellido} · DNI ${dni} ${nuevoGrado ? `· ${nuevoGrado} ${nuevaSeccion}` : ''}`.trim(),
      variant: 'success',
      duration: 4000
    })
    setNuevoDni('')
    setNuevoNombre('')
    setNuevoApellido('')
    setNuevoGrado('')
    setNuevaSeccion('')
    await cargarVotantes()
    await cargarEstadisticas()
  }

  // --- IMPORTACIÓN ---

  function manejarArchivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.match(/\.csv$/i)) {
      setError('Solo se permiten archivos CSV (.csv)')
      return
    }
    setArchivoSeleccionado(file)
    setError(null)
    setExito(null)
    setPasoImportacion('preview')
    procesarPreview(file)
  }

  async function procesarPreview(file: File) {
    setImportando(true)
    setError(null)
    try {
      const rows = await parseFile(file)
      if (rows.length === 0) {
        setError('El archivo está vacío o no tiene datos válidos.')
        setImportando(false)
        return
      }
      const { data, error: err } = await supabase.rpc('validar_importacion_votantes', {
        p_votantes: rows
      })
      if (err) throw err
      const result = data?.[0]
      if (result) {
        setPreviewData(result.preview ?? [])
        setPreviewValidos(result.validos ?? 0)
        setPreviewInvalidos(result.invalidos ?? 0)
      }
    } catch (e: any) {
      setError('Error al validar archivo: ' + (e.message || 'Error desconocido'))
    } finally {
      setImportando(false)
    }
  }

  async function confirmarImportacion() {
    if (!archivoSeleccionado) return
    setImportando(true)
    setError(null)
    try {
      const rows = await parseFile(archivoSeleccionado)
      const { data, error: err } = await supabase.rpc('importar_votantes', {
        p_votantes: rows
      })
      if (err) throw err
      const result = data?.[0]
      if (result) {
        setResultadoImportacion({
          insertados: result.insertados ?? 0,
          duplicados: result.duplicados ?? 0,
          errores: result.errores ?? [],
          detalle: result.detalle ?? []
        })
        setPasoImportacion('resultado')
        await cargarVotantes()
        await cargarEstadisticas()
        const totalErrores = result.errores?.length ?? 0
        setExito(`Importación completada: ${result.insertados} insertados, ${result.duplicados} duplicados, ${totalErrores} errores.`)
        toast({
          title: 'Importación completada',
          description: `${result.insertados} insertados · ${result.duplicados} duplicados · ${totalErrores} errores`,
          variant: totalErrores > 0 ? 'info' : 'success',
          duration: 5000
        })
      }
    } catch (e: any) {
      const mensaje = 'Error al importar: ' + (e.message || 'Error desconocido')
      setError(mensaje)
      toast({
        title: 'No se pudo importar',
        description: e.message || 'Error desconocido',
        variant: 'error',
        duration: 7000
      })
    } finally {
      setImportando(false)
    }
  }

  function reiniciarImportacion() {
    setArchivoSeleccionado(null)
    setPreviewData([])
    setPreviewValidos(0)
    setPreviewInvalidos(0)
    setResultadoImportacion(null)
    setPasoImportacion('archivo')
    ;(document.getElementById('file-input') as HTMLInputElement).value = ''
  }

  // Helpers para parsing de archivos
  async function parseFile(file: File): Promise<any[]> {
    const text = await file.text()
    if (file.name.endsWith('.csv')) {
      return parseCSV(text)
    }
    // Para Excel necesitaríamos una librería como xlsx
    // Por ahora solo CSV nativo; Excel se puede agregar con librería
    throw new Error('Formato Excel no soportado aún. Use CSV.')
  }

  function parseCSV(text: string): any[] {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const dniIdx = headers.indexOf('dni')
    const nombreIdx = headers.indexOf('nombre')
    const gradoIdx = headers.indexOf('grado')
    const seccionIdx = headers.indexOf('seccion')
    if (dniIdx === -1 || nombreIdx === -1) {
      throw new Error('CSV debe tener columnas: dni, nombre (opcional: grado, seccion)')
    }
    const rows: any[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim())
      if (cols.length < 2) continue
      rows.push({
        dni: cols[dniIdx],
        nombre: cols[nombreIdx],
        grado: gradoIdx >= 0 ? cols[gradoIdx] : null,
        seccion: seccionIdx >= 0 ? cols[seccionIdx] : null
      })
    }
    return rows
  }

  // --- RENDER ---

  if (cargando && !tieneDatos) {
    return <PadronSkeleton />
  }

  return (
    <section className="space-y-6">
      {/* Header con estadísticas */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-gradient-to-r from-blue-400/80 to-transparent" />
          <h2 className="text-xl font-bold text-white">Padrón Electoral</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl shadow-[0_20px_60px_-44px_rgba(0,0,0,0.95)]">
            <p className="text-slate-400">Total</p>
            <p className="text-2xl font-bold text-white">{estadisticas?.total_votantes ?? 0}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl shadow-[0_20px_60px_-44px_rgba(0,0,0,0.95)]">
            <p className="text-slate-400">Votaron</p>
            <p className="text-2xl font-bold text-emerald-400">{estadisticas?.total_votaron ?? 0}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl shadow-[0_20px_60px_-44px_rgba(0,0,0,0.95)]">
            <p className="text-slate-400">Pendientes</p>
            <p className="text-2xl font-bold text-sky-300">{estadisticas?.total_pendientes ?? 0}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl shadow-[0_20px_60px_-44px_rgba(0,0,0,0.95)]">
            <p className="text-slate-400">Participación</p>
            <p className="text-2xl font-bold text-blue-300">{estadisticas?.participacion_pct ?? 0}%</p>
          </div>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 space-y-4 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.95)] backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">Buscar por DNI o nombre</label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
              placeholder="Buscar…"
              className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md placeholder:text-slate-500 transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 self-end">
            <input
              type="checkbox"
              checked={soloPendientes}
              onChange={(e) => { setSoloPendientes(e.target.checked); setPagina(1); }}
              className="rounded border-white/20 bg-black/25 text-blue-300 focus:ring-blue-500/40"
            />
            Solo pendientes
          </label>
        </div>
      </div>

      {/* Alta manual de votante */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 space-y-4 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.95)] backdrop-blur-xl">
        <div>
          <h3 className="text-lg font-semibold text-white">Agregar votante manualmente</h3>
          <p className="text-sm text-slate-400">
            DNI de 8 dígitos, nombre y apellido. Grado y sección son solo referencia del estudiante; la mesa se elige al abrir el enlace del salón.
          </p>
        </div>

        <form onSubmit={agregarVotanteManual} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs text-slate-400">DNI</label>
              <span className={`text-[11px] ${nuevoDni.length === 8 ? 'text-emerald-400' : 'text-slate-500'}`}>
                {nuevoDni.length}/8
              </span>
            </div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              value={nuevoDni}
              onChange={(e) => setNuevoDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="12345678"
              className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 font-mono text-white backdrop-blur-md placeholder:text-slate-500 transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Nombre</label>
            <input
              type="text"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Nombres"
              className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md placeholder:text-slate-500 transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Apellido</label>
            <input
              type="text"
              value={nuevoApellido}
              onChange={(e) => setNuevoApellido(e.target.value)}
              placeholder="Apellidos"
              className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md placeholder:text-slate-500 transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Grado</label>
            <select
              value={nuevoGrado}
              onChange={(e) => setNuevoGrado(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            >
              <option value="">Grado</option>
              {GRADOS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Sección</label>
            <select
              value={nuevaSeccion}
              onChange={(e) => setNuevaSeccion(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            >
              <option value="">Sección</option>
              {SECCIONES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col justify-end">
            <button
              type="submit"
              disabled={guardandoVotante}
              className="w-full rounded-xl bg-gradient-to-r from-blue-400 via-sky-400 to-blue-600 px-4 py-2.5 font-bold text-white shadow-[0_10px_30px_-12px_rgba(37,99,235,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {guardandoVotante ? 'Agregando…' : 'Agregar votante'}
            </button>
          </div>
        </form>

        {errorManual && <p className="text-sm text-red-400">{errorManual}</p>}
        {exitoManual && <p className="text-sm text-emerald-400">{exitoManual}</p>}
      </div>

      {/* Importación */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 space-y-4 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.95)] backdrop-blur-xl">
        <h3 className="text-lg font-semibold text-white">Importar Padrón (CSV)</h3>

        {pasoImportacion === 'archivo' && (
          <div>
            <p className="text-sm text-slate-400 mb-3">
              Formato CSV requerido: columnas <code className="text-blue-300">dni,nombre</code>. Opcional:
              <code className="text-blue-300">grado,seccion</code>. El archivo debe tener encabezados. Máx. recomendado: 500 filas.
            </p>
            <input
              id="file-input"
              type="file"
              accept=".csv"
              onChange={manejarArchivo}
              className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-500 file:text-white file:font-semibold hover:file:bg-blue-400"
            />
          </div>
        )}

        {pasoImportacion === 'preview' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm">
                <span className="text-emerald-400 font-medium">{previewValidos} válidos</span>
                {' '}·{' '}
                <span className="text-red-400 font-medium">{previewInvalidos} con errores</span>
                {' '}·{' '}
                <span className="text-slate-400">{previewData.length} filas totales</span>
              </p>
            </div>
            <div className="max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/25 backdrop-blur-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white/[0.05] backdrop-blur-xl">
                  <tr className="text-left text-xs text-slate-400 uppercase">
                    <th className="p-2">Fila</th>
                    <th className="p-2">DNI</th>
                    <th className="p-2">Nombre</th>
                    <th className="p-2">Grado</th>
                    <th className="p-2">Sección</th>
                    <th className="p-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {previewData.slice(0, 100).map((item, idx) => (
                    <tr key={idx} className={item.valido ? '' : 'bg-red-900/20'}>
                      <td className="p-2 text-slate-400">{item.fila}</td>
                      <td className="p-2 font-mono">{item.dni}</td>
                      <td className="p-2">{item.nombre}</td>
                      <td className="p-2 text-slate-300">{item.grado ?? '-'}</td>
                      <td className="p-2 text-slate-300">{item.seccion ?? '-'}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${item.valido ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                          {item.valido ? '✓ Válido' : item.motivo}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {previewData.length > 100 && (
                    <tr>
                      <td colSpan={6} className="p-2 text-center text-slate-500">
                        … y {previewData.length - 100} filas más
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button onClick={confirmarImportacion} disabled={importando || previewValidos === 0}
                className="rounded-xl bg-gradient-to-r from-blue-400 via-sky-400 to-blue-600 px-4 py-2 font-bold text-white shadow-[0_10px_30px_-12px_rgba(37,99,235,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
                {importando ? 'Importando…' : 'Confirmar importación'}
              </button>
              <button onClick={reiniciarImportacion} disabled={importando}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-white backdrop-blur-md transition hover:bg-white/[0.1] disabled:opacity-50">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {pasoImportacion === 'resultado' && resultadoImportacion && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-emerald-400">✓ Insertados: <strong>{resultadoImportacion.insertados}</strong></span>
              <span className="text-sky-300">⟳ Duplicados: <strong>{resultadoImportacion.duplicados}</strong></span>
              <span className="text-red-400">✗ Errores: <strong>{resultadoImportacion.errores.length}</strong></span>
            </div>
            {resultadoImportacion.errores.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-lg bg-red-900/20 border border-red-800 p-3">
                <p className="text-xs text-red-300 mb-2">Errores detallados:</p>
                <ul className="text-xs text-red-200 space-y-1">
                  {resultadoImportacion.errores.slice(0, 20).map((e, i) => (
                    <li key={i}>Fila {e.fila} (DNI {e.dni}): {e.error}</li>
                  ))}
                  {resultadoImportacion.errores.length > 20 && (
                    <li>… y {resultadoImportacion.errores.length - 20} errores más</li>
                  )}
                </ul>
              </div>
            )}
            <button onClick={reiniciarImportacion}
              className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-white backdrop-blur-md transition hover:bg-white/[0.1]">
              Nueva importación
            </button>
          </div>
        )}
      </div>

      {/* Tabla de votantes */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-[0_24px_80px_-48px_rgba(0,0,0,0.95)] backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/30 text-left text-xs text-slate-400 uppercase backdrop-blur-xl">
              <tr>
                <th className="p-3">DNI</th>
                <th className="p-3">Nombre</th>
                <th className="p-3">Grado</th>
                <th className="p-3">Sección</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Registrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {votantes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No hay votantes que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                votantes.map((v) => (
                  <tr key={v.dni} className={v.ha_votado ? 'bg-emerald-900/10' : ''}>
                    <td className="p-3 font-mono text-sky-300">{v.dni}</td>
                    <td className="p-3">{v.nombre}</td>
                    <td className="p-3 text-slate-300">{v.grado ?? '-'}</td>
                    <td className="p-3 text-slate-300">{v.seccion ?? '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${v.ha_votado ? 'bg-emerald-900/30 text-emerald-400' : 'bg-blue-900/30 text-blue-300'}`}>
                        {v.ha_votado ? 'Votó' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 text-xs">
                      {new Date(v.creado_en).toLocaleDateString('es-PE')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between text-sm text-slate-300">
            <span>Página {pagina} de {totalPages} · Total: {totalCount}</span>
            <div className="flex gap-2">
              <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
                className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1 backdrop-blur-md transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50">
                Anterior
              </button>
              <button onClick={() => setPagina(p => Math.min(totalPages, p + 1))} disabled={pagina >= totalPages}
                className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1 backdrop-blur-md transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50">
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {exito && <p className="text-emerald-400 text-sm">{exito}</p>}
    </section>
  )
}