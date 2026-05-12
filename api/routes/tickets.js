const router    = require('express').Router()
const http      = require('http')
const auth      = require('../middleware/auth')
const { query } = require('../../db/connection')

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

  const ticket = rows[0]
  if (estado === 'aprobado' && ticket.telefono) {
    notifyBot('/internal/start-onboarding', {
      telefono: ticket.telefono,
      nombre: ticket.nombre || 'Cliente',
      servicio_consultado: ticket.servicio_consultado,
    })
    console.log(`[api] Onboarding disparado para ${ticket.telefono}`)
  }

  res.json(ticket)
})

module.exports = router
