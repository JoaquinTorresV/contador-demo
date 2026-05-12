'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

type Cliente = { id: number; nombre: string; telefono: string; tipo: string; bot_activo: boolean; estado: string }
type Ticket  = { id: number; nombre: string; telefono: string; servicio_consultado: string; estado: string; fecha_creacion: string }

export default function Dashboard() {
  const router  = useRouter()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [tickets, setTickets]   = useState<Ticket[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return }
    Promise.all([
      api.get('/api/clientes'),
      api.get('/api/tickets?estado=pendiente'),
    ]).then(([c, t]) => { setClientes(c); setTickets(t) })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Cargando...</div>

  const activos = clientes.filter(c => c.estado === 'activo')

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">jq</div>
          <span className="font-semibold text-gray-900">Panel del Contador</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <Link href="/dashboard" className="text-violet-600 font-medium">Dashboard</Link>
          <Link href="/tickets" className="text-gray-500 hover:text-gray-700">Tickets</Link>
          <Link href="/clientes" className="text-gray-500 hover:text-gray-700">Clientes</Link>
          <button onClick={() => { localStorage.clear(); router.push('/login') }} className="text-gray-400 hover:text-gray-600">Salir</button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Clientes activos', value: activos.length },
            { label: 'Tickets pendientes', value: tickets.length },
            { label: 'Bot activo en', value: `${activos.filter(c => c.bot_activo).length} clientes` },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tickets pendientes */}
        {tickets.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Tickets pendientes de revisión</h2>
              <Link href="/tickets" className="text-xs text-violet-600 hover:underline">Ver todos</Link>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {tickets.slice(0, 5).map(t => (
                <Link key={t.id} href="/tickets"
                  className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t.nombre || t.telefono}</p>
                    <p className="text-xs text-gray-500">{t.servicio_consultado}</p>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">Pendiente</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Clientes activos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Clientes activos</h2>
            <Link href="/clientes" className="text-xs text-violet-600 hover:underline">Ver todos</Link>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {activos.slice(0, 8).map(c => (
              <Link key={c.id} href={`/clientes/${c.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold">
                    {c.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.nombre}</p>
                    <p className="text-xs text-gray-500">{c.telefono} · {c.tipo}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.bot_activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  Bot {c.bot_activo ? 'activo' : 'pausado'}
                </span>
              </Link>
            ))}
            {activos.length === 0 && (
              <p className="text-sm text-gray-400 px-5 py-6 text-center">Sin clientes activos aún</p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
