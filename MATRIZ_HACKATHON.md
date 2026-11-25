# MATRIZ DE CUMPLIMIENTO — HACKATHON INNOVA NORTE 3G 2026

> **Desafío:** Desafío 03 — Gestión de riesgos y desastres ante el Fenómeno El Niño  
> **Piloto funcional:** Ciudad Universitaria — Universidad Nacional de Trujillo (UNT)  
> **Transparencia:** Esta matriz diferencia estrictamente (a) requisitos oficiales de las bases, (b) recomendaciones de las capacitaciones/ponentes y (c) propuestas propias del equipo. **No se incluyen encuestas ni validaciones ficticias.**

---

## 1. Matriz de cumplimiento por criterio de rúbrica

| Criterio (Peso) | Origen | Requisito / Expectativa | Evidencia existente en el repositorio | Deficiencia detectada | Mejora aplicada / planificada | Prioridad |
|---|---|---|---|---|---|---|
| **1. Problema y usuario (15 pts)** | Bases oficiales | Resolver una necesidad concreta ante el Fenómeno El Niño para un usuario definido (comunidad UNT). | `docs/DESIGN_THINKING_Y_VIABILIDAD.md`, `backend/app/data/eventos_referencia.json`, `evidencia_inundacion.json`, vistas orientadas a estudiantes/docentes/autoridades. | Falta evidencia primaria de entrevistas o encuestas reales aplicadas en campus UNT. | Se preparó protocolo de validación de campo (`DEMO_JURADO.md`) sin fabricar resultados; ejecutar con estudiantes antes de la final. | **P0** (campo) |
| **2. Propuesta de valor e innovación (15 pts)** | Bases + Ponentes | Diferenciación clara frente a reportes genéricos: información hiperlocal, trazable y comprensible. | Motor preventivo explicable (sin caja negra), cruce espacial real Shapely sobre edificios OSM de la UNT, buscador «Explora tu campus», comparador A/B/C y Asistente YAKU offline. | La función de condiciones externas declarables existía en backend (`/api/conditions`) pero estaba oculta para el usuario final. | **Resuelto:** Conectado `/api/conditions` a `PreventionView.jsx` + agregado Asistente YAKU determinístico offline. | **P0 / P1** (resuelto) |
| **3. Funcionalidad y demostración (25 pts)** | Bases oficiales | Prototipo funcional, estable, demostrable en vivo incluso con escenarios sintéticos identificados y tolerante a fallos de red. | Stack completo Docker Compose (`:8080` y `:8000`), 7 endpoints REST, 6 vistas React + Leaflet, caché offline (`backend/app/data/open_meteo_fallback.json`), boletín HTML descargable offline, 43 tests `pytest` pasando. | Riesgo de red en vivo durante la demo si falla internet externo. | Modo offline comprobado (`?offline=true`), caché local, modo vectorial del mapa y boletín sin dependencias externas. | **P0** (verificado) |
| **4. Validación y aprendizaje (15 pts)** | Bases + Ponentes | Demostrar iteraciones, pruebas técnicas y validación con usuarios reales. | Historial de commits verificables, 43 pruebas automatizadas (`pytest`), corrección de nombres oficiales de facultades UNT (`unitru.edu.pe`), depuración de red IPv4 y Docker. | **Brecha real:** Aún no se ejecutan pruebas de usabilidad registradas con estudiantes reales de la UNT. | Aplicar la guía de prueba de 5 tareas de `DEMO_JURADO.md` con 5–10 estudiantes UNT y documentar hallazgos reales antes de la final del 27/11. | **P0** (pendiente humano) |
| **5. Viabilidad, impacto y sostenibilidad (15 pts)** | Bases + Ponentes | Operación sostenible con bajo costo, escalabilidad progresiva (piloto UNT → Trujillo/región) y arquitectura mantenible. | Stack 100% open-source (FastAPI, React, Leaflet, OpenStreetMap, Open-Meteo, DEM Copernicus GLO-30), cero licencias privativas, despliegue reproducible en Docker Compose, análisis en `docs/DESIGN_THINKING_Y_VIABILIDAD.md`. | Falta convenio o validación formal con la Oficina de Defensa Civil / Gestión del Riesgo de la UNT. | Presentar piloto funcional a autoridades UNT como siguiente paso post-hackathon (no prometer acuerdos inexistentes). | **P1** (post-demo) |
| **6. Seguridad, ética y límites (10 pts)** | Bases oficiales | No suplantar entidades oficiales (SINAGERD), no generar pánico, proteger privacidad (Ley N.° 29733) y transparentar límites técnicos. | Sin login ni captura de GPS/PII; avisos explícitos en todas las vistas y boletines; test automatizado `test_ui_and_docs_never_claim_rain_changes_hazard_polygons` en `backend/tests/test_api.py` que impide afirmaciones científicamente falsas; prohibición de etiquetar edificios como "seguros" o "peligrosos". | El asistente conversacional podría generar riesgos si usara un LLM abierto. | El Asistente YAKU fue diseñado 100% determinístico y basado exclusivamente en datos verificados del sistema. | **P0** (verificado) |
| **7. Pitch y comunicación (5 pts)** | Bases + Ponentes | Presentación clara, narrativa problema → solución → demo → impacto en tiempo acotado. | `pitch/YAKU_ALERT_UNT_PITCH.pptx` (7 diapositivas) + nuevo guion de demostración de 90 segundos en `DEMO_JURADO.md`. | Requiere ensayo cronometrado con la interfaz actualizada (incluyendo condiciones externas y Asistente YAKU). | Ensayar el recorrido exacto de 90 s documentado en `DEMO_JURADO.md`. | **P1** |

---

## 2. Evaluación por etapas de innovación

| Etapa | Estado real | Evidencia concreta | Qué falta para cerrarla al 100% |
|---|---|---|---|
| **1. COMPRENDER** | Avanzada (85%) | Contexto documentado del Fenómeno El Niño en Trujillo, Quebrada San Ildefonso, eventos históricos (`eventos_referencia.json`) y verificación oficial de facultades en `unitru.edu.pe`. | Incorporar citas o hallazgos reales de entrevistas con estudiantes/personal de la UNT. |
| **2. DEFINIR** | Completa (95%) | Alcance acotado a Ciudad Universitaria UNT, arquitectura explicable, límites legales/científicos claros y separación estricta entre pronóstico y simulación. | Validar umbrales preventivos con el comité universitario de gestión de riesgos. |
| **3. PROTOTIPAR** | Completa (95%) | Sistema full-stack operativo en Docker con 7 endpoints, 6 vistas, GIS real con Shapely, buscador universal, comparador A/B/C, condiciones externas declarables, boletín offline y Asistente YAKU. | Pruebas manuales finales en dispositivos móviles reales. |
| **4. VALIDAR** | Parcial (50%) | **Validación técnica completa** (43 tests `pytest`, `vite build`, verificación Docker y modo offline). **Validación con usuarios reales: pendiente.** | Ejecutar pruebas de usabilidad con estudiantes reales de la UNT (sin inventar datos) y registrar sus observaciones. |

---

## 3. Autoevaluación honesta (Fase Virtual — 55 pts / Final — 100 pts)

- **Fortalezas comprobables:** Prototipo real y desplegable en Docker, rigor científico verificado por pruebas automatizadas, cero humo técnico, diferenciación real con análisis espacial Shapely + motor explicable + modo offline integral.
- **Principal riesgo competitivo:** La ausencia temporal de evidencia de **validación con usuarios reales de la UNT** (impacta el criterio de *Validación y aprendizaje* en la fase final). Se entrega un protocolo listo para aplicar en campo antes del 27 de noviembre.
