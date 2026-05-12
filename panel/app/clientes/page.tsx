'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'

type Cliente = {
  id: number; nombre: string; telefono: string; rut: string
  tipo: string; nombre_empresa: string; estado: string; bot_activo: boolean
}

export default function ClientesPage() {
  const router = useRouter()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading]   = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('token')) { router.push('/login'); return }
    api.get('/api/clientes').then(setClientes).finally(() => setLoading(false))
  }, [router])

  const filtrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.telefono.includes(busqueda) ||
    (c.rut || '').includes(busqueda)
  )

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6 text-sm">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">Dashboard</Link>
          <Link href="/tickets" className="text-gray-500 hover:text-gray-700">Tickets</Link>
          <span className="text-violet-600 font-medium">Clientes</span>
        </div>
        <button onClick={() => { localStorage.clear(); router.push('/login') }} className="text-sm text-gray-400 hover:text-gray-600">Salir</button>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Clientes</h1>
          <span className="text-sm text-gray-500">{clientes.length} en total</span>
        </div>

        <input
          type="text"
          placeholder="Buscar por nombre, teléfono o RUT..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-violet-500"
        />

        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {filtrados.map(c => (
            <Link key={c.id} href={`/clientes/${c.id}`}
              className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-sm font-bold flex-shrink-0">
                  {c.nombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.nombre}</p>
                  <p className="text-xs text-gray-500">
                    {c.telefono}{c.rut ? ` · ${c.rut}` : ''}{c.nombre_empresa ? ` · ${c.nombre_empresa}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${c.bot_activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  Bot {c.bot_activo ? 'activo' : 'pausado'}
                </span>
                <span className="text-xs text-gray-400 capitalize">{c.tipo}</span>
              </div>
            </Link>
          ))}

          {filtrados.length === 0 && (
            <p className="text-sm text-gray-400 px-5 py-8 text-center">
              {busqueda ? 'Sin resultados para esa búsqueda' : 'Sin clientes aún — llegarán cuando el bot haga onboarding'}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
