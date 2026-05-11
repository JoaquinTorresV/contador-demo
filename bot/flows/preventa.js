const { query } = require('../../db/connection')
const { chat }  = require('../ai/conversation')
const services  = require('../../config/services.json')

function buildServicesContext() {
  return services.services.map(s => {
    const precio = s.precio_tipo === 'fijo'
      ? `$${s.precio.toLocaleString('es-CL')} CLP`
      : `Desde $${s.precio_desde.toLocaleString('es-CL')} CLP (precio variable según necesidad)`
    return `- ${s.nombre}: ${s.descripcion}. Precio: ${precio}. Tiempo estimado: ${s.duracion_estimada}.`
  }).join('\n')
}

// Estado de recolección de datos para ticket de precio variable
const ticketSessions = {}

async function manejar(sock, msg, telefono, texto, session, sessions) {
  const jid = msg.key.remoteJid

  // Si estamos recolectando datos para un ticket de precio variable
  if (ticketSessions[telefono]) {
    return await continuarRecoleccionTicket(sock, jid, telefono, texto)
  }

  // IA maneja la conversación con contexto de servicios
  const servicesContext = buildServicesContext()
  const studioName = process.env.STUDIO_NAME || 'el estudio'

  const messages = [
    {
      role: 'user',
      content: `Contexto de servicios disponibles:\n${servicesContext}\n\nMensaje del cliente: ${texto}

Si el cliente pregunta por un servicio de precio variable (contabilidad completa o asesoría tributaria),
responde que necesitas algunos datos para darte un precio exacto y pregúntale su nombre para empezar.
Si el cliente quiere continuar, indica que vas a generar una consulta para el equipo.`,
    },
  ]

  const respuesta = await chat(messages)

  // Detectar si la respuesta indica inicio de recolección para ticket
  const iniciaTicket = texto.toLowerCase().includes('sí') || texto.toLowerCase().includes('si')
    || texto.toLowerCase().includes('claro') || texto.toLowerCase().includes('quiero')

  if (iniciaTicket && (texto.toLowerCase().includes('contabilidad') || texto.toLowerCase().includes('asesor'))) {
    ticketSessions[telefono] = { paso: 'nombre', data: { telefono, servicio_consultado: 'contabilidad_completa' } }
    await sock.sendMessage(jid, { text: `Perfecto. Para darte el precio más preciso necesito algunos datos.\n\n¿Cuál es tu nombre?` })
    return
  }

  await sock.sendMessage(jid, { text: respuesta })
}

async function continuarRecoleccionTicket(sock, jid, telefono, texto) {
  const ts = ticketSessions[telefono]

  if (ts.paso === 'nombre') {
    ts.data.nombre = texto
    ts.paso = 'necesidad'
    await sock.sendMessage(jid, { text: `Gracias ${texto}. ¿Qué necesitas específicamente? (por ejemplo: declaraciones mensuales, liquidaciones de sueldo, contabilidad completa, etc.)` })
    return
  }

  if (ts.paso === 'necesidad') {
    ts.data.necesidad = texto
    ts.paso = 'trabajadores'
    await sock.sendMessage(jid, { text: `¿Tienes trabajadores con contrato en tu empresa?` })
    return
  }

  if (ts.paso === 'trabajadores') {
    ts.data.trabajadores = texto
    ts.paso = 'completado'

    // Crear ticket en DB
    await query(
      `INSERT INTO tickets (nombre, telefono, servicio_consultado, info_recopilada, estado)
       VALUES ($1, $2, $3, $4, 'pendiente')`,
      [ts.data.nombre, telefono, ts.data.servicio_consultado, JSON.stringify({
        necesidad: ts.data.necesidad,
        trabajadores: ts.data.trabajadores,
      })]
    )

    delete ticketSessions[telefono]
    await sock.sendMessage(jid, {
      text: `Listo ${ts.data.nombre} 👍 Hemos registrado tu consulta. El equipo del estudio revisará tu caso y te contactará pronto con una propuesta personalizada.`,
    })
  }
}

module.exports = { manejar }
