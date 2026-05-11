# PRD — Portal Cliente Empresa
**Proyecto:** contador-demo / portal  
**Tipo:** Módulo M6 — cliente empresa largo plazo  
**API base:** Compartida con `../api/` (Express)  
**Fecha:** 2026-05-11  
**Estado:** v1 — pendiente aprobación

---

## 1. Contexto

El portal es el canal web para clientes empresa que tienen su contabilidad externalizada con el estudio. A diferencia de los clientes individuales (que usan solo WhatsApp), las empresas necesitan visibilidad estructurada y acceso a su historial completo.

Este es un módulo opcional del sistema — el contador lo activa solo para clientes de tipo largo plazo.

---

## 2. Usuarios

| Usuario | Descripción |
|---------|-------------|
| Administrador empresa | Persona de la empresa que gestiona la relación con el estudio |
| Contador | Gestiona desde el panel principal (no desde este portal) |

---

## 3. Funcionalidades

### F1 — Autenticación
- Login con RUT + contraseña
- El contador crea las credenciales desde el panel principal
- Recuperación de contraseña por email
- Sesión con JWT, expiración en 8 horas

### F2 — Dashboard
- Resumen del estado actual: procesos activos, documentos pendientes de subir, próximo vencimiento
- Alertas destacadas: documentos vencidos, procesos con acción requerida

### F3 — Procesos activos
- Lista de procesos en curso con nombre, tipo, etapa actual y porcentaje de avance
- Vista detalle de cada proceso:
  - Etapas con estado (completada / en curso / pendiente)
  - Fecha de inicio y fecha estimada de cierre
  - Documentos asociados al proceso

### F4 — Requisitos pendientes
- Lista clara de documentos que la empresa debe subir
- Cada requisito tiene: nombre, descripción, proceso al que pertenece, estado (pendiente / recibido / aprobado)
- La empresa puede subir el documento directamente desde esta vista

### F5 — Archivos
- Biblioteca de todos los documentos entregados por el contador
- Filtro por año, mes, tipo de documento
- Descarga directa
- Los archivos eliminados (post 30 días) muestran metadata pero no link de descarga

### F6 — Calendario
- Vista mensual de vencimientos tributarios
- Código de colores: verde (sin acción), amarillo (próximo), rojo (esta semana)
- Click en vencimiento muestra detalle y proceso asociado

### F7 — Historial
- Todos los procesos cerrados con sus resultados
- Filtro por año y tipo de proceso
- Descarga del resultado final de cada proceso

### F8 — Notificaciones (in-app + WhatsApp)
- Badge en el portal cuando hay algo nuevo
- Las notificaciones de WhatsApp ya vienen del bot principal
- El portal muestra el mismo historial de notificaciones

---

## 4. Lo que NO hace el portal

- No puede crear procesos (solo el contador desde el panel)
- No puede chatear con el contador (para eso está WhatsApp)
- No puede ver información de otros clientes
- No modifica datos del proceso, solo sube documentos

---

## 5. Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js (App Router) |
| Estilos | Tailwind CSS |
| Auth | JWT (mismo sistema que el panel) |
| API | Express compartida con panel y bot |
| Upload archivos | Multipart → API → storage local/S3 |

---

## 6. Páginas

```
/login                     → F1 — Autenticación
/dashboard                 → F2 — Resumen general
/procesos                  → F3 — Lista procesos activos
/procesos/[id]             → F3 — Detalle proceso
/requisitos                → F4 — Documentos pendientes
/archivos                  → F5 — Biblioteca documentos
/calendario                → F6 — Vencimientos
/historial                 → F7 — Procesos cerrados
```

---

## 7. Endpoints API que consume

```
GET  /api/empresa/:id/dashboard
GET  /api/empresa/:id/procesos
GET  /api/empresa/:id/procesos/:procesoId
GET  /api/empresa/:id/requisitos
POST /api/empresa/:id/documentos          ← subir documento
GET  /api/empresa/:id/archivos
GET  /api/empresa/:id/calendario
GET  /api/empresa/:id/historial
POST /api/auth/empresa/login
POST /api/auth/empresa/refresh
```

---

## 8. Diseño / UX

- Interfaz limpia, profesional, sin tecnicismos
- El cliente empresa no sabe de contabilidad — los textos deben ser simples
- Mobile-first: muchos usuarios lo verán desde el celular
- Colores neutros, tipografía clara, sin elementos decorativos innecesarios

---

## 9. Seguridad

- Cada empresa solo ve sus propios datos — validación por `empresa_id` en cada endpoint
- JWT firmado con secret del servidor
- Archivos servidos con URL firmada (no acceso directo al filesystem)
- Rate limiting en endpoints de login y subida de archivos
- Logs de acceso por empresa

---

## 10. Alcance en la demo

Para la reunión con contadores este portal se muestra como:
- Mockup navegable (si no está construido aún) o
- Versión funcional básica con datos de ejemplo

Se presenta como el diferencial para clientes empresa: *"Sus clientes corporativos tienen su propio panel donde ven todo en tiempo real."*

---

**Próximo paso:** aprobación → se incluye en el `implementation-plan` general
