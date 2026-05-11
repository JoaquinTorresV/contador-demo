const { GoogleGenerativeAI } = require('@google/generative-ai')

let client = null
function getClient() {
  if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  return client
}

async function chat(messages, tools, systemPrompt) {
  const genAI = getClient()
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
    tools: tools.length ? [{ functionDeclarations: tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    })) }] : undefined,
  })

  // Convertir formato de mensajes a Gemini
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const lastMsg = messages[messages.length - 1]
  const chat = model.startChat({ history })
  const result = await chat.sendMessage(lastMsg.content)
  const response = result.response

  // Verificar tool calls
  const toolCalls = []
  const candidates = response.candidates?.[0]?.content?.parts || []
  for (const part of candidates) {
    if (part.functionCall) {
      toolCalls.push({ name: part.functionCall.name, args: part.functionCall.args })
    }
  }

  return {
    text: response.text() || '',
    toolCalls,
  }
}

module.exports = { chat }
