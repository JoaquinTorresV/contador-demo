const { query }    = require('../../db/connection')
const { sessions } = require('../state')
const preventa     = require('../flows/preventa')
const onboarding   = require('../flows/onboarding')
const documentos   = require('../flows/documentos')
const estado       = require('../flows/estado')

function getPhoneFromMsg(msg) {
  // jid formato: 56912345678@s.whatsapp.net
  return msg.key.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')
}

function getMsgType(msg) {
  const m = msg.message
  if (m.imageMessage)    return 'imagen'
  if (m.documentMessage) return 'documento'
  if (m.audioMessage)    return 'audio'
  if (m.videoMessage)    return 'video'
  return 'texto'
}

function getMsgText(msg) {
  const m = msg.message
  return m.conversation
    || m.extendedTextMessage?.text
    || m.imageMessage?.caption
    || m.documentMessage?.caption
    || ''
}

async function messageHandler(sock, msg) {
  try {
    const telefono = getPhoneFromMsg(msg)
    const tipo     = getMsgType(msg)
    const texto    = getMsgText(msg).trim()

    // Documentos: siempre se procesan, sin importar estado del bot
    if (tipo === 'imagen' || tipo === 'documento') {
      await documentos.procesar(sock, msg, telefono)
      return
    }

    // Buscar cliente en DB por teléfono (identificador principal)
    const { rows } = await query(
      'SELECT id, nombre, bot_activo, modulos_activos, tipo FROM clientes WHERE telefono = $1',
      [telefono]
    )
    const cliente = rows[0] || null
    const session = sessions[telefono] || {}

    // Onboarding tiene prioridad — puede estar en curso antes de que el cliente exista en DB
    if (session.flow === 'onboarding') {
      await onboarding.manejar(sock, msg, telefono, texto, session, sessions, cliente)
      return
    }

    // Bot desactivado para este cliente → silencio absoluto
    if (cliente && !cliente.bot_activo) return

    // Cliente no registrado → flow pre-venta
    if (!cliente) {
      const modulos = require('../../config/bot-modes.json').defaults.modulos
      if (!modulos.preventa) return
      await preventa.manejar(sock, msg, telefono, texto, session, sessions)
      return
    }

    const modulos = cliente.modulos_activos

    // Detectar intent principal por texto
    const textoLower = texto.toLowerCase()
    const esConsulta = textoLower.includes('estado') || textoLower.includes('trámite')
      || textoLower.includes('tramite') || textoLower.includes('proceso')
      || textoLower.includes('cómo va') || textoLower.includes('como va')
      || textoLower.includes('declaración') || textoLower.includes('declaracion')

    if (esConsulta && modulos.consulta_proceso) {
      await estado.manejar(sock, msg, telefono, texto, cliente, session, sessions)
      return
    }

    // Cualquier otro mensaje de cliente registrado → respuesta general via IA
    if (modulos.consulta_proceso) {
      await estado.manejar(sock, msg, telefono, texto, cliente, session, sessions)
    }
    // Si ningún módulo aplica → silencio
  } catch (err) {
    console.error('[bot] Error procesando mensaje:', err.message)
  }
}

module.exports = messageHandler
