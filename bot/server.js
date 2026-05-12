const express = require('express')
const state   = require('./state')

function startInternalServer() {
  const app = express()
  app.use(express.json())

  // Triggered by API when a ticket is approved
  app.post('/internal/start-onboarding', async (req, res) => {
    const { telefono, nombre, servicio_consultado } = req.body
    const sock = state.getSock()

    if (!telefono || !sock) {
      return res.status(503).json({ ok: false, error: 'Bot no listo o falta teléfono' })
    }

    const TIPO_LABEL = {
      inicio_actividades:    'Inicio de Actividades',
      declaracion_renta:     'Declaración de Renta',
      declaracion_iva:       'Declaración IVA Mensual',
      contabilidad_completa: 'Contabilidad Completa',
      asesoria_tributaria:   'Asesoría Tributaria',
    }
    const servicioLabel = TIPO_LABEL[servicio_consultado] || servicio_consultado

    const jid        = `${telefono}@s.whatsapp.net`
    const studioName = process.env.STUDIO_NAME || 'el estudio'

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

  // Notificación de etapa completada
  app.post('/internal/notify-etapa', async (req, res) => {
    const { telefono, nombre, tipo_proceso, etapa_completada, siguiente_etapa, proceso_completado } = req.body
    const sock = state.getSock()
    if (!telefono || !sock) return res.status(503).json({ ok: false, error: 'Bot no listo' })

    const tipoLabel = {
      inicio_actividades:   'Inicio de Actividades',
      declaracion_renta:    'Declaración de Renta',
      declaracion_iva:      'Declaración IVA Mensual',
      contabilidad_completa: 'Contabilidad Completa',
      asesoria_tributaria:  'Asesoría Tributaria',
    }[tipo_proceso] || tipo_proceso

    const jid        = `${telefono}@s.whatsapp.net`
    const studioName = process.env.STUDIO_NAME || 'el estudio'

    let texto = `Hola ${nombre} 👋 Te informamos que la etapa "${etapa_completada}" de tu proceso de ${tipoLabel} ha sido completada.`

    if (proceso_completado) {
      texto += `\n\n¡Tu proceso ha sido completado exitosamente! El equipo de ${studioName} se pondrá en contacto contigo para los pasos finales.`
    } else if (siguiente_etapa) {
      texto += `\n\nAhora comenzamos con la etapa: "${siguiente_etapa}".`
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
