# PLAN DE MEJORAS — YAKU ALERT UNT

> Plan incremental ejecutado sobre el sistema existente sin reconstruir el backend ni romper contratos de API, pruebas ni rigor científico.

---

## 1. Principios de arquitectura respetados

- **Preservación de contratos:** Se mantienen intactos los 7 endpoints REST (`/api/health`, `/api/weather`, `/api/campus/layers`, `/api/preventive/evaluate`, `/api/simulate`, `/api/conditions`, `/api/protocols`) y sus esquemas Pydantic.
- **Rigor científico y legal:** Ningún componente afirma que modificar la precipitación altere las geometrías de los escenarios sintéticos, ni califica edificaciones como "seguras" o "peligrosas", ni suplanta alertas oficiales del SINAGERD.
- **Resiliencia offline:** Toda nueva capacidad funciona con datos locales o en caché cuando no hay conexión externa.

---

## 2. Mejoras implementadas

### Mejora 1 (P0): Integración completa de Condiciones Externas Declarables
- **Objetivo:** Exponer en la interfaz las condiciones externas del entorno UNT ya soportadas por el backend (`av_jesus_nazareth`, `av_juan_pablo_ii`, `quebrada_san_ildefonso`).
- **Cambios realizados:**
  1. `frontend/src/services/api.js`: Agregada `fetchConditionsCatalog()` (`GET /api/conditions`) y soporte del parámetro `conditions` en `fetchLiveEvaluation(offline, conditions)`.
  2. `frontend/src/App.jsx`: Estado `conditionsCatalog` y `declaredConditions`, carga inicial del catálogo y manejador `handleToggleDeclaredCondition` que recalcula `/api/preventive/evaluate` en vivo.
  3. `frontend/src/components/PreventionView.jsx`: Bloque interactivo de casillas en modo pronóstico en vivo con etiquetas descriptivas, conteo activo y aviso explícito de que es una declaración manual sin sensores automáticos.

### Mejora 2 (P1): Asistente YAKU determinístico 100% offline
- **Objetivo:** Brindar asistencia rápida y comprensible para consultar clima, localizar cualquier instalación del campus en Leaflet, abrir simulaciones y revisar orientaciones sin alucinaciones ni llamadas externas.
- **Cambios realizados:**
  1. `frontend/src/components/ui/YakuAssistantDrawer.jsx`: Componente flotante accesible con atajos rápidos, entrada de texto normalizada (`normalizeText`), búsqueda integrada contra `buildCampusCatalog(campusLayers)` y botones de acción (`Ver en mapa`, `Ir al simulador`, `Ver prevención`).
  2. `frontend/src/App.jsx`: Integración global del asistente con acceso al estado meteorológico, evaluación preventiva, último escenario simulado, capas del campus y navegación directa.

### Mejora 3 (P0): Auditoría integral, verificación y preparación de demostración
- **Objetivo:** Verificar compilación, 43 pruebas backend, despliegue Docker Compose y modo offline, y consolidar los 6 entregables de auditoría y demo para el jurado.
- **Entregables generados:**
  - `AUDITORIA_YAKU_ALERT.md`
  - `MATRIZ_HACKATHON.md`
  - `BRECHAS_PRIORIZADAS.md`
  - `PLAN_MEJORAS.md`
  - `RESULTADOS_PRUEBAS.md`
  - `DEMO_JURADO.md`

---

## 3. Verificación planificada

1. `npm run build` en `frontend/` (sin errores de sintaxis ni bundle).
2. `python -m pytest -v` en `backend/` (43 pruebas pasando, incluyendo rigor científico y condiciones externas).
3. Reconstrucción del contenedor `frontend` en Docker Compose (`docker compose up -d --build frontend`).
4. Comprobación HTTP en vivo sobre `http://127.0.0.1:8080/` y proxy `/api/*` (`/api/health`, `/api/conditions`, `/api/weather?offline=true`, `/api/preventive/evaluate?offline=true&conditions=quebrada_san_ildefonso`).
