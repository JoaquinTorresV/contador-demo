# Implementation Plan — contador-demo
**Estado:** aprobado  
**Fecha:** 2026-05-11

---

## Fases y orden de construcción

### Fase 1 — Fundación del proyecto
**Objetivo:** proyecto inicializado, dependencias instaladas, DB lista

Comandos de inicialización:
```bash
npm init -y
npm install express@latest pg@latest bcryptjs@latest jsonwebtoken@latest
npm install multer@latest dotenv@latest node-cron@latest cors@latest
npm install @google/generative-ai@latest openai@latest @anthropic-ai/sdk@latest
npm install @whiskeysockets/baileys@latest
npm install -D nodemon@latest
```

Archivos a crear:
- `package.json` — scripts: start, dev, db:migrate
- `.env.example` — todas las variables documentadas
- `CLAUDE.md` — documentación del proyecto
- `db/schema.sql` — schema completo
- `db/connection.js` — pool PostgreSQL
- `config/services.json` — servicios y precios del estudio (demo)
- `config/onboarding.json` — flujo de onboarding configurable
- `config/bot-modes.json` — modos activos por defecto

---

### Fase 2 — Bot base (Baileys)
**Objetivo:** bot conectado a WhatsApp, recibiendo mensajes

Archivos:
- `bot/client.js` — instancia Baileys, QR, reconexión automática
- `bot/handlers/message.handler.js` — enruta mensaje al flow correcto
- `bot/index.js` — entrada del bot

Lógica del message handler:
```
1. ¿Es imagen/PDF? → siempre procesar documento (independiente del estado del bot)
2. ¿Bot activo para este número? → NO: silencio
3. Buscar cliente por teléfono en DB
4. Determinar módulo activo que aplica
5. Enrutar al flow correspondiente
```

---

### Fase 3 — Capa de IA multi-proveedor
**Objetivo:** interfaz unificada para Gemini / OpenAI / Claude con tool use

Archivos:
- `bot/ai/providers/gemini.js`
- `bot/ai/providers/openai.js`
- `bot/ai/providers/claude.js`
- `bot/ai/tools/obtener_cliente.js`
- `bot/ai/tools/obtener_proceso.js`
- `bot/ai/tools/obtener_documentos.js`
- `bot/ai/conversation.js` — interfaz unificada, selecciona proveedor por env

Interfaz unificada:
```js
// conversation.js exporta:
async function chat(messages, tools, context) → { text, toolCalls }
```

System prompt base (anti-alucinación):
```
Eres el asistente del Estudio Contable [NOMBRE].
REGLA CRÍTICA: Solo puedes responder con datos que obtengas de las herramientas disponibles.
Nunca inventes números, fechas, estados ni nombres.
Si no tienes el dato, di: "No tengo esa información disponible."
Responde siempre en español, de forma breve y clara.
```

---

### Fase 4 — Flows del bot
**Objetivo:** los 4 módulos conversacionales funcionando

Archivos:
- `bot/flows/preventa.js` — M0: FAQ + precios + ticket potencial cliente
- `bot/flows/onboarding.js` — M1: lee onboarding.json, guía paso a paso
- `bot/flows/documentos.js` — M2: recibe doc, guarda, notifica contador
- `bot/flows/estado.js` — M3: tool call → respuesta con datos reales

Estado de sesión por número (en memoria para demo, Redis para producción):
```js
sessions = {
  "56912345678": {
    flow: "onboarding",
    step: 2,
    data: { nombre: "María", rut: null }
  }
}
```

---

### Fase 5 — API Express
**Objetivo:** endpoints REST que consumen panel, portal y bot

Archivos:
- `api/index.js` — Express app, middlewares globales
- `api/middleware/auth.js` — verificar JWT
- `api/middleware/upload.js` — multer para archivos
- `api/routes/auth.js` — POST /login (contador y empresa)
- `api/routes/clientes.js` — CRUD clientes + toggle bot/módulos
- `api/routes/tickets.js` — GET/PATCH tickets potenciales
- `api/routes/procesos.js` — CRUD procesos + etapas
- `api/routes/archivos.js` — upload/download documentos
- `api/routes/empresa.js` — endpoints del portal empresa

Endpoints críticos:
```
POST   /api/auth/login
GET    /api/clientes
GET    /api/clientes/:id
PATCH  /api/clientes/:id/bot          ← toggle bot on/off
PATCH  /api/clientes/:id/modulos      ← toggle módulos individuales
GET    /api/tickets
PATCH  /api/tickets/:id/estado        ← aprobar/rechazar potencial cliente
GET    /api/procesos/:clienteId
POST   /api/procesos
PATCH  /api/procesos/:id/estado
POST   /api/archivos/upload
GET    /api/archivos/:procesoId
GET    /api/empresa/:id/dashboard
```

---

### Fase 6 — Panel del contador (Next.js)
**Objetivo:** interfaz web para el contador

Páginas:
```
/login
/dashboard         ← clientes activos, tickets, alertas
/tickets           ← potenciales clientes, aprobar/rechazar
/tickets/[id]
/clientes          ← lista
/clientes/[id]     ← ficha, docs, historial, toggle bot/módulos
/procesos/nuevo
/procesos/[id]
```

Stack interno:
- Next.js App Router @latest
- Tailwind CSS @latest
- Fetch nativo a la API Express

---

### Fase 7 — Portal cliente empresa (Next.js)
**Objetivo:** interfaz web para clientes empresa largo plazo

Páginas:
```
/login
/dashboard
/procesos
/procesos/[id]
/requisitos
/archivos
/calendario
/historial
```

---

### Fase 8 — Security review
- Variables de entorno nunca en código
- JWT secret fuerte (mínimo 32 chars)
- Rate limiting en login y upload
- Cada empresa solo ve sus datos (validación por empresa_id)
- Archivos servidos con validación de ownership
- SQL parametrizado (nunca concatenado)
- OWASP checklist básica

---

## Estructura final de carpetas

```
contador-demo/
├── bot/
│   ├── index.js
│   ├── client.js
│   ├── flows/
│   │   ├── preventa.js
│   │   ├── onboarding.js
│   │   ├── documentos.js
│   │   └── estado.js
│   ├── handlers/
│   │   └── message.handler.js
│   └── ai/
│       ├── conversation.js
│       ├── providers/
│       │   ├── gemini.js
│       │   ├── openai.js
│       │   └── claude.js
│       └── tools/
│           ├── obtener_cliente.js
│           ├── obtener_proceso.js
│           └── obtener_documentos.js
├── api/
│   ├── index.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── clientes.js
│   │   ├── tickets.js
│   │   ├── procesos.js
│   │   ├── archivos.js
│   │   └── empresa.js
│   └── middleware/
│       ├── auth.js
│       └── upload.js
├── db/
│   ├── schema.sql
│   ├── connection.js
│   └── migrations/
├── panel/               ← Next.js app
├── portal/              ← Next.js app
├── config/
│   ├── services.json
│   ├── onboarding.json
│   └── bot-modes.json
├── uploads/
├── docs/
│   └── precios.html
├── .env.example
├── package.json
├── CLAUDE.md
├── PRD.md
└── IMPLEMENTATION_PLAN.md
```

---

## Variables de entorno (.env.example)

```env
# App
NODE_ENV=development
PORT=3001

# Base de datos
DATABASE_URL=postgresql://usuario:password@localhost:5432/contador_demo

# Auth
JWT_SECRET=cambia_esto_por_un_secreto_de_minimo_32_caracteres

# IA — elige uno para demo
AI_PROVIDER=gemini
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Estudio (configurable por cliente)
STUDIO_NAME="Estudio Contable Demo"
STUDIO_PHONE="+56912345678"

# Panel y portal
PANEL_URL=http://localhost:3002
PORTAL_URL=http://localhost:3003
```
