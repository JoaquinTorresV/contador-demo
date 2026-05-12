'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

type Ticket = {
  id: number; nombre: string; telefono: string; rut: string
  servicio_consultado: string; info_recopilada: Record<string, string>
  estado: string; fecha_creacion: string
}

export default function TicketsPage() {
  const router = useRouter()
  const [tickets, setTickets]     = useState<Ticket[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<Ticket | null>(null)
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return }
    api.get('/api/tickets').then(setTickets).finally(() => setLoading(false))
  }, [router])

  async function resolver(id: number, estado: 'aprobado' | 'rechazado') {
    setProcesando(true)
    try {
      await api.patch(`/api/tickets/${id}/estado`, { estado })
      setTickets(prev => prev.map(t => t.id === id ? { ...t, estado } : t))
      setSelected(null)
    } finally {
      setProcesando(false)
    }
  }

  const pendientes = tickets.filter(t => t.estado === 'pendiente')
  const resueltos  = tickets.filter(t => t.estado !== 'pendiente')

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 text-sm">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-700">Dashboard</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-900 font-medium">Tickets</span>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8 flex gap-6">
        {/* Lista */}
        <div className="flex-1 space-y-6">
          {pendientes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pendientes — {pendientes.length}</p>
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {pendientes.map(t => (
                  <button key={t.id} onClick={() => setSelected(t)}
                    className={`w-full text-left px-5 py-3 hover:bg-gray-50 transition ${selected?.id === t.id ? 'bg-violet-50' : ''}`}>
                    <p className="text-sm font-medium text-gray-900">{t.nombre || t.telefono}</p>
                    <p className="text-xs text-gray-500">{t.servicio_consultado} · {t.telefono}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {resueltos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Resueltos</p>
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {resueltos.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{t.nombre || t.telefono}</p>
                      <p className="text-xs text-gray-400">{t.servicio_consultado}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${t.estado === 'aprobado' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {t.estado}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tickets.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-12">Sin tickets aún</p>
          )}
        </div>

        {/* Detalle */}
        {selected && (
          <div className="w-72 bg-white border border-gray-200 rounded-xl p-5 h-fit sticky top-6">
            <h3 className="font-semibold text-gray-900 mb-1">{selected.nombre || 'Sin nombre'}</h3>
            <p className="text-xs text-gray-500 mb-4">{selected.telefono}</p>

            <div className="space-y-2 text-sm mb-5">
              <div><span className="text-gray-500">Servicio:</span> <span className="font-medium">{selected.servicio_consultado}</span></div>
              {Object.entries(selected.info_recopilada || {}).map(([k, v]) => (
                <div key={k}><span className="text-gray-500 capitalize">{k}:</span> <span className="font-medium">{v}</span></div>
              ))}
            </div>

            {selected.estado === 'pendiente' && (
              <div className="flex gap-2">
                <button disabled={procesando} onClick={() => resolver(selected.id, 'aprobado')}
                  className="flex-1 bg-violet-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
                  Aprobar
                </button>
                <button disabled={procesando} onClick={() => resolver(selected.id, 'rechazado')}
                  className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
                  Rechazar
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
