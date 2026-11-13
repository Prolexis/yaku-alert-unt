# ENTREGABLE 4 — PLAN DE VALIDACIÓN Y APRENDIZAJE
**Proyecto:** YAKU ALERT — UNT  
**Principio de integridad:** Este documento distingue estrictamente entre **pruebas técnicas ya ejecutadas** y **validación con usuarios universitarios pendiente de ejecución**. No se reportan encuestas ni métricas ficticias.

---

## 1. Pruebas Técnicas Ejecutadas (Verificadas)

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

## 2. Protocolo de Validación con Usuarios UNT (Pendiente: 14–24 nov 2026)

### Población objetivo
- **Muestra planificada:** 12 a 20 participantes de la comunidad UNT (estudiantes de distintas facultades, 2–3 docentes y 1–2 administrativos/brigadistas).

### Tareas de usabilidad y comprensión a evaluar
1. **Tarea 1 (Monitoreo):** Identificar en menos de 60 segundos si el pronóstico actual corresponde a datos reales o simulación, y cuál es la intensidad máxima prevista.
2. **Tarea 2 (Mapa y Simulación):** Seleccionar el escenario *Lluvia Intensa FEN*, identificar qué pabellón queda expuesto y qué acceso figura restringido en la simulación.
3. **Tarea 3 (Prevención y Continuidad):** Abrir la Ficha Preventiva, explicar *por qué* se activó ese nivel (reglas) y señalar qué alternativa de continuidad académica aplica.
4. **Tarea 4 (Comprensión de Límites):** Confirmar si el usuario comprende que el sistema es preventivo/informativo y **no** reemplaza alertas oficiales de Defensa Civil/SENAMHI.

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
