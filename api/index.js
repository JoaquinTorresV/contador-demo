require('dotenv').config()
const express = require('express')
const cors    = require('cors')

const app = express()

app.use(cors({ origin: [
  process.env.PANEL_URL || 'http://localhost:3002',
  process.env.PORTAL_URL || 'http://localhost:3003',
]}))
app.use(express.json())

// Rutas
app.use('/api/auth',    require('./routes/auth'))
app.use('/api/clientes', require('./routes/clientes'))
app.use('/api/tickets',  require('./routes/tickets'))
app.use('/api/procesos', require('./routes/procesos'))
app.use('/api/archivos', require('./routes/archivos'))
app.use('/api/empresa',  require('./routes/empresa'))

// Notificación interna (bot → panel) — solo localhost
app.post('/api/internal/notify-document', (req, res) => {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) {
    return res.status(403).end()
  }
  console.log('[api] Documento recibido de cliente:', req.body.cliente_id)
  res.json({ ok: true })
})

app.use((err, req, res, next) => {
  console.error('[api] Error:', err.message)
  res.status(500).json({ error: 'Error interno del servidor' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`[api] Corriendo en http://localhost:${PORT}`))
