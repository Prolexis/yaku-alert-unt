# RESULTADOS DE PRUEBAS Y REGRESIÓN FINAL — YAKU ALERT UNT

> **Fecha de ejecución:** 24 de noviembre de 2026  
> **Entorno verificado:** Windows (PowerShell), Python 3.11.9 (`pytest 8.0.0`), Node.js v22.19.0 / Vite 5.4.21, Playwright (`playwright-core` sobre Microsoft Edge headless), Docker Compose (`yaku-alert-backend`, `yaku-alert-frontend`).  
> **Política de evidencia:** Todos los resultados y capturas listados fueron ejecutados y comprobados directamente sobre el sistema en ejecución (`http://127.0.0.1:8080`).

---

## 1. Resumen ejecutivo de regresión final

| Capa / Prueba | Herramienta / Comando | Resultado | Evidencia |
|---|---|---|---|
| **Build de producción Frontend** | `cd frontend; npm run build` | **APROBADO** | 1598 módulos transformados, sin errores de compilación. |
| **Suite Backend (rigor + API + condiciones)** | `cd backend; python -m pytest -q` | **43 / 43 APROBADAS** | 26 pruebas en `test_api.py` + 17 en `test_conditions.py` (0 fallos). |
| **Despliegue Docker Compose** | `docker compose up -d --build frontend` | **APROBADO** | `yaku-alert-backend` (`:8000`, healthy) y `yaku-alert-frontend` (`:8080`, operativo). |
| **Endpoints principales y modo offline** | `curl.exe` contra `http://127.0.0.1:8080` | **5 / 5 HTTP 200** | `/`, `/api/health`, `/api/conditions`, `/api/weather?offline=true`, `/api/preventive/evaluate?offline=true&conditions=quebrada_san_ildefonso`. |
| **Flujo E2E completo (10 pasos + responsive + offline)** | Playwright (`e2e_verify.mjs`) | **12 / 12 APROBADOS** | 0 errores de página (`pageerror`), 0 peticiones API fallidas, 11 capturas reales en `docs/evidencias/`. |

---

## 2. Defecto detectado durante la validación E2E y corrección aplicada

- **Hallazgo real:** En `frontend/src/components/ui/YakuAssistantDrawer.jsx`, el normalizador de consultas no eliminaba signos de interrogación (`¿`, `?`) ni artículos tras prefijos conversacionales (`"¿Dónde está el Comedor Universitario?"` dejaba `"¿donde esta el comedor universitario?"`), lo que impedía encontrar `Comedor Universitario` al pulsar el botón rápido. Además, la consulta de clima leía `liveEvaluation?.level_label` en lugar de `humanPreventiveTitle(liveEvaluation.preventive_level, false)`.
- **Corrección aplicada:** Se limpió puntuación y prefijos/artículos en `YakuAssistantDrawer.jsx` (añadiendo respaldo por coincidencia de tokens) y se corrigió la etiqueta de nivel preventivo con `humanPreventiveTitle`.
- **Re-verificación:** Tras reconstruir el contenedor `frontend`, la prueba Playwright E2E consultó `"¿Dónde está el Comedor Universitario?"`, encontró `"Comedor Universitario"`, navegó directamente a Leaflet y centró el edificio (`docs/evidencias/03_asistente_yaku.png` y `docs/evidencias/04_mapa_leaflet.png`).

---

## 3. Resultados detallados del flujo E2E (Playwright)

| Paso | Verificación ejecutada | Resultado | Detalle observado | Captura real |
|---|---|---|---|---|
| **1** | Abrir YAKU ALERT (`http://127.0.0.1:8080`) | **PASS** | Dashboard cargado con título `Condiciones en la UNT`. | `docs/evidencias/01_dashboard.png` |
| **2** | Consultar pronóstico meteorológico (Dashboard + Monitoreo) | **PASS** | Fuente `Open-Meteo`, sello `Pronóstico, no medición local`, hora Lima y gráficas 24 h / 48 h. | `docs/evidencias/02_monitoreo.png` |
| **3** | Abrir Asistente YAKU | **PASS** | Panel lateral abierto con aviso `Guía informativa offline · No reemplaza alertas oficiales`. | `docs/evidencias/03_asistente_yaku.png` |
| **4** | Buscar `Comedor Universitario` en Asistente YAKU | **PASS** | Consulta `"¿Dónde está el Comedor Universitario?"` encontró `Comedor Universitario (Comedor y servicios · Referencial)` con aclaración de rigor. | `docs/evidencias/03_asistente_yaku.png` |
| **5–6** | Seleccionar instalación y abrir directamente en Leaflet | **PASS** | Navegación directa a `Mapa UNT`, contenedor Leaflet activo y popup centrado en `Comedor Universitario (way/1034573626)`. | `docs/evidencias/04_mapa_leaflet.png` |
| **7** | Ejecutar Escenario C en Simulaciones | **PASS** | Banner `MODO SIMULACIÓN — DATOS SINTÉTICOS` visible y conteo de exposición geométrica Shapely desplegado. | `docs/evidencias/05_escenario_c.png` |
| **8** | Conservar estado y consultar exposición geométrica | **PASS** | Al volver a `Mapa UNT` se conserva el contexto de escenario e instalación seleccionada. | `docs/evidencias/06_mapa_con_escenario_c.png` |
| **9** | Ficha preventiva explicable + condiciones externas manuales | **PASS** | Ficha `QUÉ/DÓNDE/CUÁNDO/QUÉ HACER/QUIÉN INFORMA`, reglas desplegables, 3 checkboxes manuales con texto `No provienen de sensores` y recálculo inmediato al activar `Quebrada San Ildefonso activada` (`1 activa(s)`). | `docs/evidencias/07_prevencion_ficha.png`, `docs/evidencias/08_prevencion_condiciones_manuales.png` |
| **10** | Consultar orientaciones y descargar boletín offline | **PASS** | Descarga exitosa de `yaku-alert-boletin-pronostico.html` y vista `Continuidad` operativa con canales oficiales. | `docs/evidencias/09_continuidad.png` |
| **11** | Prueba responsive móvil (`390×844`) | **PASS** | Cero desbordamiento horizontal (`scrollWidth <= innerWidth`), menú móvil y tarjetas apiladas correctamente. | `docs/evidencias/10_mobile_responsive.png` |
| **12** | Modo offline desde UI | **PASS** | Activación del respaldo en caché local claramente señalizado en la interfaz. | `docs/evidencias/11_modo_offline.png` |

---

## 4. Auditoría de seguridad y rigor científico (verificada en UI y código)

| Requisito de rigor | Estado | Evidencia concreta |
|---|---|---|
| Condiciones externas manuales no aparecen como mediciones reales | **CUMPLIDO** | `PreventionView.jsx` muestra explícitamente `"declaración manual sí/no"` y `"No provienen de sensores: marca una condición solo si existe reporte verificado en calles o quebradas."` (`08_prevencion_condiciones_manuales.png`). |
| Simulaciones claramente identificadas | **CUMPLIDO** | Banner persistente `"MODO SIMULACIÓN — DATOS SINTÉTICOS: Escenario demostrativo; no representa una alerta real"`, badge `Simulación` en header y etiquetas `SINTÉTICO` en el mapa (`04_mapa_leaflet.png`). |
| Porcentajes de exposición provienen de Shapely | **CUMPLIDO** | Cálculo geométrico en `backend/app/services/spatial.py` verificado por `test_spatial_analysis_inside_and_outside_zones` en `backend/tests/test_api.py` y citado en `DÓNDE` como `Exposición espacial (Shapely)`. |
| No se declaran edificios seguros ni peligrosos | **CUMPLIDO** | El Asistente YAKU aclara explícitamente `"(esto no garantiza seguridad real)"` y la UI reporta intersección geométrica o `"Información no disponible"`. |
| No se emiten alertas oficiales ficticias | **CUMPLIDO** | `QUIÉN INFORMA` declara `"Prototipo informativo YAKU ALERT — UNT (TRL 3–4). No sustituye avisos oficiales de SENAMHI, INDECI, COEN ni Defensa Civil UNT."` |
| No se alteran cálculos meteorológicos ni GIS ni se afirma que la lluvia cambie polígonos | **CUMPLIDO** | `test_ui_and_docs_never_claim_rain_changes_hazard_polygons` (PASSED) y suite completa de 43 pruebas backend. |
| Fichas indican fuente, fecha, vigencia y limitaciones | **CUMPLIDO** | Bloques `CUÁNDO`, `QUIÉN INFORMA` y sección `Fuentes, incertidumbre y límites` en `PreventionView.jsx` y `DashboardView.jsx`. |

---

## 5. Observaciones menores y pendientes reales

- **Aviso menor de consola en navegador:** Se observó 1 solicitud `404` para `/favicon.ico` (sin impacto funcional ni en API; `pageerror = 0`, `failed_api_requests = 0`).
- **Pendiente fuera del código:** Aplicar el formulario en blanco de 5 tareas (`DEMO_JURADO.md`) con 5–10 estudiantes reales de la UNT para documentar la validación de campo antes de la final.
