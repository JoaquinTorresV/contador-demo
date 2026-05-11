require('dotenv').config()
const { connectToWhatsApp } = require('./client')

console.log('[bot] Iniciando...')
connectToWhatsApp().catch(err => {
  console.error('[bot] Error fatal:', err.message)
  process.exit(1)
})
