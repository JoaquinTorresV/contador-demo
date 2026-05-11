const { query } = require('../../../db/connection')

const definition = {
  name: 'obtener_cliente',
  description: 'Obtiene los datos del cliente por número de teléfono o RUT',
  parameters: {
    type: 'object',
    properties: {
      telefono: { type: 'string', description: 'Número de teléfono sin +' },
      rut:      { type: 'string', description: 'RUT del cliente (opcional)' },
    },
    required: [],
  },
}

async function execute({ telefono, rut }) {
  let res
  if (telefono) {
    res = await query('SELECT id, nombre, rut, tipo, nombre_empresa, estado FROM clientes WHERE telefono = $1', [telefono])
  } else if (rut) {
    res = await query('SELECT id, nombre, rut, tipo, nombre_empresa, estado FROM clientes WHERE rut = $1', [rut])
  }
  return res?.rows[0] || null
}

module.exports = { definition, execute }
