const multer = require('multer')
const path   = require('path')
const fs     = require('fs')

const UPLOADS_PATH = process.env.UPLOADS_PATH || path.join(__dirname, '../../uploads')

if (!fs.existsSync(UPLOADS_PATH)) fs.mkdirSync(UPLOADS_PATH, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_PATH),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname)
    const safe = `${Date.now()}_${req.user?.id || 'anon'}${ext}`
    cb(null, safe)
  },
})

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'application/pdf', 'image/webp']
  allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Tipo de archivo no permitido'))
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
})

module.exports = upload
