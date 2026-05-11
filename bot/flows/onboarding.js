const { query }  = require('../../db/connection')
const services   = require('../../config/services.json')
let onboardingConfig

function getConfig() {
  if (!onboardingConfig) onboardingConfig = require('../../config/onboarding.json')
  return onboardingConfig
}

function getServiceNames() {
  return services.services.map((s, i) => `${i + 1}. ${s.nombre}`).join('\n')
}

function evaluarCondicion(condicion, data) {
  if (!condicion) return true
  return data[condicion.campo] === condicion.valor
}

function getPasoActual(steps, stepIndex, data) {
  // Avanzar saltando pasos con condición no cumplida
  while (stepIndex < steps.length && !evaluarCondicion(steps[stepIndex].condicion, data)) {
    stepIndex++
  }
  return stepIndex
}

async function manejar(sock, msg, telefono, texto, session, sessions, cliente = null) {
  const jid    = msg.key.remoteJid
  const config = getConfig()
  const steps  = config.steps

  // Inicio de onboarding
  if (!session.flow) {
    sessions[telefono] = { flow: 'onboarding', step: 0, data: {} }
    const step = steps[0]
    await sock.sendMessage(jid, { text: `Para comenzar necesito algunos datos.\n\n${step.pregunta}` })
    return
  }

  const data      = session.data
  let stepIndex   = session.step
  const stepActual = steps[stepIndex]

  // Validación básica
  if (stepActual.requerido && !texto) {
    await sock.sendMessage(jid, { text: 'Por favor responde la pregunta para continuar.' })
    return
  }

  if (stepActual.tipo === 'rut') {
    // Validación básica de formato RUT chileno
    const rutLimpio = texto.replace(/\./g, '').replace(/-/g, '').toLowerCase()
    if (rutLimpio.length < 7) {
      await sock.sendMessage(jid, { text: 'El RUT ingresado no parece válido. Ingrésalo así: 12.345.678-9' })
      return
    }
  }

  if (stepActual.tipo === 'opciones') {
    const opciones = stepActual.opciones
    const seleccion = opciones.find((o, i) => texto === o || texto === String(i + 1))
    if (!seleccion) {
      const lista = opciones.map((o, i) => `${i + 1}. ${o}`).join('\n')
      await sock.sendMessage(jid, { text: `Por favor elige una opción:\n${lista}` })
      return
    }
    data[stepActual.id] = seleccion
  } else if (stepActual.tipo === 'opciones_servicios') {
    const idx = parseInt(texto) - 1
    if (isNaN(idx) || !services.services[idx]) {
      await sock.sendMessage(jid, { text: `Elige un número:\n${getServiceNames()}` })
      return
    }
    data[stepActual.id] = services.services[idx].id
  } else {
    data[stepActual.id] = texto
  }

  // Avanzar al siguiente paso válido
  stepIndex++
  stepIndex = getPasoActual(steps, stepIndex, data)
  sessions[telefono].step = stepIndex
  sessions[telefono].data = data

  // Onboarding completado
  if (stepIndex >= steps.length) {
    await completarOnboarding(sock, jid, telefono, data, sessions)
    return
  }

  // Siguiente pregunta
  const siguiente = steps[stepIndex]
  let pregunta = siguiente.pregunta

  if (siguiente.tipo === 'opciones') {
    const lista = siguiente.opciones.map((o, i) => `${i + 1}. ${o}`).join('\n')
    pregunta += `\n\n${lista}`
  }

  if (siguiente.tipo === 'opciones_servicios') {
    pregunta += `\n\n${getServiceNames()}`
  }

  await sock.sendMessage(jid, { text: pregunta })
}

async function completarOnboarding(sock, jid, telefono, data, sessions) {
  const tipo         = data.es_empresa === 'Para una empresa' ? 'empresa' : 'individual'
  const nombreEmpresa = data.nombre_empresa || null

  await query(
    `INSERT INTO clientes (telefono, nombre, rut, email, tipo, nombre_empresa, modulos_activos)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (telefono) DO UPDATE
     SET nombre = $2, rut = $3, email = $4, tipo = $5, nombre_empresa = $6`,
    [
      telefono,
      data.nombre,
      data.rut || null,
      data.email || null,
      tipo,
      nombreEmpresa,
      JSON.stringify({ preventa: true, onboarding: true, consulta_proceso: true, notificaciones: true }),
    ]
  )

  delete sessions[telefono]

  await sock.sendMessage(jid, {
    text: `¡Listo ${data.nombre}! 🎉 Tus datos han sido registrados. Pronto el equipo del estudio se pondrá en contacto contigo para coordinar tu trámite de ${data.servicio || 'tu solicitud'}.`,
  })
}

module.exports = { manejar }
