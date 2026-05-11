# PRD — contador-demo
**Proyecto:** Sistema de automatización para estudios contables  
**Tipo:** Demo jqsystem + Plantilla reutilizable para clientes  
**Fecha:** 2026-05-11  
**Estado:** v3 — pendiente aprobación

---

## 1. Problema

Los estudios contables manejan dos tipos de clientes:

- **Corto plazo** — procesos de 1 día a 1 semana (declaración de renta, IVA puntual, trámite específico). Alta rotación, poco margen para seguimiento manual.
- **Largo plazo** — empresas con contabilidad externalizada completa. Relación continua, múltiples procesos en paralelo, necesitan visibilidad.

**Dolores del contador:**
- Documentos que llegan por WhatsApp, email y papel mezclados
- Clientes que no mandan documentos a tiempo
- Seguimiento manual de vencimientos
- Tiempo perdido respondiendo preguntas repetitivas

**Dolores del cliente:**
- No sabe en qué estado va su trámite
- Nadie le avisa de vencimientos — se entera con multa
- El contador no comunica errores ni avances
- Para procesos cortos el servicio se siente lento y poco claro

---

## 2. Objetivo del proyecto

Construir un sistema que cumpla dos propósitos:

1. **Demo funcional** — para mostrar en reuniones con contadores y cerrar ventas
2. **Plantilla base reutilizable** — para adaptar y desplegar en cada cliente de jqsystem con mínima configuración

Cada cliente nuevo recibe una copia del template con su branding, sus servicios y sus precios configurados.

---

## 3. Usuarios

| Usuario | Descripción |
|---------|-------------|
| Contador / admin | Administra el sistema, gestiona clientes y procesos |
| Potencial cliente | Persona que pregunta por servicios antes de contratar |
| Cliente individual | Persona natural con trámite corto plazo |
| Cliente empresa | Empresa con contabilidad externalizada (largo plazo) |

---

## 4. Módulos

### M0 — Pre-venta (bot WhatsApp)
Primera interacción antes de cualquier onboarding. El bot actúa como recepcionista:
- Saluda y pregunta en qué puede ayudar
- Responde preguntas sobre servicios disponibles
- Si el precio es **fijo** → lo dice directamente
- Si el precio es **variable** → hace preguntas (nombre, qué necesita, tipo de empresa, volumen) y genera un **ticket de potencial cliente** en el panel
- El contador revisa el ticket y aprueba/rechaza desde el panel
- Solo si el contador aprueba, el bot continúa al onboarding

### M1 — Onboarding (bot WhatsApp)
Activado tras aprobación del contador:
- Recopila datos del cliente (nombre, RUT, email, tipo de trámite)
- Crea ficha del cliente en la base de datos
- Informa al cliente qué documentos necesita subir

### M2 — Gestión de documentos (bot WhatsApp)
- El cliente manda foto/PDF por WhatsApp
- El sistema registra, clasifica y almacena el documento
- Avisa al contador que llegó documento nuevo
- Documentos se eliminan 30 días después del cierre del proceso (metadata se conserva)

### M3 — Estado del proceso (bot WhatsApp)
- El cliente pregunta "¿cómo va mi trámite?" y recibe respuesta inmediata
- El contador actualiza el estado desde el panel con un clic
- El cliente recibe notificación automática al cambiar de etapa

### M4 — Recordatorios automáticos
- Para clientes largo plazo: recordatorio de vencimientos tributarios
- Para clientes corto plazo: recordatorio de documentos pendientes durante el proceso activo
- Scheduler con node-cron

### M5 — Panel del contador (Next.js)
- Login con email/contraseña
- Dashboard: clientes activos, tickets potenciales, alertas de vencimiento
- Vista de ticket potencial: datos recopilados, botón aprobar/rechazar
- Vista de cliente: ficha, documentos, historial, proceso actual
- Gestión de procesos: crear, asignar etapas, marcar completado
- Actualización de estado → dispara notificación automática al cliente
- Subida de archivos de entrega al cliente

### M6 — Portal cliente empresa (Next.js) — largo plazo
Módulo independiente con su propio proyecto Next.js y PRD.
Ver detalle completo en [portal/PRD.md](portal/PRD.md)

Resumen: login empresa, dashboard de procesos, requisitos pendientes, biblioteca de archivos, calendario de vencimientos e historial. Consume la misma API Express del sistema principal.

---

## 5. Flujos principales

### Flujo pre-venta
```
Cliente escribe por primera vez
→ Bot saluda + pregunta en qué ayuda
→ Cliente pregunta por servicio o precio
   → Precio fijo → bot responde y pregunta si quiere continuar
   → Precio variable → bot recopila info → genera ticket en panel
→ Contador revisa ticket en panel → aprueba o rechaza
→ Si aprueba → bot notifica al cliente → inicia onboarding
→ Si rechaza → bot informa amablemente
```

### Flujo corto plazo
```
Onboarding completado
→ Bot pide documentos necesarios
→ Cliente sube docs por WhatsApp
→ Contador procesa, actualiza estado → notificación automática
→ Contador cierra proceso, entrega resultado
→ Bot confirma al cliente + archiva
→ 30 días después → archivos físicos eliminados, metadata conservada
```

### Flujo largo plazo
```
Contador crea cliente empresa en panel
→ Se genera acceso al portal web
→ Contador abre procesos y asigna etapas
→ Portal muestra requisitos pendientes
→ Empresa sube docs desde portal o WhatsApp
→ Contador actualiza etapas → portal refleja avance en tiempo real
→ Contador entrega resultado + cierra proceso
→ Portal archiva + 30 días → limpieza de archivos físicos
```

---

## 6. Arquitectura del chatbot (componente crítico)

El bot es la cara del sistema. Debe ser preciso — cero alucinaciones, cero datos inventados.

### 6.1 Modos del bot (activables/desactivables por cliente desde el panel)

| Modo | Qué hace | Se puede desactivar |
|------|----------|-------------------|
| **Pre-venta** | Responde preguntas de servicios y precios, genera tickets | Sí |
| **Onboarding** | Guía al cliente nuevo a registrarse | Sí |
| **Consulta de proceso** | El cliente pregunta por su trámite y el bot consulta la DB | Sí |
| **Notificaciones** | Mensajes automáticos outbound (no IA, son templates) | Sí |
| **Procesamiento de documentos** | Recibe y almacena documentos entrantes | **NO — siempre activo** |

**Regla de módulo desactivado → silencio absoluto.**
Cuando un módulo está desactivado, el bot no responde nada para los mensajes que caerían en ese módulo. No hay mensaje de "no disponible". El contador está atendiendo ese cliente manualmente — una respuesta del bot interrumpiría esa conversación.

**Excepción — documentos siempre se procesan.**
Si el bot está completamente desactivado para un cliente pero llega una imagen o PDF, el sistema igual almacena el documento y notifica al contador en el panel. El cliente no recibe respuesta. El contador ve el documento y responde él mismo.

### 6.2 Capa de IA — Multi-proveedor

El sistema soporta múltiples proveedores de IA. Se configura con una variable de entorno. Para la demo se usa Gemini (API gratuita disponible). En producción se elige según el cliente.

```
AI_PROVIDER=gemini   # demo
AI_PROVIDER=openai   # GPT-3.5-mini / GPT-4o-mini
AI_PROVIDER=claude   # Haiku
```

Todos los proveedores exponen la misma interfaz interna:
```js
aiProvider.chat(messages, tools) → response
```

### 6.3 Anti-alucinación — Tool Use obligatorio

El bot NUNCA inventa datos. Para responder sobre procesos, documentos o estados, el bot usa **function calling** (tool use) para consultar la base de datos en tiempo real. Solo puede responder con lo que la DB devuelve.

```
Cliente: "¿cuándo está lista mi declaración?"
        ↓
Bot detecta intent: consulta_proceso
        ↓
Tool call: obtener_proceso(rut=cliente.rut)
        ↓
DB devuelve: { estado: "En revisión", etapa: 2/4, fecha_estimada: "2026-05-14" }
        ↓
Bot formatea respuesta con esos datos exactos
        ↓
"Tu declaración está en revisión (etapa 2 de 4). Fecha estimada de entrega: 14 de mayo."
```

Si la DB no tiene el dato → bot responde "No tengo esa información disponible, por favor contacta directamente al estudio."

### 6.4 Identificadores del cliente en DB

El bot identifica al cliente en este orden:

1. **Teléfono** — identificador principal. Cada mensaje entrante se busca primero por número de teléfono. Es el filtro rápido y siempre disponible.
2. **RUT** — identificador secundario. Se usa para verificar identidad durante onboarding, para consultas sensibles (estado de proceso, documentos), y como fallback si hay número duplicado (ej: cliente cambió de teléfono).

```sql
-- Búsqueda principal
SELECT * FROM clientes WHERE telefono = $1

-- Verificación / fallback
SELECT * FROM clientes WHERE rut = $1
```

Una vez identificado el cliente, el bot carga su nombre, proceso activo y etapa actual. Todas las respuestas usan esos datos — el cliente siente que el bot lo conoce.

Ejemplo de personalización:
```
"Hola María 👋 Tu declaración de renta está en etapa 2 de 4 (En revisión).
Fecha estimada de entrega: 14 de mayo."
```

### 6.5 Onboarding configurable

El onboarding tiene dos modos:

**Modo predeterminado** — preguntas estándar para cualquier estudio contable:
1. Nombre completo
2. RUT
3. Email
4. Tipo de trámite que necesita

**Modo configurable** — el contador define el flujo en `config/onboarding.json`:
```json
{
  "steps": [
    { "id": "nombre", "pregunta": "¿Cuál es tu nombre completo?", "tipo": "texto", "requerido": true },
    { "id": "rut", "pregunta": "¿Cuál es tu RUT? (ej: 12.345.678-9)", "tipo": "rut", "requerido": true },
    { "id": "empresa", "pregunta": "¿Representas a una empresa?", "tipo": "opciones", "opciones": ["Sí", "No"], "requerido": true },
    { "id": "nombre_empresa", "pregunta": "¿Cuál es el nombre de la empresa?", "tipo": "texto", "requerido": false, "condicion": { "campo": "empresa", "valor": "Sí" } },
    { "id": "servicio", "pregunta": "¿Qué necesitas?", "tipo": "opciones_servicios", "requerido": true }
  ]
}
```

Cada cliente de jqsystem puede tener su propio `onboarding.json` adaptado a su nicho y sus preguntas de calificación.

### 6.6 Flujo de decisión del bot

```
Mensaje entrante
        ↓
¿Es imagen o PDF? → SÍ → Almacenar siempre + notificar contador
                          → Si bot activo: confirmar al cliente
                          → Si bot inactivo: silencio (contador responde)
        ↓ NO
¿Bot activo para este cliente?
  → NO → Silencio absoluto
  ↓ SÍ
Buscar cliente por teléfono en DB
  → Encontrado → cargar contexto (nombre, proceso, etapa)
  → No encontrado → es cliente nuevo → Modo pre-venta (si está activo)
        ↓
¿Qué módulo aplica?
  → Pre-venta: preguntas de servicio/precio
  → Onboarding: flujo configurable paso a paso
  → Consulta: tool call DB → respuesta con datos reales
  → Otro: escalar al contador (sin respuesta del bot)
```

### 6.5 Notificaciones automáticas (no IA)

Son mensajes de plantilla enviados por Baileys, disparados por eventos:
- Proceso cerrado → "Tu trámite ha sido completado. Resultado: [archivo]"
- Cambio de etapa → "Tu declaración avanzó a etapa 3: En firma"
- Vencimiento próximo → "Recuerda que el plazo para [trámite] es el [fecha]"
- Documento pendiente → "Falta subir: [lista de documentos]"

Estas notificaciones no pasan por la IA — son puras y exactas.

---

## 7. Stack técnico

| Capa | Tecnología |
|------|-----------|
| Bot WhatsApp | Node.js + Baileys |
| IA conversacional | Multi-proveedor: Gemini (demo) / OpenAI / Claude |
| Tool use / DB queries | Function calling nativo de cada proveedor |
| Workflows automáticos | n8n (recordatorios, notificaciones programadas) |
| Backend API | Node.js + Express |
| Base de datos | PostgreSQL |
| Panel contador | Next.js (App Router) |
| Portal cliente empresa | Next.js (App Router) |
| Auth | JWT + bcrypt |
| Almacenamiento archivos | Local (demo) → S3 compatible (producción) |
| Scheduler limpieza | node-cron |

---

## 8. Configuración por cliente (plantilla)

Cada despliegue para un cliente nuevo requiere configurar solo:

```env
# Identidad
CLIENT_NAME="Estudio Contable XYZ"
CLIENT_PHONE="+56912345678"

# Servicios y precios
SERVICES_CONFIG="./config/services.json"

# WhatsApp
BAILEYS_SESSION_PATH="./sessions"

# Base de datos
DATABASE_URL="postgresql://..."

# Claude
ANTHROPIC_API_KEY="..."

# n8n
N8N_WEBHOOK_URL="..."
```

`services.json` define los servicios, precios fijos/variables, y preguntas de calificación. Todo lo demás es heredado del template.

---

## 9. Lifecycle de documentos

| Estado | Archivo físico | Metadata DB |
|--------|---------------|-------------|
| Proceso activo | Almacenado | Completa |
| Proceso cerrado (< 30 días) | Almacenado | Completa |
| Proceso cerrado (> 30 días) | **Eliminado** | Conservada |
| Producción | S3 con lifecycle policy | Conservada |

---

## 10. Alcance demo

Lo que corre en la reunión:

- [x] M0 — Bot pre-venta con IA (preguntas, precios, ticket)
- [x] M1 — Onboarding por WhatsApp
- [x] M2 — Recepción de documentos
- [x] M3 — Consulta y actualización de estado
- [x] M5 — Panel del contador (dashboard + tickets + cliente)
- [ ] M4 — Recordatorios (se muestra en n8n)
- [ ] M6 — Portal empresa (se muestra mockup o se presenta como siguiente fase)

---

## 11. Lo que NO entra en esta versión

- Integración con SII
- OCR automático de documentos
- Multi-contador (varios usuarios del panel)
- Pagos en línea
- Reportes financieros

Se presentan como roadmap de la solución a medida.

---

## 12. Estructura de carpetas

```
contador-demo/
├── bot/                        # Baileys + IA multi-proveedor
│   ├── index.js
│   ├── client.js               # Instancia Baileys
│   ├── flows/
│   │   ├── preventa.js         # M0
│   │   ├── onboarding.js       # M1
│   │   ├── documentos.js       # M2
│   │   └── estado.js           # M3
│   ├── handlers/
│   │   └── message.handler.js
│   └── ai/
│       ├── providers/
│       │   ├── gemini.js
│       │   ├── openai.js
│       │   └── claude.js
│       ├── tools/              # Function calling — DB queries
│       │   ├── obtener_proceso.js
│       │   ├── obtener_documentos.js
│       │   └── obtener_cliente.js
│       └── conversation.js     # Interfaz unificada multi-proveedor
├── api/                        # Express REST API
│   ├── index.js
│   ├── routes/
│   │   ├── clientes.js
│   │   ├── tickets.js
│   │   ├── procesos.js
│   │   └── archivos.js
│   └── middleware/
│       ├── auth.js
│       └── upload.js
├── db/
│   ├── schema.sql
│   ├── migrations/
│   └── connection.js
├── panel/                      # Next.js — panel contador
│   ├── app/
│   │   ├── (auth)/
│   │   ├── dashboard/
│   │   ├── tickets/
│   │   ├── clientes/
│   │   └── procesos/
│   └── components/
├── portal/                     # Next.js — portal empresa
│   ├── app/
│   │   ├── (auth)/
│   │   ├── dashboard/
│   │   ├── documentos/
│   │   └── calendario/
│   └── components/
├── config/
│   ├── services.json           # Servicios y precios configurables por cliente
│   └── bot-modes.json          # Modos activos/inactivos por cliente
├── uploads/                    # Archivos temporales
├── .env.example
├── package.json
└── CLAUDE.md
```

---

## 13. DB Schema

```sql
-- Potenciales clientes (tickets pre-venta)
tickets (
  id, nombre, telefono, rut,
  servicio_consultado, info_recopilada,
  estado, fecha, contador_id
)

-- Clientes
-- telefono: identificador principal (INDEX UNIQUE)
-- rut: identificador secundario (INDEX UNIQUE)
clientes (
  id,
  telefono       UNIQUE NOT NULL,   -- identificador principal
  rut            UNIQUE,             -- identificador secundario
  nombre, email,
  tipo,                              -- individual | empresa
  estado,                            -- activo | inactivo
  bot_activo     BOOLEAN DEFAULT true,
  modulos_activos JSONB,             -- { preventa: true, onboarding: true, consulta: true, notificaciones: true }
  fecha_registro,
  contador_id
)

-- Procesos
procesos (id, cliente_id, tipo, estado, etapa_actual, fecha_inicio, fecha_cierre)

-- Etapas de proceso
etapas (id, proceso_id, nombre, estado, orden, fecha_completado)

-- Documentos
documentos (
  id, proceso_id, cliente_id,
  nombre, path, tipo,
  fecha_recibido,
  eliminado_en    TIMESTAMP          -- null = archivo existe, fecha = eliminado
)

-- Mensajes (log WhatsApp)
mensajes (id, cliente_id, direccion, contenido, timestamp)

-- Usuarios panel (contadores)
usuarios (id, nombre, email, password_hash, rol, fecha_creacion)

-- Configuración onboarding por instalación
-- (se lee de onboarding.json pero se puede sobreescribir en DB)
onboarding_config (id, contador_id, steps JSONB, fecha_actualizacion)
```

---

**Próximo paso:** aprobación del PRD → `implementation-plan`
