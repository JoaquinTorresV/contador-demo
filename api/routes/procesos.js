const router      = require('express').Router()
const http        = require('http')
const auth        = require('../middleware/auth')
const { query }   = require('../../db/connection')
const docDefaults = require('../../config/document-requirements.json')

function notifyBot(path, payload) {
  const body    = JSON.stringify(payload)
  const port    = process.env.BOT_INTERNAL_PORT || 3004
  const options = {
    hostname: '127.0.0.1', port, path, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }
  const req = http.request(options)
  req.on('error', err => console.error('[api] Error notificando bot:', err.message))
  req.write(body)
  req.end()
}

router.use(auth)

// GET /api/procesos?cliente_id=X
router.get('/', async (req, res) => {
  const { cliente_id } = req.query
  if (!cliente_id) return res.status(400).json({ error: 'cliente_id requerido' })

  const { rows } = await query(
    'SELECT * FROM procesos WHERE cliente_id = $1 ORDER BY fecha_inicio DESC',
    [cliente_id]
  )
  res.json(rows)
})

// GET /api/procesos/:id
router.get('/:id', async (req, res) => {
  const procesoRes = await query('SELECT * FROM procesos WHERE id = $1', [req.params.id])
  if (!procesoRes.rows[0]) return res.status(404).json({ error: 'Proceso no encontrado' })

  const etapasRes = await query(
    'SELECT * FROM etapas WHERE proceso_id = $1 ORDER BY orden',
    [req.params.id]
  )

  res.json({ ...procesoRes.rows[0], etapas: etapasRes.rows })
})

// POST /api/procesos — crear proceso
router.post('/', async (req, res) => {
  const { cliente_id, tipo, etapas = [], fecha_estimada } = req.body
  if (!cliente_id || !tipo) return res.status(400).json({ error: 'cliente_id y tipo requeridos' })

  const procesoRes = await query(
    `INSERT INTO procesos (cliente_id, tipo, total_etapas, fecha_estimada, contador_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [cliente_id, tipo, etapas.length || 1, fecha_estimada || null, req.user.id]
  )
  const proceso = procesoRes.rows[0]

  const defaults = docDefaults[tipo] || {}
  const primeraEtapaDocs = []

  if (etapas.length) {
    for (let i = 0; i < etapas.length; i++) {
      const etapa = etapas[i]
      const nombreEtapa    = typeof etapa === 'string' ? etapa : etapa.nombre
      const docsRequeridos = typeof etapa === 'object' && Array.isArray(etapa.docs)
        ? etapa.docs
        : (defaults[nombreEtapa] || [])
      if (i === 0) primeraEtapaDocs.push(...docsRequeridos)
      await query(
        'INSERT INTO etapas (proceso_id, nombre, orden, documentos_requeridos) VALUES ($1, $2, $3, $4)',
        [proceso.id, nombreEtapa, i + 1, JSON.stringify(docsRequeridos)]
      )
    }
  }

  const { rows: [cliente] } = await query(
    'SELECT nombre, telefono FROM clientes WHERE id = $1', [cliente_id]
  )
  if (cliente?.telefono) {
    notifyBot('/internal/notify-proceso-inicio', {
      telefono:       cliente.telefono,
      nombre:         cliente.nombre,
      tipo_proceso:   tipo,
      primera_etapa:  etapas[0] || null,
      docs_requeridos: primeraEtapaDocs,
    })
  }

  res.status(201).json(proceso)
})

// PATCH /api/procesos/:id/avanzar — marca etapa actual como completada y avanza
router.patch('/:id/avanzar', async (req, res) => {
  const { rows: [proceso] } = await query('SELECT * FROM procesos WHERE id = $1', [req.params.id])
  if (!proceso) return res.status(404).json({ error: 'Proceso no encontrado' })
  if (proceso.estado === 'completado') return res.status(400).json({ error: 'Proceso ya completado' })

  // Obtener nombre de etapa actual y la siguiente
  const { rows: etapas } = await query(
    'SELECT * FROM etapas WHERE proceso_id = $1 ORDER BY orden', [proceso.id]
  )
  const etapaActual   = etapas.find(e => e.orden === proceso.etapa_actual)
  const etapaSiguiente = etapas.find(e => e.orden === proceso.etapa_actual + 1)

  await query(
    `UPDATE etapas SET estado = 'completado', fecha_completado = NOW()
     WHERE proceso_id = $1 AND orden = $2`,
    [proceso.id, proceso.etapa_actual]
  )

  const nuevaEtapa = proceso.etapa_actual + 1
  const esUltima   = nuevaEtapa > proceso.total_etapas

  const { rows } = await query(
    `UPDATE procesos SET etapa_actual = $1, estado = $2 ${esUltima ? ', fecha_cierre = NOW()' : ''}
     WHERE id = $3 RETURNING *`,
    [nuevaEtapa, esUltima ? 'completado' : 'en_progreso', proceso.id]
  )

  // Notificar al cliente por WhatsApp
  const { rows: [cliente] } = await query(
    'SELECT nombre, telefono FROM clientes WHERE id = $1', [proceso.cliente_id]
  )
  if (cliente?.telefono) {
    notifyBot('/internal/notify-etapa', {
      telefono:           cliente.telefono,
      nombre:             cliente.nombre,
      tipo_proceso:       proceso.tipo,
      etapa_completada:   etapaActual?.nombre || `Etapa ${proceso.etapa_actual}`,
      siguiente_etapa:    etapaSiguiente?.nombre || null,
      docs_siguiente:     etapaSiguiente?.documentos_requeridos || [],
      proceso_completado: esUltima,
    })
  }

  res.json(rows[0])
})

// PATCH /api/procesos/:id/etapas/:etapa_id/documentos — editar docs requeridos
router.patch('/:id/etapas/:etapa_id/documentos', async (req, res) => {
  const { documentos_requeridos } = req.body
  if (!Array.isArray(documentos_requeridos)) return res.status(400).json({ error: 'documentos_requeridos debe ser un array' })
  const { rows } = await query(
    'UPDATE etapas SET documentos_requeridos = $1 WHERE id = $2 AND proceso_id = $3 RETURNING *',
    [JSON.stringify(documentos_requeridos), req.params.etapa_id, req.params.id]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Etapa no encontrada' })
  res.json(rows[0])
})

// POST /api/procesos/:id/etapas — agregar etapa a proceso existente
router.post('/:id/etapas', async (req, res) => {
  const { nombre } = req.body
  if (!nombre) return res.status(400).json({ error: 'nombre requerido' })

  const { rows: [proceso] } = await query('SELECT * FROM procesos WHERE id = $1', [req.params.id])
  if (!proceso) return res.status(404).json({ error: 'Proceso no encontrado' })

  const { rows: etapas } = await query(
    'SELECT MAX(orden) as max_orden FROM etapas WHERE proceso_id = $1', [proceso.id]
  )
  const orden = (etapas[0].max_orden || 0) + 1

  await query('INSERT INTO etapas (proceso_id, nombre, orden) VALUES ($1, $2, $3)', [proceso.id, nombre, orden])
  await query('UPDATE procesos SET total_etapas = total_etapas + 1 WHERE id = $1', [proceso.id])

  const { rows } = await query('SELECT * FROM procesos WHERE id = $1', [proceso.id])
  res.status(201).json(rows[0])
})

// PATCH /api/procesos/:id/estado — avanzar etapa o cerrar proceso
router.patch('/:id/estado', async (req, res) => {
  const { estado, etapa_actual } = req.body

  const updates = []
  const params  = []
  let p = 1

  if (estado) { updates.push(`estado = $${p++}`); params.push(estado) }
  if (etapa_actual !== undefined) { updates.push(`etapa_actual = $${p++}`); params.push(etapa_actual) }
  if (estado === 'completado') { updates.push(`fecha_cierre = NOW()`) }

  if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' })

  params.push(req.params.id)
  const { rows } = await query(
    `UPDATE procesos SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`,
    params
  )
  if (!rows[0]) return res.status(404).json({ error: 'Proceso no encontrado' })
  res.json(rows[0])
})

module.exports = router
