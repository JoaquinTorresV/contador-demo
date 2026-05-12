const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const { query } = require('../../db/connection')

// POST /api/auth/login — contador o empresa
router.post('/login', async (req, res) => {
  const { email, rut, password } = req.body

  if (!password) return res.status(400).json({ error: 'Contraseña requerida' })

  try {
    let user, rol

    if (email) {
      const { rows } = await query('SELECT * FROM usuarios WHERE email = $1', [email])
      user = rows[0]
      rol  = 'contador'
    } else if (rut) {
      const rutNorm = rut.replace(/\./g, '').replace(/-/g, '').toLowerCase()
      const { rows } = await query(
        `SELECT * FROM clientes WHERE LOWER(REPLACE(REPLACE(rut,'.',''),'-','')) = $1`,
        [rutNorm]
      )
      user = rows[0]
      rol  = 'empresa'
    }

    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' })

    let valid = false
    if (user.password_hash) {
      valid = await bcrypt.compare(password, user.password_hash)
    } else if (rol === 'empresa') {
      // Sin contraseña configurada → últimos 4 dígitos del teléfono (demo)
      valid = password === (user.telefono || '').slice(-4)
    }
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' })

    const token = jwt.sign(
      { id: user.id, rol, nombre: user.nombre },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    )

    res.json({ token, nombre: user.nombre, rol })
  } catch (err) {
    console.error('[auth] login error:', err.message)
    res.status(500).json({ error: 'Error interno' })
  }
})

module.exports = router
