const Anthropic = require('@anthropic-ai/sdk')

let client = null
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return client
}

async function chat(messages, tools, systemPrompt) {
  const anthropic = getClient()

  const params = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  }

  if (tools.length) {
    params.tools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }))
  }

  const response = await anthropic.messages.create(params)

  const toolCalls = []
  let text = ''

  for (const block of response.content) {
    if (block.type === 'text') text += block.text
    if (block.type === 'tool_use') {
      toolCalls.push({ name: block.name, args: block.input })
    }
  }

  return { text, toolCalls }
}

module.exports = { chat }
