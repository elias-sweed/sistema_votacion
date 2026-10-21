import { useEffect, useState, useCallback } from 'react'
import type { ChangeEvent } from 'react'
import { supabase } from '../../lib/supabase'

type Votante = {
  dni: string
  nombre: string
  mesa_id: string
  mesa_nombre: string
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
  mesa_id: string
  mesa_nombre: string
  valido: boolean
  motivo: string | null
}

type ImportResult = {
  insertados: number
  duplicados: number
  errores: Array<{ fila: number; dni: string; nombre: string; mesa_id: string; error: string }>
  detalle: Array<{ dni: string; nombre: string; mesa_id: string; estado: string }>
}

type MesaOption = { id: string; nombre: string }

export default function PadronPage() {
  // Estados principales
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

  // Datos
  const [votantes, setVotantes] = useState<Votante[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [mesas, setMesas] = useState<MesaOption[]>([])
  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null)

  // Filtros y paginación
  const [busqueda, setBusqueda] = useState('')
  const [mesaFiltro, setMesaFiltro] = useState<string>('')
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

  // Cargar mesas para select
  const cargarMesas = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('mesas').select('id, nombre').eq('activo', true).order('nombre')
    if (!err && data) setMesas(data.map(m => ({ id: m.id, nombre: m.nombre })))
  }, [])

  // Cargar estadísticas
  const cargarEstadisticas = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('obtener_estadisticas_padron')
    if (err) { console.error('Error cargando estadísticas:', err); return }
    if (data?.[0]) setEstadisticas(data[0] as Estadisticas)
  }, [])

  // Cargar votantes con filtros
  const cargarVotantes = useCallback(async () => {
    setCargando(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('listar_votantes', {
      p_mesa_id: mesaFiltro || null,
      p_busqueda: busqueda || null,
      p_solo_pendientes: soloPendientes,
      p_limit: pageSize,
      p_offset: (pagina - 1) * pageSize
    })
    setCargando(false)
    if (err) { setError('No se pudo cargar el padrón.'); return }
    if (data) {
      setVotantes(data.map((v: any) => ({
        dni: v.dni,
        nombre: v.nombre,
        mesa_id: v.mesa_id,
        mesa_nombre: v.mesa_nombre,
        ha_votado: v.ha_votado,
        creado_en: v.creado_en,
      })))
      setTotalCount(data[0]?.total_count ?? 0)
    }
  }, [mesaFiltro, busqueda, soloPendientes, pagina, pageSize])

  useEffect(() => {
    cargarMesas()
    cargarEstadisticas()
  }, [cargarMesas, cargarEstadisticas])

  useEffect(() => {
    cargarVotantes()
  }, [cargarVotantes])

  // --- IMPORTACIÓN ---

  function manejarArchivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
      setError('Solo se permiten archivos CSV o Excel (.xlsx, .xls)')
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
        setExito(`Importación completada: ${result.insertados} insertados, ${result.duplicados} duplicados, ${(result.errores?.length ?? 0)} errores.`)
      }
    } catch (e: any) {
      setError('Error al importar: ' + (e.message || 'Error desconocido'))
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
    const mesaIdx = headers.indexOf('mesa_id') >= 0 ? headers.indexOf('mesa_id') : headers.indexOf('mesa')
    if (dniIdx === -1 || nombreIdx === -1 || mesaIdx === -1) {
      throw new Error('CSV debe tener columnas: dni, nombre, mesa_id')
    }
    const rows: any[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim())
      if (cols.length < 3) continue
      rows.push({
        dni: cols[dniIdx],
        nombre: cols[nombreIdx],
        mesa_id: cols[mesaIdx]
      })
    }
    return rows
  }

  // --- RENDER ---

  if (cargando && votantes.length === 0) {
    return <div className="text-center py-8 text-slate-400">Cargando padrón…</div>
  }

  return (
    <section className="space-y-6">
      {/* Header con estadísticas */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h2 className="text-xl font-bold text-white">Padrón Electoral</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="bg-slate-800 rounded-lg p-3">
            <p className="text-slate-400">Total</p>
            <p className="text-2xl font-bold text-white">{estadisticas?.total_votantes ?? 0}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3">
            <p className="text-slate-400">Votaron</p>
            <p className="text-2xl font-bold text-emerald-400">{estadisticas?.total_votaron ?? 0}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3">
            <p className="text-slate-400">Pendientes</p>
            <p className="text-2xl font-bold text-amber-400">{estadisticas?.total_pendientes ?? 0}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3">
            <p className="text-slate-400">Participación</p>
            <p className="text-2xl font-bold text-sky-400">{estadisticas?.participacion_pct ?? 0}%</p>
          </div>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">Buscar por DNI o nombre</label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
              placeholder="Buscar…"
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-2 text-white"
            />
          </div>
          <div className="sm:w-48">
            <label className="block text-xs text-slate-400 mb-1">Mesa</label>
            <select
              value={mesaFiltro}
              onChange={(e) => { setMesaFiltro(e.target.value); setPagina(1); }}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-2 text-white"
            >
              <option value="">Todas las mesas</option>
              {mesas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300 self-end">
            <input
              type="checkbox"
              checked={soloPendientes}
              onChange={(e) => { setSoloPendientes(e.target.checked); setPagina(1); }}
              className="rounded border-slate-600 text-sky-600 focus:ring-sky-500"
            />
            Solo pendientes
          </label>
        </div>
      </div>

      {/* Importación */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-4 border border-slate-700">
        <h3 className="text-lg font-semibold text-white">Importar Padrón (CSV)</h3>

        {pasoImportacion === 'archivo' && (
          <div>
            <p className="text-sm text-slate-400 mb-3">
              Formato CSV requerido: columnas <code className="text-sky-300">dni,nombre,mesa_id</code>.
              El archivo debe tener encabezados. Máx. recomendado: 500 filas.
            </p>
            <input
              id="file-input"
              type="file"
              accept=".csv"
              onChange={manejarArchivo}
              className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-sky-600 file:text-white hover:file:bg-sky-500"
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
            <div className="max-h-64 overflow-auto rounded-lg bg-slate-900 border border-slate-700">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="text-left text-xs text-slate-400 uppercase">
                    <th className="p-2">Fila</th>
                    <th className="p-2">DNI</th>
                    <th className="p-2">Nombre</th>
                    <th className="p-2">Mesa</th>
                    <th className="p-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {previewData.slice(0, 100).map((item, idx) => (
                    <tr key={idx} className={item.valido ? '' : 'bg-red-900/20'}>
                      <td className="p-2 text-slate-400">{item.fila}</td>
                      <td className="p-2 font-mono">{item.dni}</td>
                      <td className="p-2">{item.nombre}</td>
                      <td className="p-2 text-slate-300">{item.mesa_nombre}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${item.valido ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                          {item.valido ? '✓ Válido' : item.motivo}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {previewData.length > 100 && (
                    <tr>
                      <td colSpan={5} className="p-2 text-center text-slate-500">
                        … y {previewData.length - 100} filas más
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button onClick={confirmarImportacion} disabled={importando || previewValidos === 0}
                className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50 hover:bg-emerald-500 transition">
                {importando ? 'Importando…' : 'Confirmar importación'}
              </button>
              <button onClick={reiniciarImportacion} disabled={importando}
                className="rounded-lg bg-slate-700 px-4 py-2 text-white hover:bg-slate-600 transition">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {pasoImportacion === 'resultado' && resultadoImportacion && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-emerald-400">✓ Insertados: <strong>{resultadoImportacion.insertados}</strong></span>
              <span className="text-amber-400">⟳ Duplicados: <strong>{resultadoImportacion.duplicados}</strong></span>
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
              className="rounded-lg bg-slate-700 px-4 py-2 text-white hover:bg-slate-600 transition">
              Nueva importación
            </button>
          </div>
        )}
      </div>

      {/* Tabla de votantes */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-xs text-slate-400 uppercase">
              <tr>
                <th className="p-3">DNI</th>
                <th className="p-3">Nombre</th>
                <th className="p-3">Mesa</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Registrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {votantes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No hay votantes que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                votantes.map((v) => (
                  <tr key={v.dni} className={v.ha_votado ? 'bg-emerald-900/10' : ''}>
                    <td className="p-3 font-mono text-sky-300">{v.dni}</td>
                    <td className="p-3">{v.nombre}</td>
                    <td className="p-3 text-slate-300">{v.mesa_nombre}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${v.ha_votado ? 'bg-emerald-900/30 text-emerald-400' : 'bg-amber-900/30 text-amber-400'}`}>
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
          <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-between text-sm text-slate-300">
            <span>Página {pagina} de {totalPages} · Total: {totalCount}</span>
            <div className="flex gap-2">
              <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
                className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition">
                Anterior
              </button>
              <button onClick={() => setPagina(p => Math.min(totalPages, p + 1))} disabled={pagina >= totalPages}
                className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition">
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