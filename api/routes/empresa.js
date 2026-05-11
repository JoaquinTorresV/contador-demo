const router    = require('express').Router()
const auth      = require('../middleware/auth')
const { query } = require('../../db/connection')

router.use(auth)

function checkEmpresa(req, res, next) {
  if (req.user.rol !== 'empresa') return res.status(403).json({ error: 'Solo acceso empresa' })
  next()
}

// GET /api/empresa/dashboard
router.get('/dashboard', checkEmpresa, async (req, res) => {
  const clienteId = req.user.id

  const [procesosRes, docsRes] = await Promise.all([
    query(
      `SELECT id, tipo, estado, etapa_actual, total_etapas, fecha_estimada
       FROM procesos WHERE cliente_id = $1 AND estado NOT IN ('completado','cancelado')`,
      [clienteId]
    ),
    query(
      `SELECT COUNT(*) as pendientes FROM documentos
       WHERE cliente_id = $1 AND eliminado_en IS NULL AND direccion = 'entrante'
       AND fecha_recibido > NOW() - INTERVAL '7 days'`,
      [clienteId]
    ),
  ])

  res.json({
    procesos_activos: procesosRes.rows,
    documentos_recientes: parseInt(docsRes.rows[0].pendientes),
  })
})

// GET /api/empresa/procesos
router.get('/procesos', checkEmpresa, async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM procesos WHERE cliente_id = $1 ORDER BY fecha_inicio DESC',
    [req.user.id]
  )
  res.json(rows)
})

// GET /api/empresa/procesos/:id
router.get('/procesos/:id', checkEmpresa, async (req, res) => {
  const procesoRes = await query(
    'SELECT * FROM procesos WHERE id = $1 AND cliente_id = $2',
    [req.params.id, req.user.id]
  )
  if (!procesoRes.rows[0]) return res.status(404).json({ error: 'Proceso no encontrado' })

  const etapasRes = await query(
    'SELECT * FROM etapas WHERE proceso_id = $1 ORDER BY orden',
    [req.params.id]
  )
  res.json({ ...procesoRes.rows[0], etapas: etapasRes.rows })
})

// GET /api/empresa/archivos
router.get('/archivos', checkEmpresa, async (req, res) => {
  const { rows } = await query(
    `SELECT id, nombre_original, tipo_doc, direccion, fecha_recibido
     FROM documentos WHERE cliente_id = $1 AND eliminado_en IS NULL
     ORDER BY fecha_recibido DESC`,
    [req.user.id]
  )
  res.json(rows)
})

// GET /api/empresa/historial
router.get('/historial', checkEmpresa, async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM procesos WHERE cliente_id = $1 AND estado IN ('completado','cancelado')
     ORDER BY fecha_cierre DESC`,
    [req.user.id]
  )
  res.json(rows)
})

module.exports = router
