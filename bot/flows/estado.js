const { chat } = require('../ai/conversation')

async function manejar(sock, msg, telefono, texto, cliente) {
  const jid = msg.key.remoteJid

  const messages = [
    {
      role: 'user',
      content: `El cliente ${cliente.nombre} (teléfono: ${telefono}, id: ${cliente.id}) pregunta: "${texto}"
Usa las herramientas disponibles para obtener información real antes de responder.
Busca su proceso activo y responde con datos precisos.`,
    },
  ]

  try {
    const respuesta = await chat(messages, { cliente_id: cliente.id })
    await sock.sendMessage(jid, { text: respuesta })
  } catch (err) {
    console.error('[estado] Error:', err.message)
    await sock.sendMessage(jid, {
      text: 'Tuve un problema al consultar tu información. Por favor intenta más tarde o contacta directamente al estudio.',
    })
  }
}

module.exports = { manejar }
