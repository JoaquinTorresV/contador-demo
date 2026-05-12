'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

type Etapa = {
  id: number; nombre: string; descripcion: string
  estado: string; orden: number; fecha_completado: string | null
}
type Proceso = {
  id: number; tipo: string; estado: string
  etapa_actual: number; total_etapas: number
  fecha_inicio: string; fecha_estimada: string | null; fecha_cierre: string | null
  notas: string | null; etapas: Etapa[]
}

const TIPOS = [
  { id: 'inicio_actividades',   label: 'Inicio de Actividades',    etapas: ['Revisión de documentos', 'Formulario SII', 'Resolución y certificado'] },
  { id: 'declaracion_renta',    label: 'Declaración de Renta',      etapas: ['Recopilación de información', 'Elaboración F22', 'Presentación SII'] },
  { id: 'declaracion_iva',      label: 'Declaración IVA Mensual',   etapas: ['Recopilación de documentos', 'Elaboración F29', 'Presentación SII'] },
  { id: 'contabilidad_completa', label: 'Contabilidad Completa',    etapas: ['Libros contables', 'Declaraciones mensuales', 'Informe financiero'] },
  { id: 'asesoria_tributaria',  label: 'Asesoría Tributaria',       etapas: ['Análisis del caso', 'Elaboración informe', 'Presentación al cliente'] },
]

const TIPO_LABEL: Record<string, string> = Object.fromEntries(TIPOS.map(t => [t.id, t.label]))

const ESTADO_BADGE: Record<string, string> = {
  en_progreso: 'bg-blue-100 text-blue-700',
  completado:  'bg-green-100 text-green-700',
  pendiente:   'bg-gray-100 text-gray-500',
  cancelado:   'bg-red-100 text-red-600',
}

function formatFecha(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ProcesosPage() {
  const router       = useRouter()
  const { id }       = useParams<{ id: string }>()
  const [nombre, setNombre]     = useState('')
  const [procesos, setProcesos] = useState<Proceso[]>([])
  const [loading, setLoading]   = useState(true)
  const [creando, setCreando]   = useState(false)
  const [form, setForm]         = useState({ tipo: 'inicio_actividades', fecha_estimada: '' })
  const [guardando, setGuardando] = useState(false)
  const [avanzando, setAvanzando]     = useState<number | null>(null)
  const [agregandoEn, setAgregandoEn] = useState<number | null>(null)
  const [nuevaEtapa, setNuevaEtapa]   = useState('')
  const [guardandoEtapa, setGuardandoEtapa] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return }
    Promise.all([
      api.get(`/api/clientes/${id}`),
      api.get(`/api/procesos?cliente_id=${id}`),
    ]).then(([cliente, procs]) => {
      setNombre(cliente.nombre)
      // Cargar etapas de cada proceso
      return Promise.all(procs.map((p: Proceso) => api.get(`/api/procesos/${p.id}`)))
    }).then(setProcesos)
      .catch(() => router.push('/clientes'))
      .finally(() => setLoading(false))
  }, [id, router])

  async function crearProceso() {
    const tipoConfig = TIPOS.find(t => t.id === form.tipo)!
    setGuardando(true)
    try {
      await api.post('/api/procesos', {
        cliente_id: Number(id),
        tipo: form.tipo,
        etapas: tipoConfig.etapas,
        fecha_estimada: form.fecha_estimada || null,
      })
      const procs = await api.get(`/api/procesos?cliente_id=${id}`)
      const detalle = await Promise.all(procs.map((p: Proceso) => api.get(`/api/procesos/${p.id}`)))
      setProcesos(detalle)
      setCreando(false)
      setForm({ tipo: 'inicio_actividades', fecha_estimada: '' })
    } finally {
      setGuardando(false)
    }
  }

  async function agregarEtapa(procesoId: number) {
    if (!nuevaEtapa.trim()) return
    setGuardandoEtapa(true)
    try {
      await api.post(`/api/procesos/${procesoId}/etapas`, { nombre: nuevaEtapa.trim() })
      const procs = await api.get(`/api/procesos?cliente_id=${id}`)
      const detalle = await Promise.all(procs.map((p: Proceso) => api.get(`/api/procesos/${p.id}`)))
      setProcesos(detalle)
      setAgregandoEn(null)
      setNuevaEtapa('')
    } finally {
      setGuardandoEtapa(false)
    }
  }

  async function avanzarEtapa(procesoId: number) {
    setAvanzando(procesoId)
    try {
      await api.patch(`/api/procesos/${procesoId}/avanzar`, {})
      const procs = await api.get(`/api/procesos?cliente_id=${id}`)
      const detalle = await Promise.all(procs.map((p: Proceso) => api.get(`/api/procesos/${p.id}`)))
      setProcesos(detalle)
    } finally {
      setAvanzando(null)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 text-sm">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-700">Dashboard</Link>
        <span className="text-gray-300">/</span>
        <Link href="/clientes" className="text-gray-400 hover:text-gray-700">Clientes</Link>
        <span className="text-gray-300">/</span>
        <Link href={`/clientes/${id}`} className="text-gray-400 hover:text-gray-700">{nombre}</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-900 font-medium">Procesos</span>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Procesos de {nombre}</h1>
          {!creando && (
            <button onClick={() => setCreando(true)}
              className="bg-violet-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-violet-700">
              + Nuevo proceso
            </button>
          )}
        </div>

        {/* Formulario nuevo proceso */}
        {creando && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Nuevo proceso</h3>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tipo de servicio</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                {TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Fecha estimada de cierre</label>
              <input type="date" value={form.fecha_estimada}
                onChange={e => setForm(f => ({ ...f, fecha_estimada: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Etapas que se crearán</label>
              <ul className="text-sm text-gray-600 space-y-1">
                {TIPOS.find(t => t.id === form.tipo)?.etapas.map((e, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs">{i + 1}</span>
                    {e}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={crearProceso} disabled={guardando}
                className="bg-violet-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
                {guardando ? 'Creando...' : 'Crear proceso'}
              </button>
              <button onClick={() => setCreando(false)}
                className="bg-gray-100 text-gray-600 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-200">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de procesos */}
        {procesos.length === 0 && !creando && (
          <p className="text-sm text-gray-400 text-center py-12">Sin procesos aún — crea el primero</p>
        )}

        {procesos.map(p => {
          const progreso = Math.round(((p.etapa_actual - 1) / p.total_etapas) * 100)
          const yaTermino = p.estado === 'completado'
          return (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{TIPO_LABEL[p.tipo] || p.tipo}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Inicio: {formatFecha(p.fecha_inicio)}
                    {p.fecha_estimada && ` · Estimado: ${formatFecha(p.fecha_estimada)}`}
                    {p.fecha_cierre && ` · Cerrado: ${formatFecha(p.fecha_cierre)}`}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESTADO_BADGE[p.estado] || 'bg-gray-100 text-gray-500'}`}>
                  {p.estado.replace('_', ' ')}
                </span>
              </div>

              {/* Barra de progreso */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Etapa {Math.min(p.etapa_actual, p.total_etapas)} de {p.total_etapas}</span>
                  <span>{yaTermino ? '100' : progreso}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${yaTermino ? 'bg-green-500' : 'bg-violet-600'}`}
                    style={{ width: `${yaTermino ? 100 : progreso}%` }} />
                </div>
              </div>

              {/* Etapas */}
              <div className="space-y-2">
                {p.etapas.map(e => (
                  <div key={e.id} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                      e.estado === 'completado' ? 'bg-green-500 text-white' :
                      e.orden === p.etapa_actual ? 'bg-violet-600 text-white' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {e.estado === 'completado' ? '✓' : e.orden}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm ${e.estado === 'completado' ? 'text-gray-400 line-through' : e.orden === p.etapa_actual ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                        {e.nombre}
                      </p>
                      {e.fecha_completado && (
                        <p className="text-xs text-gray-400">{formatFecha(e.fecha_completado)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Agregar etapa */}
              {agregandoEn === p.id ? (
                <div className="flex gap-2">
                  <input autoFocus type="text" value={nuevaEtapa}
                    onChange={e => setNuevaEtapa(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && agregarEtapa(p.id)}
                    placeholder="Nombre de la nueva etapa..."
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                  <button onClick={() => agregarEtapa(p.id)} disabled={guardandoEtapa}
                    className="bg-violet-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
                    {guardandoEtapa ? '...' : 'Agregar'}
                  </button>
                  <button onClick={() => { setAgregandoEn(null); setNuevaEtapa('') }}
                    className="text-gray-400 hover:text-gray-600 px-2 text-sm">✕</button>
                </div>
              ) : (
                <button onClick={() => setAgregandoEn(p.id)}
                  className="text-xs text-gray-400 hover:text-violet-600 transition">
                  + Agregar etapa
                </button>
              )}

              {!yaTermino && (
                <button onClick={() => avanzarEtapa(p.id)} disabled={avanzando === p.id}
                  className="w-full bg-violet-50 text-violet-700 border border-violet-200 rounded-lg py-2 text-sm font-medium hover:bg-violet-100 disabled:opacity-50 transition">
                  {avanzando === p.id ? 'Avanzando...' : 'Marcar etapa actual como completada →'}
                </button>
              )}
            </div>
          )
        })}
      </main>
    </div>
  )
}
