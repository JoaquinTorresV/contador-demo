const { chat } = require('../ai/conversation')

async function manejar(sock, msg, telefono, texto, cliente, session, sessions) {
  const jid        = msg.key.remoteJid
  const studioName = process.env.STUDIO_NAME || 'el estudio'

  if (!session.estadoHistory) session.estadoHistory = []
  sessions[telefono] = session

  const systemPrompt = `Eres el asistente de ${studioName} en WhatsApp. El cliente ${cliente.nombre} ya tiene un proceso activo.
Usa las herramientas para consultar datos reales cuando el cliente pregunte por su trámite o proceso.
Si el cliente solo saluda, agradece o hace comentarios sociales, responde de forma breve y natural SIN consultar herramientas.
Solo consulta herramientas cuando el cliente pregunta explícitamente por el estado, avance o etapa de su trámite.
Solo texto plano, sin markdown.`

  session.estadoHistory.push({
    role: 'user',
    content: `Cliente: ${cliente.nombre} (id: ${cliente.id}). Mensaje: "${texto}"`,
  })

  try {
    const respuesta = await chat(session.estadoHistory, { cliente_id: cliente.id, systemPrompt })
    session.estadoHistory.push({ role: 'assistant', content: respuesta })
    await sock.sendMessage(jid, { text: respuesta })
  } catch (err) {
    console.error('[estado] Error:', err.message)
    await sock.sendMessage(jid, {
      text: 'Tuve un problema consultando tu información. Por favor intenta más tarde.',
    })
  }
}

module.exports = { manejar }
