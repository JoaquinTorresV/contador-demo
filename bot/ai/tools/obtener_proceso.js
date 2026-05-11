const { query } = require('../../../db/connection')

const definition = {
  name: 'obtener_proceso',
  description: 'Obtiene el proceso activo del cliente con sus etapas',
  parameters: {
    type: 'object',
    properties: {
      cliente_id: { type: 'number', description: 'ID del cliente' },
    },
    required: ['cliente_id'],
  },
}

async function execute({ cliente_id }) {
  const procesoRes = await query(
    `SELECT p.id, p.tipo, p.estado, p.etapa_actual, p.total_etapas, p.fecha_estimada
     FROM procesos p
     WHERE p.cliente_id = $1 AND p.estado NOT IN ('completado','cancelado')
     ORDER BY p.fecha_inicio DESC LIMIT 1`,
    [cliente_id]
  )

  const proceso = procesoRes.rows[0]
  if (!proceso) return null

  const etapasRes = await query(
    'SELECT nombre, estado, orden FROM etapas WHERE proceso_id = $1 ORDER BY orden',
    [proceso.id]
  )

  return { ...proceso, etapas: etapasRes.rows }
}

module.exports = { definition, execute }
