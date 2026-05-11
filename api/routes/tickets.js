const router    = require('express').Router()
const auth      = require('../middleware/auth')
const { query } = require('../../db/connection')

router.use(auth)

// GET /api/tickets
router.get('/', async (req, res) => {
  const { estado } = req.query
  const params = []
  let sql = 'SELECT * FROM tickets'
  if (estado) { sql += ' WHERE estado = $1'; params.push(estado) }
  sql += ' ORDER BY fecha_creacion DESC'
  const { rows } = await query(sql, params)
  res.json(rows)
})

// GET /api/tickets/:id
router.get('/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM tickets WHERE id = $1', [req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'Ticket no encontrado' })
  res.json(rows[0])
})

// PATCH /api/tickets/:id/estado — aprobar o rechazar
router.patch('/:id/estado', async (req, res) => {
  const { estado } = req.body
  const validos = ['aprobado', 'rechazado']
  if (!validos.includes(estado)) return res.status(400).json({ error: 'Estado debe ser aprobado o rechazado' })

  const { rows } = await query(
    `UPDATE tickets SET estado = $1, contador_id = $2, fecha_resolucion = NOW()
     WHERE id = $3 RETURNING *`,
    [estado, req.user.id, req.params.id]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Ticket no encontrado' })
  res.json(rows[0])
})

module.exports = router
