const router    = require('express').Router()
const auth      = require('../middleware/auth')
const upload    = require('../middleware/upload')
const { query } = require('../../db/connection')
const path      = require('path')
const fs        = require('fs')

router.use(auth)

// POST /api/archivos/upload
router.post('/upload', upload.single('archivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido' })

  const { cliente_id, proceso_id, tipo_doc = 'otro', direccion = 'saliente' } = req.body
  if (!cliente_id) return res.status(400).json({ error: 'cliente_id requerido' })

  const { rows } = await query(
    `INSERT INTO documentos (cliente_id, proceso_id, nombre, nombre_original, path, tipo_mime, tipo_doc, direccion)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, nombre, fecha_recibido`,
    [
      cliente_id,
      proceso_id || null,
      req.file.filename,
      req.file.originalname,
      req.file.path,
      req.file.mimetype,
      tipo_doc,
      direccion,
    ]
  )
  res.status(201).json(rows[0])
})

// GET /api/archivos/:procesoId — listar documentos de un proceso
router.get('/:procesoId', async (req, res) => {
  const { rows } = await query(
    `SELECT id, nombre, nombre_original, tipo_doc, direccion, fecha_recibido, eliminado_en
     FROM documentos WHERE proceso_id = $1 ORDER BY fecha_recibido DESC`,
    [req.params.procesoId]
  )
  res.json(rows)
})

// GET /api/archivos/descargar/:id — descarga con validación de ownership
router.get('/descargar/:id', async (req, res) => {
  const { rows } = await query(
    'SELECT d.*, c.contador_id FROM documentos d JOIN clientes c ON c.id = d.cliente_id WHERE d.id = $1',
    [req.params.id]
  )
  const doc = rows[0]
  if (!doc) return res.status(404).json({ error: 'Archivo no encontrado' })
  if (doc.eliminado_en) return res.status(410).json({ error: 'Archivo eliminado' })

  // Solo el contador dueño del cliente puede descargar
  if (req.user.rol === 'contador' && doc.contador_id !== req.user.id) {
    return res.status(403).json({ error: 'Sin acceso' })
  }

  if (!fs.existsSync(doc.path)) return res.status(404).json({ error: 'Archivo no encontrado en disco' })
  res.download(doc.path, doc.nombre_original || doc.nombre)
})

module.exports = router
