const router    = require('express').Router()
const auth      = require('../middleware/auth')
const { query } = require('../../db/connection')

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

  if (etapas.length) {
    for (let i = 0; i < etapas.length; i++) {
      await query(
        'INSERT INTO etapas (proceso_id, nombre, orden) VALUES ($1, $2, $3)',
        [proceso.id, etapas[i], i + 1]
      )
    }
  }

  res.status(201).json(proceso)
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
