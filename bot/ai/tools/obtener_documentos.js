const { query } = require('../../../db/connection')

const definition = {
  name: 'obtener_documentos',
  description: 'Lista los documentos pendientes de subir o recibidos del cliente',
  parameters: {
    type: 'object',
    properties: {
      cliente_id: { type: 'number', description: 'ID del cliente' },
      proceso_id: { type: 'number', description: 'ID del proceso (opcional)' },
    },
    required: ['cliente_id'],
  },
}

async function execute({ cliente_id, proceso_id }) {
  const params = [cliente_id]
  let sql = `SELECT nombre, tipo_doc, direccion, fecha_recibido
             FROM documentos
             WHERE cliente_id = $1 AND eliminado_en IS NULL`

  if (proceso_id) {
    sql += ' AND proceso_id = $2'
    params.push(proceso_id)
  }

  sql += ' ORDER BY fecha_recibido DESC LIMIT 10'

  const res = await query(sql, params)
  return res.rows
}

module.exports = { definition, execute }
