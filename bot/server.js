const express = require('express')
const state   = require('./state')

const TIPO_LABEL = {
  inicio_actividades:    'Inicio de Actividades',
  declaracion_renta:     'Declaración de Renta',
  declaracion_iva:       'Declaración IVA Mensual',
  contabilidad_completa: 'Contabilidad Completa',
  asesoria_tributaria:   'Asesoría Tributaria',
}

function buildDocsMsg(docs) {
  if (!docs || !docs.length) return null
  return `📎 Documentos que necesitas subir por este chat:\n${docs.map(d => `• ${d}`).join('\n')}`
}

function startInternalServer() {
  const app = express()
  app.use(express.json())

  // Ticket aprobado → iniciar onboarding
  app.post('/internal/start-onboarding', async (req, res) => {
    const { telefono, nombre, servicio_consultado } = req.body
    const sock = state.getSock()
    if (!telefono || !sock) return res.status(503).json({ ok: false, error: 'Bot no listo' })

    const servicioLabel = TIPO_LABEL[servicio_consultado] || servicio_consultado
    const jid            = `${telefono}@s.whatsapp.net`
    const studioName     = process.env.STUDIO_NAME || 'el estudio'

    state.sessions[telefono] = {
      flow: 'onboarding',
      step: 1,
      data: { nombre, servicio_consultado, _fromTicket: true },
    }

    await sock.sendMessage(jid, {
      text: `Hola ${nombre} 👋 El equipo de ${studioName} ha revisado y aprobado tu consulta de *${servicioLabel}*.\n\nPara comenzar el trámite necesito registrar algunos datos.\n\n¿Cuál es tu RUT? (ej: 12.345.678-9)`,
    })
    console.log(`[bot] Onboarding iniciado para ${telefono} (${nombre})`)
    res.json({ ok: true })
  })

  // Ticket rechazado → notificar cliente
  app.post('/internal/notify-rejection', async (req, res) => {
    const { telefono, nombre, servicio_consultado } = req.body
    const sock = state.getSock()
    if (!telefono || !sock) return res.status(503).json({ ok: false, error: 'Bot no listo' })

    const servicioLabel = TIPO_LABEL[servicio_consultado] || servicio_consultado
    const jid            = `${telefono}@s.whatsapp.net`
    const studioName     = process.env.STUDIO_NAME || 'el estudio'

    await sock.sendMessage(jid, {
      text: `Hola ${nombre || 'estimado/a'}, lamentablemente en esta oportunidad no podemos tomar tu solicitud de *${servicioLabel}*.\n\nTe invitamos a contactarnos directamente para evaluar otras alternativas. El equipo de ${studioName} queda a tu disposición.`,
    })
    console.log(`[bot] Notificación rechazo enviada a ${telefono}`)
    res.json({ ok: true })
  })

  // Proceso creado → notificar documentos de la primera etapa
  app.post('/internal/notify-proceso-inicio', async (req, res) => {
    const { telefono, nombre, tipo_proceso, primera_etapa, docs_requeridos } = req.body
    const sock = state.getSock()
    if (!telefono || !sock) return res.status(503).json({ ok: false, error: 'Bot no listo' })

    const tipoLabel  = TIPO_LABEL[tipo_proceso] || tipo_proceso
    const jid         = `${telefono}@s.whatsapp.net`
    const studioName  = process.env.STUDIO_NAME || 'el estudio'

    let texto = `Hola ${nombre} 👋 El equipo de ${studioName} ha iniciado tu proceso de *${tipoLabel}*.\n\nPrimera etapa: "${primera_etapa}".`

    const docsMsg = buildDocsMsg(docs_requeridos)
    if (docsMsg) texto += `\n\n${docsMsg}\n\nPuedes enviarlos directamente por este chat.`
    else texto += '\n\nTe avisaremos cuando necesitemos algo de tu parte.'

    await sock.sendMessage(jid, { text: texto })
    console.log(`[bot] Notificación inicio de proceso enviada a ${telefono}`)
    res.json({ ok: true })
  })

  // Etapa completada → notificar avance y docs de siguiente etapa
  app.post('/internal/notify-etapa', async (req, res) => {
    const { telefono, nombre, tipo_proceso, etapa_completada, siguiente_etapa, docs_siguiente, proceso_completado } = req.body
    const sock = state.getSock()
    if (!telefono || !sock) return res.status(503).json({ ok: false, error: 'Bot no listo' })

    const tipoLabel  = TIPO_LABEL[tipo_proceso] || tipo_proceso
    const jid         = `${telefono}@s.whatsapp.net`
    const studioName  = process.env.STUDIO_NAME || 'el estudio'

    let texto = `Hola ${nombre} 👋 La etapa "*${etapa_completada}*" de tu proceso de ${tipoLabel} ha sido completada.`

    if (proceso_completado) {
      texto += `\n\n✅ ¡Tu proceso ha sido completado exitosamente! El equipo de ${studioName} se pondrá en contacto contigo para los pasos finales.`
    } else if (siguiente_etapa) {
      texto += `\n\nAhora comenzamos con: "*${siguiente_etapa}*".`
      const docsMsg = buildDocsMsg(docs_siguiente)
      if (docsMsg) texto += `\n\n${docsMsg}\n\nPuedes enviarlos directamente por este chat.`
    }

    await sock.sendMessage(jid, { text: texto })
    console.log(`[bot] Notificación etapa enviada a ${telefono}`)
    res.json({ ok: true })
  })

  const PORT = process.env.BOT_INTERNAL_PORT || 3004
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`[bot] Servidor interno en localhost:${PORT}`)
  })
}

module.exports = { startInternalServer }
