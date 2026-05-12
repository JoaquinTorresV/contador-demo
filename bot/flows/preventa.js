const { query } = require('../../db/connection')
const { chat }  = require('../ai/conversation')
const services  = require('../../config/services.json')

function buildServicesContext() {
  return services.services.map(s => {
    const precio = s.precio_tipo === 'fijo'
      ? `$${s.precio.toLocaleString('es-CL')} CLP`
      : `Desde $${s.precio_desde.toLocaleString('es-CL')} CLP (precio variable según necesidad)`
    return `- ${s.nombre} [id:${s.id}]: ${s.descripcion}. Precio: ${precio}. Tiempo estimado: ${s.duracion_estimada}.`
  }).join('\n')
}

// Sesiones de recolección de datos para tickets
const ticketSessions = {}

async function manejar(sock, msg, telefono, texto, session, sessions) {
  const jid = msg.key.remoteJid

  // Recolección de datos en curso
  if (ticketSessions[telefono]) {
    return await continuarRecoleccionTicket(sock, jid, telefono, texto, session)
  }

  if (!session.history) session.history = []
  sessions[telefono] = session

  const servicesContext = buildServicesContext()
  const studioName = process.env.STUDIO_NAME || 'el estudio'

  const systemPrompt = `Eres el asistente de ventas de ${studioName} en WhatsApp. Amable, breve y profesional.
Servicios disponibles:
${servicesContext}

Reglas estrictas:
- Si el cliente saluda sin preguntar algo concreto, responde con un saludo breve y pregunta en qué puedes ayudarle. NO listes todos los servicios automáticamente.
- Lista los servicios solo si el cliente lo pide explícitamente o dice que no sabe qué necesita.
- Si ya hay conversación previa, continúa sin presentarte de nuevo.
- NUNCA inventes teléfonos, correos ni contactos.
- Responde SIEMPRE preguntas sobre documentos, precios, plazos antes de intentar cerrar la venta.
- Cuando el cliente confirme que QUIERE CONTRATAR un servicio específico, responde ÚNICAMENTE con: INICIO_TICKET:[id del servicio]. Ejemplo: INICIO_TICKET:declaracion_renta
- Para servicios de precio variable (contabilidad_completa, asesoria_tributaria), cuando muestren interés claro, responde INICIO_TICKET:[id] igualmente.
- Solo texto plano, sin markdown.`

  session.history.push({ role: 'user', content: texto })
  const respuesta = await chat(session.history, { noTools: true, systemPrompt })
  session.history.push({ role: 'assistant', content: respuesta })

  // Detectar marcador de inicio de ticket
  if (respuesta.startsWith('INICIO_TICKET:')) {
    const servicioId = respuesta.replace('INICIO_TICKET:', '').trim()
    const esVariable = ['contabilidad_completa', 'asesoria_tributaria'].includes(servicioId)
    ticketSessions[telefono] = {
      paso: 'nombre',
      data: { telefono, servicio_consultado: servicioId, esVariable },
      history: [...session.history],
    }
    await sock.sendMessage(jid, { text: '¡Perfecto! Para registrar tu consulta, ¿cuál es tu nombre?' })
    return
  }

  await sock.sendMessage(jid, { text: respuesta })
}

function esConsulta(texto) {
  if (texto.includes('?')) return true
  const palabras = texto.trim().split(/\s+/)
  if (palabras.length > 6) return true
  const iniciosConsulta = ['que', 'qué', 'cuanto', 'cuánto', 'como', 'cómo', 'cuales', 'cuáles', 'cuando', 'cuándo', 'donde', 'dónde', 'necesito', 'quiero saber', 'puedo', 'hay']
  const primeraPalabra = palabras[0].toLowerCase()
  return iniciosConsulta.includes(primeraPalabra)
}

async function continuarRecoleccionTicket(sock, jid, telefono, texto, session) {
  const ts = ticketSessions[telefono]

  if (ts.paso === 'nombre') {
    // Si el usuario hace una pregunta en vez de dar su nombre, responder y volver a pedir
    if (esConsulta(texto)) {
      const servicio = services.services.find(s => s.id === ts.data.servicio_consultado)
      const systemCtx = `El cliente está a punto de registrar una consulta para "${servicio?.nombre || ts.data.servicio_consultado}". Responde brevemente su pregunta. Al final de tu respuesta, pídele su nombre para completar el registro. Solo texto plano, sin markdown.`
      if (!ts.history) ts.history = []
      ts.history.push({ role: 'user', content: texto })
      const respuesta = await chat(ts.history, { noTools: true, systemPrompt: systemCtx })
      ts.history.push({ role: 'assistant', content: respuesta })
      await sock.sendMessage(jid, { text: respuesta })
      return
    }

    ts.data.nombre = texto
    ts.paso = ts.data.esVariable ? 'necesidad' : 'completado'

    if (ts.data.esVariable) {
      await sock.sendMessage(jid, { text: `Gracias ${texto}. ¿Qué necesitas específicamente? (liquidaciones, declaraciones mensuales, contabilidad completa, etc.)` })
    } else {
      await guardarTicketYResponder(sock, jid, telefono, ts)
    }
    return
  }

  if (ts.paso === 'necesidad') {
    ts.data.necesidad = texto
    ts.paso = 'trabajadores'
    await sock.sendMessage(jid, { text: '¿Tienes trabajadores con contrato en tu empresa?' })
    return
  }

  if (ts.paso === 'trabajadores') {
    ts.data.trabajadores = texto
    ts.paso = 'completado'
    await guardarTicketYResponder(sock, jid, telefono, ts)
  }
}

async function guardarTicketYResponder(sock, jid, telefono, ts) {
  await query(
    `INSERT INTO tickets (nombre, telefono, servicio_consultado, info_recopilada, estado)
     VALUES ($1, $2, $3, $4, 'pendiente')`,
    [
      ts.data.nombre,
      telefono,
      ts.data.servicio_consultado,
      JSON.stringify({
        necesidad: ts.data.necesidad || null,
        trabajadores: ts.data.trabajadores || null,
      }),
    ]
  )
  delete ticketSessions[telefono]
  await sock.sendMessage(jid, {
    text: `Listo ${ts.data.nombre} ✓ Hemos registrado tu consulta. El equipo te contactará pronto.`,
  })
}

module.exports = { manejar }
