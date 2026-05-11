const OpenAI = require('openai')

let client = null
function getClient() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

async function chat(messages, tools, systemPrompt) {
  const openai = getClient()

  const msgs = [{ role: 'system', content: systemPrompt }, ...messages]

  const params = {
    model: 'gpt-4o-mini',
    messages: msgs,
    temperature: 0.3,
  }

  if (tools.length) {
    params.tools = tools.map(t => ({ type: 'function', function: t }))
    params.tool_choice = 'auto'
  }

  const response = await openai.chat.completions.create(params)
  const choice = response.choices[0]

  const toolCalls = (choice.message.tool_calls || []).map(tc => ({
    name: tc.function.name,
    args: JSON.parse(tc.function.arguments || '{}'),
  }))

  return {
    text: choice.message.content || '',
    toolCalls,
  }
}

module.exports = { chat }
