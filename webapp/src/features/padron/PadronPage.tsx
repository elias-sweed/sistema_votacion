import { useEffect, useState, useCallback, useRef } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { HugeiconsIcon } from '@hugeicons/react'
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon'
import Download01Icon from '@hugeicons/core-free-icons/Download01Icon'
import File01Icon from '@hugeicons/core-free-icons/File01Icon'
import FileAddIcon from '@hugeicons/core-free-icons/FileAddIcon'
import IdCardIcon from '@hugeicons/core-free-icons/IdCardIcon'
import Search01Icon from '@hugeicons/core-free-icons/Search01Icon'
import UserAdd01Icon from '@hugeicons/core-free-icons/UserAdd01Icon'
import { supabase } from '../../lib/supabase'
import { mensajeDeError } from '../../lib/supabaseErrors'
import { CLAVES_CACHE, guardarCache, leerCache } from '../../lib/panelCache'
import { dividirEnLotes, leerFilasPadron } from '../../lib/importarPadron'
import { generarPlantillaCSV, generarPlantillaXlsx } from '../../lib/exportarPlantilla'
import {
  detectarColumnasPadron,
  importarLotePadron,
  insertarVotantePadron,
  listarVotantes
} from '../../lib/padronCompat'
import { useToast } from '../../components/ui/ToastProvider'
import { PadronSkeleton } from '../panel/PanelSkeletons'
import { AdminCard } from '../../components/ui/AdminCard'
import { AdminButton } from '../../components/ui/AdminButton'
import { AdminModal } from '../../components/ui/AdminModal'
import { EmptyState } from '../../components/ui/EmptyState'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { StatCard } from '../../components/ui/StatCard'
import { RevealSection } from '../../components/ui/RevealSection'

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

type PadronVista = 'agregar' | 'excel' | 'lista'

const VISTAS_PADRON: Array<{ valor: PadronVista; etiqueta: string; icon: typeof IdCardIcon }> = [
  { valor: 'agregar', etiqueta: 'Agregar', icon: UserAdd01Icon },
  { valor: 'excel', etiqueta: 'Excel', icon: FileAddIcon },
  { valor: 'lista', etiqueta: 'Ver padrón', icon: IdCardIcon }
]

// Solo letras (con tildes/ñ) y espacios simples entre palabras.
const NOMBRE_REGEX = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$/

const CLASE_SELECT =
  'w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15'

export default function PadronPage() {
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()

  // Cada pantalla del padrón tiene su propia ruta: /admin/padron/agregar,
  // /admin/padron/excel y /admin/padron/lista. Así el dock puede abrir
  // directamente la que el usuario elija.
  const segmentoPadron = location.pathname.split('/').filter(Boolean)[2]
  const subvista: PadronVista =
    segmentoPadron === 'excel' || segmentoPadron === 'lista' ? segmentoPadron : 'agregar'

  const irAPantalla = (destino: PadronVista) => {
    navigate(`/admin/padron/${destino}`)
  }

  // Estados principales
  const [listaInicial] = useState(() => leerCache<ListaCache>(CLAVES_CACHE.padronLista))
  const [cargando, setCargando] = useState(listaInicial === null)
  const [tieneDatos, setTieneDatos] = useState(listaInicial !== null)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  // Alta manual de votante
  const [nuevoDni, setNuevoDni] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoApellidoPaterno, setNuevoApellidoPaterno] = useState('')
  const [nuevoApellidoMaterno, setNuevoApellidoMaterno] = useState('')
  const [nuevoGrado, setNuevoGrado] = useState('')
  const [nuevaSeccion, setNuevaSeccion] = useState('')
  const [guardandoVotante, setGuardandoVotante] = useState(false)
  const [errorManual, setErrorManual] = useState<string | null>(null)
  const [exitoManual, setExitoManual] = useState<string | null>(null)
  const [sinGradoSeccion, setSinGradoSeccion] = useState(false)
  const [enfocarDni, setEnfocarDni] = useState(false)

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

  // Acciones masivas y exportación (se declaran antes de los derivados que las usan)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [passwordEliminar, setPasswordEliminar] = useState('')
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)
  const [eliminandoVotantes, setEliminandoVotantes] = useState(false)
  const [exportando, setExportando] = useState(false)
  const seleccionarTodosRef = useRef<HTMLInputElement>(null)

  // Selección de la página actual. Solo se pueden eliminar votantes pendientes,
  // porque borrar a alguien que ya votó permitiría emitir un segundo voto.
  const pendientesPagina = votantes.filter((v) => !v.ha_votado)
  const todosSeleccionados = pendientesPagina.length > 0 && pendientesPagina.every((v) => seleccionados.has(v.dni))
  const algunosSeleccionados = pendientesPagina.some((v) => seleccionados.has(v.dni)) && !todosSeleccionados

  useEffect(() => {
    if (seleccionarTodosRef.current) {
      seleccionarTodosRef.current.indeterminate = algunosSeleccionados
    }
  }, [algunosSeleccionados])

  useEffect(() => {
    setSeleccionados(new Set())
  }, [busqueda, soloPendientes, pagina])

  // Importación
  const [importando, setImportando] = useState(false)
  const [pasoImportacion, setPasoImportacion] = useState<'archivo' | 'preview' | 'confirmar' | 'resultado'>('archivo')
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<ImportPreviewItem[]>([])
  const [previewValidos, setPreviewValidos] = useState(0)
  const [previewInvalidos, setPreviewInvalidos] = useState(0)
  const [resultadoImportacion, setResultadoImportacion] = useState<ImportResult | null>(null)
  const [arrastrandoArchivo, setArrastrandoArchivo] = useState(false)
  const [filtroPreview, setFiltroPreview] = useState<'todas' | 'validas' | 'con-errores'>('todas')

  const filasPreview = previewData.filter((item) => {
    if (filtroPreview === 'validas') return item.valido
    if (filtroPreview === 'con-errores') return !item.valido
    return true
  })

  // Cargar estadísticas
  const cargarEstadisticas = useCallback(async () => {
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

  // Cargar votantes con filtros (funciona con o sin columnas grado/sección)
  const cargarVotantes = useCallback(async () => {
    setCargando(true)
    setError(null)

    const vistaPorDefecto = !busqueda && !soloPendientes && pagina === 1
    const { filas, total, error: err } = await listarVotantes({
      busqueda,
      soloPendientes,
      limit: pageSize,
      offset: (pagina - 1) * pageSize
    })
    setCargando(false)
    if (err) { setError(mensajeDeError(err, 'No se pudo cargar el padrón.')); return }

    const lista: Votante[] = filas.map((v) => ({
      dni: v.dni,
      nombre: v.nombre,
      grado: v.grado ?? null,
      seccion: v.seccion ?? null,
      ha_votado: v.ha_votado,
      creado_en: v.creado_en
    }))
    setVotantes(lista)
    setTotalCount(total)
    setTieneDatos(true)
    if (vistaPorDefecto) {
      guardarCache(CLAVES_CACHE.padronLista, { votantes: lista, totalCount: total })
    }
  }, [busqueda, soloPendientes, pagina, pageSize])

  useEffect(() => {
    cargarEstadisticas()
  }, [cargarEstadisticas])

  useEffect(() => {
    cargarVotantes()
  }, [cargarVotantes])

  useEffect(() => {
    void detectarColumnasPadron().then((completa) => setSinGradoSeccion(!completa))
  }, [])

  useEffect(() => {
    if (subvista !== 'agregar' || !enfocarDni) return
    document.getElementById('padron-dni')?.focus()
    setEnfocarDni(false)
  }, [subvista, enfocarDni])

  // --- ALTA MANUAL ---

  async function agregarVotanteManual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorManual(null)
    setExitoManual(null)

    const dni = nuevoDni.trim()
    const nombres = nuevoNombre.trim().replace(/\s+/g, ' ')
    const apellidoPaterno = nuevoApellidoPaterno.trim().replace(/\s+/g, ' ')
    const apellidoMaterno = nuevoApellidoMaterno.trim().replace(/\s+/g, ' ')

    if (!/^[0-9]{8}$/.test(dni)) {
      setErrorManual('El DNI debe tener exactamente 8 dígitos numéricos.')
      return
    }
    if (nombres.length < 2 || !NOMBRE_REGEX.test(nombres)) {
      setErrorManual('Los nombres deben tener al menos 2 letras (solo letras y espacios).')
      return
    }
    if (apellidoPaterno && (apellidoPaterno.length < 2 || !NOMBRE_REGEX.test(apellidoPaterno))) {
      setErrorManual('El apellido paterno solo debe tener letras y espacios.')
      return
    }
    if (apellidoMaterno && (apellidoMaterno.length < 2 || !NOMBRE_REGEX.test(apellidoMaterno))) {
      setErrorManual('El apellido materno solo debe tener letras y espacios.')
      return
    }
    if (!apellidoPaterno && !apellidoMaterno) {
      setErrorManual('Ingresa al menos un apellido (paterno o materno).')
      return
    }

    const nombreCompleto = [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ')
    setGuardandoVotante(true)

    const { error: err } = await insertarVotantePadron({
      dni,
      nombre: nombreCompleto,
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
      description: `${nombreCompleto} · DNI ${dni} ${nuevoGrado ? `· ${nuevoGrado} ${nuevaSeccion}` : ''}`.trim(),
      variant: 'success',
      duration: 4000
    })
    setNuevoDni('')
    setNuevoNombre('')
    setNuevoApellidoPaterno('')
    setNuevoApellidoMaterno('')
    setNuevoGrado('')
    setNuevaSeccion('')
    await cargarVotantes()
    await cargarEstadisticas()
  }

  // --- IMPORTACIÓN ---

  function procesarArchivoSeleccionado(file: File | null) {
    if (!file) return
    if (!file.name.match(/\.(csv|xlsx|xlsm)$/i)) {
      setError('Solo se permiten archivos Excel (.xlsx) o CSV (.csv)')
      return
    }
    setArchivoSeleccionado(file)
    setError(null)
    setExito(null)
    setFiltroPreview('todas')
    setPasoImportacion('preview')
    void procesarPreview(file)
  }

  function manejarArchivo(e: ChangeEvent<HTMLInputElement>) {
    procesarArchivoSeleccionado(e.target.files?.[0] ?? null)
  }

  function soltarArchivo(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setArrastrandoArchivo(false)
    procesarArchivoSeleccionado(e.dataTransfer.files?.[0] ?? null)
  }

  async function procesarPreview(file: File) {
    setImportando(true)
    setError(null)
    try {
      const rows = await leerFilasPadron(file)
      if (rows.length === 0) {
        setError('El archivo está vacío o no tiene datos válidos.')
        setImportando(false)
        return
      }

      const preview: ImportPreviewItem[] = []
      let validos = 0
      let invalidos = 0
      let filaInicial = 1

      for (const lote of dividirEnLotes(rows)) {
        const { data, error: err } = await supabase.rpc('validar_importacion_votantes', {
          p_votantes: lote
        })
        if (err) throw err
        const resultado = data?.[0]
        validos += resultado?.validos ?? 0
        invalidos += resultado?.invalidos ?? 0
        for (const item of resultado?.preview ?? []) {
          preview.push({ ...item, fila: (item.fila ?? 0) + filaInicial - 1 })
        }
        filaInicial += lote.length
      }

      setPreviewData(preview)
      setPreviewValidos(validos)
      setPreviewInvalidos(invalidos)
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
      const rows = await leerFilasPadron(archivoSeleccionado)
      const resultado: ImportResult = { insertados: 0, duplicados: 0, errores: [], detalle: [] }

      for (const lote of dividirEnLotes(rows)) {
        const parcial = await importarLotePadron(lote)
        resultado.insertados += parcial.insertados
        resultado.duplicados += parcial.duplicados
        resultado.errores.push(...parcial.errores)
        resultado.detalle.push(...parcial.detalle)
      }

      setResultadoImportacion(resultado)
      setPasoImportacion('resultado')
      await cargarVotantes()
      await cargarEstadisticas()
      const totalErrores = resultado.errores.length
      setExito(`Importación completada: ${resultado.insertados} insertados, ${resultado.duplicados} duplicados, ${totalErrores} errores.`)
      toast({
        title: 'Importación completada',
        description: `${resultado.insertados} insertados · ${resultado.duplicados} duplicados · ${totalErrores} errores`,
        variant: totalErrores > 0 ? 'info' : 'success',
        duration: 5000
      })
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
    setFiltroPreview('todas')
    setResultadoImportacion(null)
    setPasoImportacion('archivo')
    const input = document.getElementById('file-input') as HTMLInputElement | null
    if (input) input.value = ''
  }

  // --- SELECCIÓN, ELIMINACIÓN MASIVA Y EXPORTACIÓN ---

  function alternarSeleccion(dni: string) {
    setSeleccionados((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(dni)) siguiente.delete(dni)
      else siguiente.add(dni)
      return siguiente
    })
  }

  function alternarTodos() {
    setSeleccionados((prev) => {
      const siguiente = new Set(prev)
      if (todosSeleccionados) {
        pendientesPagina.forEach((v) => siguiente.delete(v.dni))
      } else {
        pendientesPagina.forEach((v) => siguiente.add(v.dni))
      }
      return siguiente
    })
  }

  function pedirEliminarSeleccionados(dnis?: string[]) {
    if (dnis && dnis.length > 0) setSeleccionados(new Set(dnis))
    setPasswordEliminar('')
    setErrorEliminar(null)
    setConfirmandoEliminar(true)
  }

  function cerrarEliminar() {
    if (eliminandoVotantes) return
    setConfirmandoEliminar(false)
    setPasswordEliminar('')
    setErrorEliminar(null)
  }

  async function eliminarSeleccionados() {
    if (eliminandoVotantes) return

    const dnis = Array.from(seleccionados).filter((dni) => {
      const votante = votantes.find((v) => v.dni === dni)
      return votante ? !votante.ha_votado : false
    })

    if (dnis.length === 0) {
      setErrorEliminar('No hay votantes pendientes seleccionados.')
      return
    }
    if (!passwordEliminar) {
      setErrorEliminar('Escribe tu contraseña para confirmar.')
      return
    }

    setErrorEliminar(null)
    setEliminandoVotantes(true)
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      const email = userData.user?.email
      if (userError || !email) {
        setErrorEliminar('No se pudo comprobar tu cuenta.')
        return
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: passwordEliminar
      })
      if (authError) {
        setErrorEliminar('Contraseña incorrecta.')
        return
      }

      const { error: err } = await supabase.from('votantes').delete().in('dni', dnis)
      if (err) {
        setErrorEliminar(mensajeDeError(err, 'No se pudieron eliminar los votantes.'))
        return
      }

      toast({
        title: 'Votantes eliminados',
        description: `${dnis.length} ${dnis.length === 1 ? 'votante eliminado' : 'votantes eliminados'} del padrón.`,
        variant: 'success',
        duration: 4000
      })
      setConfirmandoEliminar(false)
      setPasswordEliminar('')
      setSeleccionados(new Set())

      const restantes = Math.max(0, totalCount - dnis.length)
      const ultimaPagina = Math.max(1, Math.ceil(restantes / pageSize))
      if (pagina > ultimaPagina) {
        setPagina(ultimaPagina)
      } else {
        await cargarVotantes()
      }
      await cargarEstadisticas()
    } finally {
      setEliminandoVotantes(false)
    }
  }

  function descargarPlantilla(tipo: 'xlsx' | 'csv') {
    const blob = tipo === 'xlsx' ? generarPlantillaXlsx() : generarPlantillaCSV()
    const nombre = `plantilla-padron.${tipo}`
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = nombre
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
    URL.revokeObjectURL(url)

    toast({
      title: 'Plantilla descargada',
      description: `${nombre} · complétala y súbela en esta misma pantalla.`,
      variant: 'success',
      duration: 4000
    })
  }

  async function exportarCSV() {
    if (exportando) return
    setExportando(true)
    try {
      const filas: Votante[] = []

      const tamano = 200
      let offset = 0
      let total = Number.POSITIVE_INFINITY

      while (offset < total) {
        const { filas: lista, total: totalRemoto, error: err } = await listarVotantes({
          busqueda,
          soloPendientes,
          limit: tamano,
          offset
        })
        if (err) throw err
        if (lista.length === 0) break
        total = totalRemoto
        for (const fila of lista) {
          filas.push({
            dni: fila.dni,
            nombre: fila.nombre,
            grado: fila.grado ? String(fila.grado) : null,
            seccion: fila.seccion ? String(fila.seccion) : null,
            ha_votado: fila.ha_votado === true,
            creado_en: String(fila.creado_en ?? '')
          })
        }
        offset += tamano
      }

      if (filas.length === 0) {
        toast({
          title: 'Nada que exportar',
          description: 'No hay votantes que coincidan con los filtros actuales.',
          variant: 'info',
          duration: 3500
        })
        return
      }

      const encabezado = ['dni', 'nombre', 'grado', 'seccion', 'ha_votado', 'creado_en']
      const escapar = (valor: unknown) => {
        const texto = String(valor ?? '')
        return /[",\n;]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
      }
      const lineas = [
        encabezado.join(','),
        ...filas.map((v) => [
          v.dni,
          v.nombre,
          v.grado ?? '',
          v.seccion ?? '',
          v.ha_votado ? 'SI' : 'NO',
          v.creado_en
        ].map(escapar).join(','))
      ]

      // BOM para que Excel reconozca los acentos al abrir el CSV.
      const blob = new Blob(['\uFEFF' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = `padron-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      URL.revokeObjectURL(url)

      toast({
        title: 'Padrón exportado',
        description: `${filas.length} votantes incluidos en el CSV.`,
        variant: 'success',
        duration: 4000
      })
    } catch (e) {
      toast({
        title: 'No se pudo exportar',
        description: e instanceof Error ? e.message : 'Error desconocido al generar el CSV.',
        variant: 'error',
        duration: 6000
      })
    } finally {
      setExportando(false)
    }
  }


  if (cargando && !tieneDatos && subvista === 'lista') {
    return <PadronSkeleton />
  }

  return (
    <RevealSection className="space-y-6">
      {/* Encabezado con las tres pantallas del padrón */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="h-px w-8 bg-linear-to-r from-blue-400/80 to-transparent" />
          <h2 className="text-xl font-bold text-white">Padrón Electoral</h2>
        </div>
        <div
          role="tablist"
          aria-label="Pantallas del padrón"
          className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-1 backdrop-blur-xl"
        >
          {VISTAS_PADRON.map(({ valor, etiqueta, icon }) => {
            const activa = subvista === valor
            return (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => irAPantalla(valor)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                  activa
                    ? 'bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <HugeiconsIcon icon={icon} size={16} strokeWidth={1.8} />
                {etiqueta}
              </button>
            )
          })}
        </div>
      </div>

      {subvista !== 'lista' && sinGradoSeccion && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100" role="status">
          <p className="font-semibold">La base de datos aún no tiene las columnas Grado y Sección.</p>
          <p className="mt-1 text-amber-200/80">
            El padrón funciona con DNI y nombre. Aplica el archivo{' '}
            <code className="rounded bg-black/25 px-1.5 py-0.5">017_reparar_padron_grado_seccion.sql</code>{' '}
            en el editor SQL de Supabase para guardar también esos campos.
          </p>
        </div>
      )}

      <div key={subvista} className="seccion-entrada space-y-6">
        {subvista === 'agregar' && (
          <>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/10 text-blue-200">
                <HugeiconsIcon icon={UserAdd01Icon} size={18} strokeWidth={1.8} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-white">Agregar una persona</h3>
                <p className="text-xs text-slate-400">Para sumar o corregir un votante suelto, sin usar el Excel.</p>
              </div>
            </div>

            <AdminCard>
        <div className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-white">Agregar votante</h3>
            <p className="text-xs text-slate-400">
              DNI de 8 dígitos, nombres, apellido paterno y apellido materno. Grado y sección son referencia del estudiante.
            </p>
          </div>

          <form onSubmit={agregarVotanteManual} className="space-y-4">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Mismos campos que la plantilla
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label htmlFor="padron-grado" className="mb-1 block text-xs text-slate-400">Grado</label>
                  <select
                    id="padron-grado"
                    value={nuevoGrado}
                    onChange={(e) => setNuevoGrado(e.target.value)}
                    className={CLASE_SELECT}
                  >
                    <option value="">Grado</option>
                    {GRADOS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="padron-seccion" className="mb-1 block text-xs text-slate-400">Sección</label>
                  <select
                    id="padron-seccion"
                    value={nuevaSeccion}
                    onChange={(e) => setNuevaSeccion(e.target.value)}
                    className={CLASE_SELECT}
                  >
                    <option value="">Sección</option>
                    {SECCIONES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label htmlFor="padron-dni" className="text-xs text-slate-400">DNI</label>
                    <span className={`text-[11px] tabular-nums ${nuevoDni.length === 8 ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {nuevoDni.length}/8
                    </span>
                  </div>
                  <input
                    id="padron-dni"
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
                  <label htmlFor="padron-apellido-paterno" className="mb-1 block text-xs text-slate-400">Apellido Paterno</label>
                  <input
                    id="padron-apellido-paterno"
                    type="text"
                    value={nuevoApellidoPaterno}
                    onChange={(e) => setNuevoApellidoPaterno(e.target.value)}
                    placeholder="Apellido Paterno"
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md placeholder:text-slate-500 transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>
                <div>
                  <label htmlFor="padron-apellido-materno" className="mb-1 block text-xs text-slate-400">Apellido Materno</label>
                  <input
                    id="padron-apellido-materno"
                    type="text"
                    value={nuevoApellidoMaterno}
                    onChange={(e) => setNuevoApellidoMaterno(e.target.value)}
                    placeholder="Apellido Materno"
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md placeholder:text-slate-500 transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>
                <div>
                  <label htmlFor="padron-nombre" className="mb-1 block text-xs text-slate-400">Nombres</label>
                  <input
                    id="padron-nombre"
                    type="text"
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    placeholder="Nombres"
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md placeholder:text-slate-500 transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Grado y sección son opcionales. El apellido materno también puede quedar vacío.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                {errorManual && <p className="text-sm text-red-400">{errorManual}</p>}
                {exitoManual && <p className="text-sm text-emerald-400">{exitoManual}</p>}
              </div>
              <button
                type="submit"
                disabled={guardandoVotante}
                className="rounded-xl bg-linear-to-r from-blue-400 via-sky-400 to-blue-600 px-6 py-2.5 font-bold text-white shadow-[0_10px_30px_-12px_rgba(37,99,235,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {guardandoVotante ? 'Agregando…' : 'Agregar votante'}
              </button>
            </div>
          </form>
        </div>
            </AdminCard>
          </>
        )}

        {subvista === 'excel' && (
          <>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/10 text-blue-200">
                <HugeiconsIcon icon={FileAddIcon} size={18} strokeWidth={1.8} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-white">Padrón desde Excel</h3>
                <p className="text-xs text-slate-400">Descarga la plantilla, revísala y corrige las filas con datos faltantes antes de importar.</p>
              </div>
            </div>

            <AdminCard>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Importar padrón (Excel o CSV)</h3>

          {/* Stepper visual */}
          <ol className="flex items-center gap-2" aria-label="Pasos de la importación">
            {['Archivo', 'Validación', 'Resultado'].map((etiqueta, indice) => {
              const numero = indice + 1
              const pasoActual = pasoImportacion === 'archivo' ? 1 : pasoImportacion === 'resultado' ? 3 : 2
              const completado = numero < pasoActual
              const activo = numero === pasoActual
              return (
                <li key={etiqueta} className="flex flex-1 items-center gap-2 last:flex-none">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition ${
                      activo
                        ? 'border-blue-400/50 bg-blue-500/20 text-blue-100'
                        : completado
                          ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                          : 'border-white/10 bg-white/4 text-slate-500'
                    }`}
                  >
                    {completado ? '✓' : numero}
                  </span>
                  <span className={`text-xs font-medium ${
                    activo ? 'text-white' : completado ? 'text-emerald-200' : 'text-slate-500'
                  }`}>
                    {etiqueta}
                  </span>
                  {numero < 3 && (
                    <span className={`h-px flex-1 ${completado ? 'bg-emerald-400/30' : 'bg-white/10'}`} />
                  )}
                </li>
              )
            })}
          </ol>

          {pasoImportacion === 'archivo' && (
            <div>
              <p className="mb-3 text-sm text-slate-400">
                Columnas esperadas: <code className="text-blue-300">grado | sección | DNI | Apellido Paterno | Apellido Materno | Nombres</code>.
                Se aceptan <strong className="text-slate-300">.xlsx</strong> y <strong className="text-slate-300">.csv</strong> con encabezados;
                el orden de las columnas no importa. Grado y sección son opcionales.
              </p>

              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="mr-auto text-xs text-slate-400">
                  <p className="font-semibold text-slate-300">Descarga la plantilla, complétala y súbela aquí.</p>
                  <p>1) Descargar · 2) Llenar con los datos · 3) Elegir el archivo terminado</p>
                </div>
                <AdminButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => descargarPlantilla('xlsx')}
                  className="inline-flex items-center gap-2"
                >
                  <HugeiconsIcon icon={Download01Icon} size={15} strokeWidth={1.8} />
                  Descargar plantilla Excel
                </AdminButton>
                <AdminButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => descargarPlantilla('csv')}
                  className="inline-flex items-center gap-2"
                >
                  <HugeiconsIcon icon={Download01Icon} size={15} strokeWidth={1.8} />
                  Plantilla CSV
                </AdminButton>
              </div>
              <label
                htmlFor="file-input"
                onDragEnter={(e) => { e.preventDefault(); setArrastrandoArchivo(true) }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={(e) => {
                  const siguiente = e.relatedTarget as Node | null
                  if (!siguiente || !e.currentTarget.contains(siguiente)) setArrastrandoArchivo(false)
                }}
                onDrop={soltarArchivo}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center transition ${
                  arrastrandoArchivo
                    ? 'border-blue-400/70 bg-blue-500/10'
                    : 'border-white/15 bg-black/20 hover:border-blue-300/40 hover:bg-white/4'
                }`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300">
                  <HugeiconsIcon icon={File01Icon} size={20} strokeWidth={1.7} />
                </span>
                <span className="text-sm font-medium text-white">
                  {arrastrandoArchivo ? 'Suelta el archivo aquí' : 'Arrastra tu Excel o CSV aquí, o selecciona un archivo'}
                </span>
                <span className="text-xs text-slate-500">Archivos .xlsx o .csv</span>
                <input
                  id="file-input"
                  type="file"
                  accept=".xlsx,.xlsm,.csv"
                  onChange={manejarArchivo}
                  className="sr-only"
                />
              </label>
            </div>
          )}

        {pasoImportacion === 'preview' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-sm">
                <span className="text-emerald-400 font-medium">{previewValidos} válidos</span>
                {' '}·{' '}
                <span className="text-red-400 font-medium">{previewInvalidos} con datos faltantes o inválidos</span>
                {' '}·{' '}
                <span className="text-slate-400">{previewData.length} filas totales</span>
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar filas del archivo">
                {([
                  ['todas', `Todas (${previewData.length})`],
                  ['validas', `Válidas (${previewValidos})`],
                  ['con-errores', `Datos faltantes (${previewInvalidos})`]
                ] as const).map(([valor, etiqueta]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setFiltroPreview(valor)}
                    aria-pressed={filtroPreview === valor}
                    className={`rounded-lg border px-3 py-1 text-xs font-medium transition ${
                      filtroPreview === valor
                        ? 'border-blue-400/50 bg-blue-500/15 text-blue-100'
                        : 'border-white/10 bg-white/4 text-slate-400 hover:text-white'
                    }`}
                  >
                    {etiqueta}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/25 backdrop-blur-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white/5 backdrop-blur-xl">
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
                  {filasPreview.slice(0, 100).map((item, idx) => (
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
                  {filasPreview.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-500">
                        No hay filas con este filtro.
                      </td>
                    </tr>
                  )}
                  {filasPreview.length > 100 && (
                    <tr>
                      <td colSpan={6} className="p-2 text-center text-slate-500">
                        … y {filasPreview.length - 100} filas más
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button onClick={confirmarImportacion} disabled={importando || previewValidos === 0}
                className="rounded-xl bg-linear-to-r from-blue-400 via-sky-400 to-blue-600 px-4 py-2 font-bold text-white shadow-[0_10px_30px_-12px_rgba(37,99,235,0.7)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
                {importando ? 'Importando…' : 'Confirmar importación'}
              </button>
              <button onClick={reiniciarImportacion} disabled={importando}
                className="rounded-xl border border-white/10 bg-white/6 px-4 py-2 text-white backdrop-blur-md transition hover:bg-white/10 disabled:opacity-50">
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
              className="rounded-xl border border-white/10 bg-white/6 px-4 py-2 text-white backdrop-blur-md transition hover:bg-white/10">
              Nueva importación
            </button>
          </div>
        )}
        </div>
            </AdminCard>
          </>
        )}

        {subvista === 'lista' && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-live="polite">
              <StatCard label="Total" value={estadisticas?.total_votantes ?? 0} />
              <StatCard
                label="Votaron"
                value={estadisticas?.total_votaron ?? 0}
                valueClassName="text-emerald-300"
              />
              <StatCard
                label="Pendientes"
                value={estadisticas?.total_pendientes ?? 0}
                valueClassName="text-sky-300"
              />
              <StatCard
                label="Participación"
                value={`${estadisticas?.participacion_pct ?? 0}%`}
                valueClassName="text-blue-300"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/10 text-blue-200">
                <HugeiconsIcon icon={IdCardIcon} size={18} strokeWidth={1.8} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-white">Padrón cargado</h3>
                <p className="text-xs text-slate-400">Busca, revisa quién falta votar y exporta la lista filtrada.</p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/4 p-5 space-y-3 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.95)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label htmlFor="padron-busqueda" className="mb-1 block text-xs text-slate-400">
              Buscar por DNI o nombre
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <HugeiconsIcon icon={Search01Icon} size={17} strokeWidth={1.8} />
              </span>
              <input
                id="padron-busqueda"
                data-busqueda-padron
                type="text"
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setPagina(1) }}
                placeholder="Buscar por DNI o nombre… ( / )"
                className="w-full rounded-xl border border-white/10 bg-black/25 py-2.5 pl-11 pr-4 text-white backdrop-blur-md placeholder:text-slate-500 transition focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300 lg:pb-2.5">
            <input
              type="checkbox"
              checked={soloPendientes}
              onChange={(e) => { setSoloPendientes(e.target.checked); setPagina(1) }}
              className="h-4 w-4 rounded border-white/20 bg-black/25 text-blue-400 focus:ring-blue-500/40"
            />
            Solo pendientes
          </label>

          <AdminButton
            variant="secondary"
            size="sm"
            onClick={() => void exportarCSV()}
            disabled={exportando || totalCount === 0}
            className="inline-flex items-center gap-2 lg:mb-0.5"
          >
            <HugeiconsIcon icon={Download01Icon} size={15} strokeWidth={1.8} />
            {exportando ? 'Exportando…' : 'Exportar CSV'}
          </AdminButton>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>Mostrando {votantes.length} de {totalCount} votantes</span>
          <span>Página {pagina} de {Math.max(1, totalPages)}</span>
        </div>
      </div>

      {/* Barra de acciones masivas */}
      {seleccionados.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-400/30 bg-blue-500/10 px-4 py-3">
          <p className="text-sm text-blue-100">
            <strong>{seleccionados.size}</strong>{' '}
            {seleccionados.size === 1 ? 'votante seleccionado' : 'votantes seleccionados'}
          </p>
          <div className="flex flex-wrap gap-2">
            <AdminButton variant="ghost" size="sm" onClick={() => setSeleccionados(new Set())}>
              Limpiar selección
            </AdminButton>
            <AdminButton
              variant="danger"
              size="sm"
              onClick={() => pedirEliminarSeleccionados()}
              className="inline-flex items-center gap-2"
            >
              <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.8} />
              Eliminar seleccionados
            </AdminButton>
          </div>
        </div>
      )}

      {/* Tabla de votantes */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/4 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.95)] backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/30 text-left text-xs text-slate-400 uppercase backdrop-blur-xl">
              <tr>
                <th className="w-10 p-3">
                  <input
                    ref={seleccionarTodosRef}
                    type="checkbox"
                    checked={todosSeleccionados}
                    onChange={alternarTodos}
                    disabled={pendientesPagina.length === 0}
                    aria-label="Seleccionar votantes pendientes de esta página"
                    className="h-4 w-4 rounded border-white/20 bg-black/25 text-blue-400 focus:ring-blue-500/40 disabled:opacity-40"
                  />
                </th>
                <th className="p-3">DNI</th>
                <th className="p-3">Nombre</th>
                <th className="p-3">Grado</th>
                <th className="p-3">Sección</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Registrado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {votantes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4">
                    {totalCount === 0 && !busqueda && !soloPendientes ? (
                      <EmptyState
                        icon={<HugeiconsIcon icon={IdCardIcon} size={22} strokeWidth={1.7} />}
                        title="El padrón está vacío"
                        description="Importa un archivo Excel o CSV, o agrega votantes manualmente para empezar."
                        action={
                          <div className="flex flex-wrap justify-center gap-2">
                            <AdminButton
                              size="sm"
                              onClick={() => {
                                setEnfocarDni(true)
                                irAPantalla('agregar')
                              }}
                            >
                              Agregar votante
                            </AdminButton>
                            <AdminButton
                              size="sm"
                              variant="secondary"
                              onClick={() => irAPantalla('excel')}
                            >
                              Importar Excel o CSV
                            </AdminButton>
                          </div>
                        }
                      />
                    ) : (
                      <p className="py-8 text-center text-slate-500">
                        No hay votantes que coincidan con los filtros.
                      </p>
                    )}
                  </td>
                </tr>
              ) : (
                votantes.map((v) => (
                  <tr
                    key={v.dni}
                    className={`transition hover:bg-white/3 ${v.ha_votado ? 'bg-emerald-900/10' : ''}`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={seleccionados.has(v.dni)}
                        onChange={() => alternarSeleccion(v.dni)}
                        disabled={v.ha_votado}
                        aria-label={`Seleccionar a ${v.nombre}`}
                        title={v.ha_votado ? 'Ya emitió su voto: no se puede eliminar' : undefined}
                        className="h-4 w-4 rounded border-white/20 bg-black/25 text-blue-400 focus:ring-blue-500/40 disabled:opacity-30"
                      />
                    </td>
                    <td className="p-3 font-mono text-sky-300">{v.dni}</td>
                    <td className="p-3">{v.nombre}</td>
                    <td className="p-3 text-slate-300">{v.grado ?? '-'}</td>
                    <td className="p-3 text-slate-300">{v.seccion ?? '-'}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        v.ha_votado
                          ? 'bg-emerald-900/30 text-emerald-300'
                          : 'bg-blue-900/30 text-blue-300'
                      }`}>
                        {v.ha_votado ? '✓ Votó' : '◷ Pendiente'}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-slate-500">
                      {new Date(v.creado_en).toLocaleDateString('es-PE')}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => pedirEliminarSeleccionados([v.dni])}
                        disabled={v.ha_votado}
                        aria-label={`Eliminar a ${v.nombre}`}
                        title={v.ha_votado ? 'Ya emitió su voto: no se puede eliminar' : 'Eliminar votante'}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <HugeiconsIcon icon={Delete02Icon} size={15} strokeWidth={1.8} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3 text-sm text-slate-300">
            <span>Página {pagina} de {totalPages} · Total: {totalCount}</span>
            <div className="flex gap-2">
              <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
                className="rounded-lg border border-white/10 bg-white/6 px-3 py-1 backdrop-blur-md transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
                Anterior
              </button>
              <button onClick={() => setPagina(p => Math.min(totalPages, p + 1))} disabled={pagina >= totalPages}
                className="rounded-lg border border-white/10 bg-white/6 px-3 py-1 backdrop-blur-md transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50">
                Siguiente
              </button>
            </div>
          </div>
        )}
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {exito && (
        <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {exito}
        </p>
      )}

      {confirmandoEliminar && (
        <AdminModal
          open={confirmandoEliminar}
          onClose={cerrarEliminar}
          title={
            seleccionados.size === 1
              ? 'Eliminar votante'
              : `Eliminar ${seleccionados.size} votantes`
          }
          description="Se eliminarán del padrón electoral. Esta acción no se puede deshacer."
          confirmLabel="Eliminar votantes"
          confirmVariant="danger"
          loading={eliminandoVotantes}
          onConfirm={() => void eliminarSeleccionados()}
        >
          <p className="rounded-xl border border-amber-400/20 bg-amber-400/6 px-3 py-2 text-xs text-amber-100/80">
            Escribe tu contraseña de administrador para confirmar.
          </p>

          <label htmlFor="password-eliminar-votantes" className="mt-4 mb-1 block text-xs text-slate-400">
            Contraseña
          </label>
          <PasswordInput
            id="password-eliminar-votantes"
            autoComplete="current-password"
            value={passwordEliminar}
            onChange={(e) => setPasswordEliminar(e.target.value)}
            autoFocus
            disabled={eliminandoVotantes}
            className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-2.5 text-white backdrop-blur-md transition focus:border-red-400/60 focus:outline-none focus:ring-2 focus:ring-red-500/15 disabled:opacity-60"
          />

          {errorEliminar && <p className="mt-3 text-sm text-red-400">{errorEliminar}</p>}
        </AdminModal>
      )}
    </RevealSection>
  )
}