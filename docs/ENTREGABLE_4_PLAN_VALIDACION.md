# ENTREGABLE 4 — PLAN DE VALIDACIÓN Y APRENDIZAJE
**Proyecto:** YAKU ALERT — UNT  
**Principio de integridad:** Este documento distingue estrictamente entre **pruebas técnicas ya ejecutadas** y **validación con usuarios universitarios pendiente de ejecución**. No se reportan encuestas ni métricas ficticias.

---

## 1. Pruebas Técnicas Ejecutadas (Verificadas)

**Total real:** 43 pruebas aprobadas por `python -m pytest -q`: 26 casos colectados en `backend/tests/test_api.py` y 17 casos colectados en `backend/tests/test_conditions.py`. La tabla siguiente es una muestra representativa de casos técnicos ejecutados.

| Caso de Prueba | Objetivo | Resultado Real Observado | Evidencia |
|---|---|---|---|
| `test_health_and_security_headers` | Verificar salud de API y cabeceras HTTP de seguridad | **PASSED** (`nosniff`, `DENY`, `no-referrer`) | `backend/tests/test_api.py` |
| `test_weather_live_api` | Verificar integración real con Open-Meteo API | **PASSED** (respuesta válida con serie ≥24h) | `backend/tests/test_api.py` |
| `test_weather_offline_fallback` | Verificar operación sin conexión con caché local | **PASSED** (`data_status == OFFLINE_FALLBACK`) | `backend/tests/test_api.py` |
| `test_invalid_weather_payload_raises` | Verificar rechazo de JSON meteorológico inválido | **PASSED** (`ValueError` controlado) | `backend/tests/test_api.py` |
| `test_spatial_analysis_inside_and_outside_zones` | Verificar intersección geométrica Shapely dentro/fuera de zona | **PASSED** (`bld_comedor` dentro, `bld_derecho` fuera en escenario moderado; expansión en extremo) | `backend/tests/test_api.py` |
| `test_simulation_reproducibility_and_synthetic_labeling` | Verificar determinismo y etiquetado sintético obligatorio | **PASSED** (`is_synthetic == True`, IDs y niveles idénticos) | `backend/tests/test_api.py` |
| `test_invalid_simulation_input_rejected` | Verificar rechazo de parámetros negativos o fuera de rango | **PASSED** (HTTP 422 Pydantic) | `backend/tests/test_api.py` |
| `test_live_preventive_evaluation_endpoint` | Verificar ficha preventiva sobre pronóstico y descargo SINAGERD | **PASSED** (`is_synthetic == False`, Ley N.° 29664) | `backend/tests/test_api.py` |
| `test_protocols_endpoint` | Verificar 4 niveles preventivos y 3 cuencas de contexto Trujillo | **PASSED** | `backend/tests/test_api.py` |

---

## 2. Protocolo de Validación con Usuarios UNT (Pendiente: a ejecutar antes del 27-nov-2026 (final))

### Población objetivo
- **Muestra planificada:** 5–10 participantes de la comunidad UNT.

### Tareas de usabilidad y comprensión a evaluar (T1–T5)
1. **T1 (Pronóstico y límites):** Identificar si lloverá en las próximas 24 horas en la UNT y verificar si el dato es un pronóstico o una medición local.
2. **T2 (Asistente YAKU + Mapa):** Abrir el Asistente YAKU, preguntar por el Comedor Universitario (o su facultad) y ubicarlo en Mapa UNT.
3. **T3 (Simulación vs realidad):** Activar el Escenario C en Simulaciones y explicar con sus palabras si representa una alerta real o un escenario sintético.
4. **T4 (Prevención y boletín):** Revisar la ficha en Prevención (QUÉ / DÓNDE / CUÁNDO / QUÉ HACER) y descargar el boletín preventivo.
5. **T5 (Condiciones externas):** En modo `Pronóstico / Caché`, localizar las casillas de condiciones externas y explicar de dónde provienen esos datos (declaración manual vs sensores).

### Métricas reales a registrar durante las sesiones
- Tasa de tareas completadas sin asistencia (%).
- Tiempo promedio por tarea (segundos).
- Escala de comprensión de la ficha explicable (1–5).
- Dificultades de lenguaje técnico o navegación móvil reportadas textualmente.

---

## 3. Mejoras Identificadas y Trabajo Futuro (Post-Hackathon)
- **Calibración hidrológica local:** Validar umbrales experimentales con especialistas de Ingeniería Civil/Agrícola UNT y oficina de Defensa Civil UNT.
- **Integración oficial SENAMHI / SIGRID:** Incorporar avisos meteorológicos oficiales de SENAMHI y capas catastrales oficiales del campus cuando se cuente con autorización institucional.
- **Modo PWA (Service Worker):** Cachear teselas locales del campus para mapas 100% sin internet en campo.
- **Escalamiento comunitario:** Replicar la arquitectura en municipalidades distritales de Trujillo (El Porvenir, Florencia de Mora, Víctor Larco) respetando siempre la Ley N.° 29733.
