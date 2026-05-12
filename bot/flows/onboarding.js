const { query } = require('../../db/connection')
let onboardingConfig

function getConfig() {
  if (!onboardingConfig) onboardingConfig = require('../../config/onboarding.json')
  return onboardingConfig
}

function evaluarCondicion(condicion, data) {
  if (!condicion) return true
  return data[condicion.campo] === condicion.valor
}

function getPasoActual(steps, stepIndex, data) {
  while (stepIndex < steps.length && !evaluarCondicion(steps[stepIndex].condicion, data)) {
    stepIndex++
  }
  return stepIndex
}

async function manejar(sock, msg, telefono, texto, session, sessions, cliente = null) {
  const jid    = msg.key.remoteJid
  const config = getConfig()
  const steps  = config.steps

  // Inicio de onboarding manual (no desde ticket)
  if (!session.flow) {
    sessions[telefono] = { flow: 'onboarding', step: 0, data: {} }
    await sock.sendMessage(jid, { text: `Para comenzar necesito algunos datos.\n\n${steps[0].pregunta}` })
    return
  }

  const data       = session.data
  let stepIndex    = session.step
  const stepActual = steps[stepIndex]

  if (stepActual.requerido && !texto) {
    await sock.sendMessage(jid, { text: 'Por favor responde la pregunta para continuar.' })
    return
  }

  if (stepActual.tipo === 'rut') {
    const rutLimpio = texto.replace(/\./g, '').replace(/-/g, '').toLowerCase()
    if (rutLimpio.length < 7) {
      await sock.sendMessage(jid, { text: 'El RUT no parece válido. Ingrésalo así: 12.345.678-9' })
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
  } else {
    data[stepActual.id] = texto
  }

  stepIndex++
  stepIndex = getPasoActual(steps, stepIndex, data)
  sessions[telefono].step = stepIndex
  sessions[telefono].data = data

  if (stepIndex >= steps.length) {
    await completarOnboarding(sock, jid, telefono, data, sessions)
    return
  }

  const siguiente = steps[stepIndex]
  let pregunta = siguiente.pregunta
  if (siguiente.tipo === 'opciones') {
    const lista = siguiente.opciones.map((o, i) => `${i + 1}. ${o}`).join('\n')
    pregunta += `\n\n${lista}`
  }

  await sock.sendMessage(jid, { text: pregunta })
}

async function completarOnboarding(sock, jid, telefono, data, sessions) {
  const tipo          = data.es_empresa === 'Para una empresa' ? 'empresa' : 'individual'
  const nombreEmpresa = data.nombre_empresa || null
  const emailVal      = (data.email || '').toLowerCase() === 'no' ? null : (data.email || null)

  await query(
    `INSERT INTO clientes (telefono, nombre, rut, email, tipo, nombre_empresa, bot_activo, modulos_activos)
     VALUES ($1, $2, $3, $4, $5, $6, false, $7)
     ON CONFLICT (telefono) DO UPDATE
     SET nombre=$2, rut=$3, email=$4, tipo=$5, nombre_empresa=$6, bot_activo=false`,
    [
      telefono,
      data.nombre,
      data.rut || null,
      emailVal,
      tipo,
      nombreEmpresa,
      JSON.stringify({ preventa: false, onboarding: false, consulta_proceso: false, notificaciones: true }),
    ]
  )

  delete sessions[telefono]

  const studioName = process.env.STUDIO_NAME || 'el estudio'
  await sock.sendMessage(jid, {
    text: `¡Listo ${data.nombre}! ✓ Tus datos han sido registrados.\n\nEl equipo de ${studioName} comenzará a trabajar en tu solicitud. Te notificaremos cuando haya avances.\n\nMétodo de pago registrado: ${data.pago_metodo || 'A convenir'}.\n\nCuando quieras consultar el estado de tu trámite, escribe aquí y te informamos.`,
  })

  console.log(`[bot] Onboarding completado: ${telefono} (${data.nombre}) — bot desactivado`)
}

module.exports = { manejar }
