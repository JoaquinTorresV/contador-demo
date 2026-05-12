require('dotenv').config()
const { connectToWhatsApp } = require('./client')
const { startInternalServer } = require('./server')

console.log('[bot] Iniciando...')
startInternalServer()
connectToWhatsApp().catch(err => {
  console.error('[bot] Error fatal:', err.message)
  process.exit(1)
})
