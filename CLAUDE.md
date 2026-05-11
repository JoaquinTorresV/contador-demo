# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Proyecto

Sistema de automatización para estudios contables — jqsystem.  
Demo funcional + plantilla reutilizable. Cada cliente nuevo recibe una copia configurada con su nombre, servicios y precios.

---

## Comandos

```bash
# API (Express — puerto 3001)
npm run dev:api

# Bot (Baileys — se conecta a WhatsApp via QR)
npm run dev:bot

# Panel del contador (Next.js — puerto 3002)
cd panel && npm run dev

# Portal cliente empresa (Next.js — puerto 3003)
cd portal && npm run dev

# Migrar base de datos
npm run db:migrate
```

Copiar `.env.example` a `.env` y completar las variables antes de correr cualquier servicio.

---

## Arquitectura

El sistema tiene cuatro procesos independientes que se comunican entre sí:

```
WhatsApp ←→ bot/         (Baileys + IA)
               ↓ HTTP
            api/          (Express — fuente de verdad)
               ↓ HTTP
panel/         ↓          portal/
(Next.js)      ↓          (Next.js)
            db/ (PostgreSQL)
```

**`bot/`** — proceso Node.js separado. Recibe mensajes de WhatsApp via Baileys, decide qué flow ejecutar, llama a la IA si es necesario, y escribe/lee datos via la API interna.

**`api/`** — Express REST API. Única fuente de verdad para datos. El bot, el panel y el portal consumen esta API. Puerto 3001.

**`panel/`** — Next.js App Router. Interfaz del contador. Puerto 3002.

**`portal/`** — Next.js App Router. Interfaz de clientes empresa (largo plazo). Puerto 3003.

---

## Flujo de decisión del bot (crítico)

```
Mensaje entrante
  ↓
¿Es imagen o PDF?
  SÍ → guardar documento siempre, notificar API → si bot inactivo: silencio
  NO ↓
¿bot_activo = false para este número?
  SÍ → silencio absoluto (el contador está respondiendo manualmente)
  NO ↓
Buscar cliente por telefono en DB (identificador principal)
  No encontrado → flow preventa (si módulo activo)
  Encontrado → cargar contexto (nombre, proceso activo, etapa)
    ↓
Determinar módulo: preventa | onboarding | consulta_proceso
Módulo inactivo → silencio (nunca "no disponible")
```

---

## Capa de IA (`bot/ai/`)

`conversation.js` exporta una interfaz unificada. El proveedor se elige con `AI_PROVIDER` en `.env`:

```js
const { chat } = require('./conversation')
const result = await chat(messages, tools, context)
// result = { text: string, toolCalls: [] }
```

Proveedores disponibles: `gemini` (demo), `openai`, `claude`.

**Anti-alucinación**: el bot nunca inventa datos. Para responder sobre procesos o clientes, usa tool calls que consultan la DB via API. Si el tool no retorna datos, responde "No tengo esa información disponible."

Tools disponibles para la IA:
- `obtener_cliente(telefono)` 
- `obtener_proceso(cliente_id)`
- `obtener_documentos(proceso_id)`

---

## Identificadores de cliente en DB

- `telefono` — UNIQUE NOT NULL — filtro principal en cada mensaje entrante
- `rut` — UNIQUE — verificación de identidad y fallback

---

## Configuración por cliente

Todo lo que varía entre clientes vive en `config/`:

| Archivo | Qué configura |
|---------|--------------|
| `services.json` | Servicios ofrecidos, precios fijos/variables, preguntas de calificación |
| `onboarding.json` | Pasos del flujo de onboarding (configurable por estudio) |
| `bot-modes.json` | Módulos activos por defecto al crear un cliente nuevo |

Los módulos activos por cliente se almacenan en `clientes.modulos_activos JSONB` en la DB y se gestionan desde el panel.

---

## Lifecycle de documentos

Archivos físicos en `uploads/`. Al cerrar un proceso, se programa limpieza automática a los 30 días via `node-cron`. La metadata en DB se conserva siempre. En producción reemplazar storage local por S3.

---

## Seguridad — reglas fijas

- SQL siempre parametrizado (`$1, $2...`), nunca concatenado
- Cada empresa del portal solo puede ver sus propios datos — validar `empresa_id` en cada query
- Archivos servidos solo con validación de ownership, nunca por path directo
- JWT secret mínimo 32 chars (generar con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

---

## Vulnerabilidad conocida

`protobufjs` crítico en dependencia transitiva `@whiskeysockets/baileys → libsignal-node`. No parcheable sin romper Baileys. Monitorear releases de Baileys. No es explotable directamente en este contexto de uso.
