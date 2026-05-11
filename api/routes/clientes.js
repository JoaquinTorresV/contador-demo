const router    = require('express').Router()
const auth      = require('../middleware/auth')
const { query } = require('../../db/connection')

router.use(auth)

// GET /api/clientes
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT id, nombre, telefono, rut, tipo, nombre_empresa, estado, bot_activo, modulos_activos, fecha_registro
     FROM clientes ORDER BY fecha_registro DESC`
  )
  res.json(rows)
})

// GET /api/clientes/:id
router.get('/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM clientes WHERE id = $1', [req.params.id])
  if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' })
  res.json(rows[0])
})

// PATCH /api/clientes/:id/bot — toggle bot on/off
router.patch('/:id/bot', async (req, res) => {
  const { activo } = req.body
  if (typeof activo !== 'boolean') return res.status(400).json({ error: 'Campo activo requerido (boolean)' })

  const { rows } = await query(
    'UPDATE clientes SET bot_activo = $1 WHERE id = $2 RETURNING id, bot_activo',
    [activo, req.params.id]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' })
  res.json(rows[0])
})

// PATCH /api/clientes/:id/modulos — toggle módulos individuales
router.patch('/:id/modulos', async (req, res) => {
  const { modulos } = req.body
  if (!modulos || typeof modulos !== 'object') return res.status(400).json({ error: 'Objeto modulos requerido' })

  const { rows } = await query(
    `UPDATE clientes
     SET modulos_activos = modulos_activos || $1::jsonb
     WHERE id = $2
     RETURNING id, modulos_activos`,
    [JSON.stringify(modulos), req.params.id]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' })
  res.json(rows[0])
})

// DELETE /api/clientes/:id — desactivar (no eliminar físicamente)
router.delete('/:id', async (req, res) => {
  await query('UPDATE clientes SET estado = $1 WHERE id = $2', ['inactivo', req.params.id])
  res.json({ ok: true })
})

module.exports = router
