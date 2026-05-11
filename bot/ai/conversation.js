require('dotenv').config()
const obtenerCliente    = require('./tools/obtener_cliente')
const obtenerProceso    = require('./tools/obtener_proceso')
const obtenerDocumentos = require('./tools/obtener_documentos')

const TOOLS = [obtenerCliente, obtenerProceso, obtenerDocumentos]

const TOOL_MAP = {
  obtener_cliente:    obtenerCliente.execute,
  obtener_proceso:    obtenerProceso.execute,
  obtener_documentos: obtenerDocumentos.execute,
}

function getProvider() {
  const provider = process.env.AI_PROVIDER || 'gemini'
  return require(`./providers/${provider}`)
}

function buildSystemPrompt() {
  const studioName = process.env.STUDIO_NAME || 'el Estudio Contable'
  return `Eres el asistente de ${studioName} en WhatsApp.
REGLA CRÍTICA: Solo puedes responder con datos que obtengas de las herramientas disponibles.
Nunca inventes números, fechas, estados ni nombres.
Si no tienes el dato, responde exactamente: "No tengo esa información disponible. Te recomiendo contactar directamente al estudio."
Responde siempre en español. Sé breve, claro y amable.
No uses markdown, solo texto plano.`
}

// chat — interfaz unificada para todos los providers
// Maneja el loop de tool use automáticamente
async function chat(messages, context = {}) {
  const provider   = getProvider()
  const systemPrompt = buildSystemPrompt()
  const toolDefs   = TOOLS.map(t => t.definition)

  let currentMessages = [...messages]
  let iterations = 0
  const MAX_ITERATIONS = 5

  while (iterations < MAX_ITERATIONS) {
    iterations++
    const result = await provider.chat(currentMessages, toolDefs, systemPrompt)

    // Sin tool calls → respuesta final
    if (!result.toolCalls || result.toolCalls.length === 0) {
      return result.text
    }

    // Ejecutar cada tool call y agregar resultados al contexto
    for (const tc of result.toolCalls) {
      const fn = TOOL_MAP[tc.name]
      const toolResult = fn ? await fn(tc.args) : null

      currentMessages.push({
        role: 'assistant',
        content: `[tool_call: ${tc.name}]`,
      })
      currentMessages.push({
        role: 'user',
        content: `[tool_result: ${tc.name}] ${JSON.stringify(toolResult)}`,
      })
    }
  }

  return 'No tengo esa información disponible. Te recomiendo contactar directamente al estudio.'
}

module.exports = { chat }
