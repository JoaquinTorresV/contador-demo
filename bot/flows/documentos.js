const { query }  = require('../../db/connection')
const path       = require('path')
const fs         = require('fs')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')

const UPLOADS_PATH = process.env.UPLOADS_PATH || path.join(__dirname, '../../uploads')

async function procesar(sock, msg, telefono) {
  const jid = msg.key.remoteJid
  const m   = msg.message

  const esImagen    = !!m.imageMessage
  const esDocumento = !!m.documentMessage
  if (!esImagen && !esDocumento) return

  // Buscar cliente por teléfono para asociar el documento
  const { rows } = await query(
    'SELECT id, bot_activo FROM clientes WHERE telefono = $1',
    [telefono]
  )
  const cliente = rows[0] || null

  // Descargar archivo
  try {
    const buffer = await downloadMediaMessage(msg, 'buffer', {})
    const ext    = esImagen ? 'jpg' : (m.documentMessage?.fileName?.split('.').pop() || 'pdf')
    const nombre = `${Date.now()}_${telefono}.${ext}`
    const filePath = path.join(UPLOADS_PATH, nombre)

    if (!fs.existsSync(UPLOADS_PATH)) fs.mkdirSync(UPLOADS_PATH, { recursive: true })
    fs.writeFileSync(filePath, buffer)

    // Guardar en DB
    await query(
      `INSERT INTO documentos (cliente_id, nombre, nombre_original, path, tipo_mime, tipo_doc, direccion)
       VALUES ($1, $2, $3, $4, $5, $6, 'entrante')`,
      [
        cliente?.id || null,
        nombre,
        m.documentMessage?.fileName || `imagen_${Date.now()}.jpg`,
        filePath,
        esImagen ? 'image/jpeg' : (m.documentMessage?.mimetype || 'application/pdf'),
        esImagen ? 'otro' : 'otro',
      ]
    )

    // Notificar al contador via API interna (si hay cliente asociado)
    if (cliente?.id) {
      try {
        await fetch(`${process.env.PANEL_URL || 'http://localhost:3001'}/api/internal/notify-document`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cliente_id: cliente.id, nombre }),
        })
      } catch (_) {}
    }

    // Solo confirmar al cliente si el bot está activo
    if (cliente?.bot_activo !== false) {
      await sock.sendMessage(jid, {
        text: `Documento recibido ✓. El equipo del estudio ya fue notificado.`,
      })
    }
    // Si bot inactivo → silencio (documento igual queda guardado)
  } catch (err) {
    console.error('[documentos] Error al procesar:', err.message)
  }
}

module.exports = { procesar }
