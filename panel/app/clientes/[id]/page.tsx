'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

type Cliente = {
  id: number; nombre: string; telefono: string; rut: string; email: string
  tipo: string; nombre_empresa: string; estado: string
  bot_activo: boolean; modulos_activos: Record<string, boolean>
}

const MODULOS = [
  { key: 'preventa',        label: 'Pre-venta' },
  { key: 'onboarding',      label: 'Onboarding' },
  { key: 'consulta_proceso', label: 'Consulta de proceso' },
  { key: 'notificaciones',  label: 'Notificaciones' },
]

export default function ClientePage() {
  const router   = useRouter()
  const { id }   = useParams<{ id: string }>()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return }
    api.get(`/api/clientes/${id}`)
      .then(setCliente)
      .catch(() => router.push('/clientes'))
      .finally(() => setLoading(false))
  }, [id, router])

  async function toggleBot(activo: boolean) {
    const updated = await api.patch(`/api/clientes/${id}/bot`, { activo })
    setCliente(prev => prev ? { ...prev, bot_activo: updated.bot_activo } : prev)
  }

  async function toggleModulo(key: string, activo: boolean) {
    const updated = await api.patch(`/api/clientes/${id}/modulos`, { modulos: { [key]: activo } })
    setCliente(prev => prev ? { ...prev, modulos_activos: updated.modulos_activos } : prev)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Cargando...</div>
  if (!cliente) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 text-sm">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-700">Dashboard</Link>
        <span className="text-gray-300">/</span>
        <Link href="/clientes" className="text-gray-400 hover:text-gray-700">Clientes</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-900 font-medium">{cliente.nombre}</span>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <div className="flex justify-end">
          <Link href={`/clientes/${id}/procesos`}
            className="text-sm text-violet-600 hover:underline font-medium">
            Ver procesos →
          </Link>
        </div>
        {/* Ficha */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Datos del cliente</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              ['Nombre', cliente.nombre],
              ['Teléfono', cliente.telefono],
              ['RUT', cliente.rut || '—'],
              ['Email', cliente.email || '—'],
              ['Tipo', cliente.tipo],
              ['Empresa', cliente.nombre_empresa || '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-gray-500">{k}</p>
                <p className="font-medium text-gray-900">{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Control del bot */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Bot WhatsApp</h2>
              <p className="text-xs text-gray-500 mt-0.5">Cuando está pausado el bot no responde. Los documentos siguen procesándose.</p>
            </div>
            <button
              onClick={() => toggleBot(!cliente.bot_activo)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                cliente.bot_activo
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cliente.bot_activo ? 'Activo — Pausar' : 'Pausado — Activar'}
            </button>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Módulos</p>
            <div className="space-y-2">
              {MODULOS.map(m => {
                const activo = cliente.modulos_activos?.[m.key] ?? true
                return (
                  <div key={m.key} className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-700">{m.label}</span>
                    <button
                      onClick={() => toggleModulo(m.key, !activo)}
                      className={`w-10 h-5 rounded-full transition relative ${activo ? 'bg-violet-600' : 'bg-gray-200'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${activo ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
