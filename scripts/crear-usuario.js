require('dotenv').config()
const bcrypt  = require('bcryptjs')
const { query } = require('../db/connection')

async function main() {
  const hash = await bcrypt.hash('demo1234', 10)
  await query(
    'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4)',
    ['Contador Demo', 'demo@estudio.cl', hash, 'contador']
  )
  console.log('✓ Usuario creado: demo@estudio.cl / demo1234')
  process.exit(0)
}

main().catch(e => { console.error('✗', e.message); process.exit(1) })
