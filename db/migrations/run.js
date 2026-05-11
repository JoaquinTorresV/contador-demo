require('dotenv').config()
const { pool } = require('../connection')
const fs = require('fs')
const path = require('path')

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8')
  try {
    await pool.query(schema)
    console.log('✓ Migración completada')
  } catch (err) {
    console.error('✗ Error en migración:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

migrate()
