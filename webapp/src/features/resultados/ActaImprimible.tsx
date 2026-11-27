import type { CSSProperties } from 'react'
import logoIE from '../../assets/logo.png'

export type ActaResultado = {
  id: string
  nombre: string
  votos: number
}

export type ActaMesa = {
  mesa_id: string
  mesa_nombre: string
  total: number
}

type Props = {
  titulo: string
  centro: string
  actualizadoEn: number
  eleccionAbierta: boolean
  resultados: ActaResultado[]
  totalVotos: number
  totalVotantes: number
  totalVotaron: number
  totalPendientes: number
  participacion: number
  mesas: ActaMesa[]
  hayEmpate: boolean
}

const NEGRO = '#111111'
const BORDE = `1px solid ${NEGRO}`
const FUENTE = '"Ubuntu Mono", monospace'

function numero(valor: unknown): number {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

function porcentaje(valor: number, total: number): number {
  return total > 0 ? (valor / total) * 100 : 0
}

function formatearPorcentaje(valor: number): string {
  return valor.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

const celda: CSSProperties = {
  border: BORDE,
  padding: '5px 7px',
  fontSize: '9.5pt',
  lineHeight: 1.35
}

const celdaCentro: CSSProperties = { ...celda, textAlign: 'center' }

export default function ActaImprimible({
  titulo,
  centro,
  actualizadoEn,
  eleccionAbierta,
  resultados,
  totalVotos,
  totalVotantes,
  totalVotaron,
  totalPendientes,
  participacion,
  mesas,
  hayEmpate
}: Props) {
  const nombreEleccion = titulo.trim() || 'Elección de Municipios Escolares'
  const nombreCentro = centro.trim() || 'I.E. Jimenez Pimentel'
  const fechaEmision = new Date(actualizadoEn).toLocaleString('es-PE', {
    dateStyle: 'long',
    timeStyle: 'short'
  })

  return (
    <div className="acta-imprimible" aria-hidden="true" style={{ fontFamily: FUENTE, color: NEGRO }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '6mm', borderBottom: `2px solid ${NEGRO}`, paddingBottom: '4mm' }}>
        <img
          src={logoIE}
          alt=""
          style={{ width: '24mm', height: '24mm', objectFit: 'contain', flexShrink: 0 }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: '12pt', fontWeight: 700, lineHeight: 1.2 }}>{nombreCentro}</p>
          <p style={{ margin: '2mm 0 0', fontSize: '10pt', lineHeight: 1.3 }}>{nombreEleccion}</p>
        </div>
      </header>

      <div style={{ marginTop: '8mm', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '9pt', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          {nombreCentro}
        </p>
        <h1 style={{ margin: '2mm 0 0', fontSize: '17pt', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Acta de resultados
        </h1>
        <p style={{ margin: '2mm 0 0', fontSize: '10pt' }}>
          {nombreEleccion}
        </p>
      </div>

      <p style={{ margin: '6mm 0 0', fontSize: '9.5pt', lineHeight: 1.55, textAlign: 'justify' }}>
        Se deja constancia de los resultados del escrutinio registrado en el sistema de votación de la{' '}
        {nombreCentro}, correspondiente a {nombreEleccion}. El presente documento consigna los votos
        emitidos hasta la fecha y hora de emisión indicadas.
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6mm', marginTop: '5mm', fontSize: '9pt' }}>
        <span><strong>Sede:</strong> {nombreCentro}</span>
        <span><strong>Fecha de emisión:</strong> {fechaEmision}</span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '5mm', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '12%' }} />
          <col style={{ width: '52%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...celdaCentro, background: '#eeeeee', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>N.º</th>
            <th style={{ ...celda, background: '#eeeeee', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Candidato</th>
            <th style={{ ...celdaCentro, background: '#eeeeee', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Votos</th>
            <th style={{ ...celdaCentro, background: '#eeeeee', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>% del total</th>
          </tr>
        </thead>
        <tbody>
          {resultados.map((resultado, indice) => (
            <tr key={resultado.id}>
              <td style={celdaCentro}>{indice + 1}</td>
              <td style={celda}>{resultado.nombre}</td>
              <td style={celdaCentro}>{numero(resultado.votos)}</td>
              <td style={celdaCentro}>{formatearPorcentaje(porcentaje(numero(resultado.votos), totalVotos))}%</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...celda, fontWeight: 700 }} colSpan={2}>Total de votos emitidos</td>
            <td style={{ ...celdaCentro, fontWeight: 700 }}>{totalVotos}</td>
            <td style={{ ...celdaCentro, fontWeight: 700 }}>100,0%</td>
          </tr>
        </tbody>
      </table>

      <section style={{ marginTop: '5mm', border: BORDE, padding: '4mm 5mm', fontSize: '9.5pt', lineHeight: 1.6 }}>
        <p style={{ margin: 0 }}>
          <strong>Padrón electoral:</strong> {totalVotantes} votantes
        </p>
        <p style={{ margin: '1mm 0 0' }}>
          <strong>Votantes que emitieron su voto:</strong> {totalVotaron}
        </p>
        <p style={{ margin: '1mm 0 0' }}>
          <strong>Votantes pendientes:</strong> {totalPendientes}
        </p>
        <p style={{ margin: '1mm 0 0' }}>
          <strong>Participación:</strong> {formatearPorcentaje(participacion)}%
        </p>
        <p style={{ margin: '1mm 0 0' }}>
          <strong>Estado de la elección:</strong> {eleccionAbierta ? 'abierta' : 'cerrada'}
        </p>
      </section>

      {hayEmpate && (
        <p style={{ margin: '4mm 0 0', border: BORDE, padding: '3mm 4mm', fontSize: '9pt', lineHeight: 1.5 }}>
          <strong>Observación:</strong> existe empate en el primer lugar. El acta refleja el conteo sin
          declarar un ganador único hasta que se resuelva el desempate.
        </p>
      )}

      {mesas.length > 0 && (
        <section style={{ marginTop: '5mm' }}>
          <p style={{ margin: '0 0 2mm', fontSize: '10pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Votos por mesa
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '64%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...celda, background: '#eeeeee', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mesa</th>
                <th style={{ ...celdaCentro, background: '#eeeeee', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Votos</th>
                <th style={{ ...celdaCentro, background: '#eeeeee', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>% del total</th>
              </tr>
            </thead>
            <tbody>
              {mesas.map((mesa) => (
                <tr key={mesa.mesa_id}>
                  <td style={celda}>{mesa.mesa_nombre}</td>
                  <td style={celdaCentro}>{numero(mesa.total)}</td>
                  <td style={celdaCentro}>{formatearPorcentaje(porcentaje(numero(mesa.total), totalVotos))}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section style={{ marginTop: '12mm', display: 'flex', justifyContent: 'space-between', gap: '12mm', fontSize: '9.5pt' }}>
        <div style={{ width: '42%', textAlign: 'center' }}>
          <div style={{ borderTop: BORDE, paddingTop: '2mm' }}>Firma del presidente de mesa</div>
        </div>
        <div style={{ width: '42%', textAlign: 'center' }}>
          <div style={{ borderTop: BORDE, paddingTop: '2mm' }}>Firma del secretario de mesa</div>
        </div>
      </section>

      <footer style={{ marginTop: '8mm', borderTop: `1px solid ${NEGRO}`, paddingTop: '2mm', fontSize: '8pt', textAlign: 'center' }}>
        Documento generado automáticamente por el sistema de votación · {nombreCentro}
      </footer>
    </div>
  )
}
