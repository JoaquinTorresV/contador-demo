require('dotenv').config()
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const qrcode = require('qrcode-terminal')
const path = require('path')
const messageHandler = require('./handlers/message.handler')

const SESSION_PATH = path.join(__dirname, '../sessions')

async function connectToWhatsApp() {
  const { version } = await fetchLatestBaileysVersion()
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH)

  const sock = makeWASocket({
    version,
    auth: state,
    browser: ['contador-demo', 'Chrome', '1.0.0'],
    syncFullHistory: false,
  })

  require('./state').setSock(sock)

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n[bot] Escanea el QR con WhatsApp:\n')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error instanceof Boom
        ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
        : true

      console.log('[bot] Conexión cerrada —', lastDisconnect?.error?.message)

      if (shouldReconnect) {
        console.log('[bot] Reconectando en 5 segundos...')
        setTimeout(connectToWhatsApp, 5000)
      } else {
        console.log('[bot] Sesión cerrada. Elimina la carpeta sessions/ y vuelve a correr.')
      }
    }

    if (connection === 'open') {
      console.log('[bot] WhatsApp conectado ✓')
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue
      await messageHandler(sock, msg)
    }
  })

  return sock
}

module.exports = { connectToWhatsApp }
