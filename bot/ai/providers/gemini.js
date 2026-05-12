const { GoogleGenAI } = require('@google/genai')

let ai = null
function getClient() {
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  return ai
}

async function chat(messages, tools, systemPrompt) {
  const client = getClient()

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const config = { systemInstruction: systemPrompt }

  if (tools.length) {
    config.tools = [{ functionDeclarations: tools.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    })) }]
  }

  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config,
  })

  const toolCalls = (response.functionCalls || []).map(fc => ({
    name: fc.name,
    args: fc.args,
  }))

  return {
    text: response.text || '',
    toolCalls,
  }
}

module.exports = { chat }
