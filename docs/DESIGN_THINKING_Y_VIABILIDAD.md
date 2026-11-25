# DESIGN THINKING, LEAN STARTUP, SCRUM Y VIABILIDAD — YAKU ALERT — UNT
**Hackathon Innova Norte 3G 2026 — Desafío 03: Gestión de riesgos y desastres ante el Fenómeno El Niño**

---

## 1. Design Thinking: Comprender al Usuario

### Hipótesis del Problema
Los estudiantes, docentes y personal administrativo de la Ciudad Universitaria UNT tienen dificultades para interpretar pronósticos meteorológicos numéricos (`mm/h`, `%`), identificar qué accesos o facultades podrían verse expuestos en un escenario de lluvia intensa y saber qué orientaciones preventivas o de continuidad académica consultar sin depender de información dispersa.

### Perfil de Usuario Principal y Mapa de Empatía (Estudiante UNT)
- **Qué ve:** Avisos técnicos en redes o apps del clima con porcentajes confusos; incertidumbre en días de lluvia sobre accesos y clases.
- **Qué oye:** Rumores en grupos de WhatsApp sobre suspensiones no confirmadas o inundaciones en Trujillo.
- **Qué piensa y siente:** Preocupación por trasladarse al campus en vano o quedar expuesto a zonas anegadas; frustración por falta de información centralizada y clara.
- **Qué dice y hace:** Busca confirmaciones rápidas en su celular antes de salir de casa y consulta a compañeros si habrá clases o laboratorios.
- **Esfuerzos (Pains):** Lenguaje meteorológico técnico, desinformación, falta de acceso offline cuando falla internet móvil.
- **Resultados esperados (Gains):** Saber en menos de 1 minuto si lloverá, ubicar su facultad en el mapa, leer orientaciones breves y verificar enlaces oficiales.

### Customer Journey Map (Antes vs Con YAKU ALERT)
1. **Alerta climática en Trujillo:** Antes → confusión por datos técnicos aislados. Con YAKU ALERT → titular claro en lenguaje cotidiano + hora local Lima.
2. **Consulta de facultad:** Antes → no sabe qué zona o puerta del campus podría afectarse. Con YAKU ALERT → flujo *«Consulta tu facultad»* → ubicación directa en el mapa UNT.
3. **Comprensión y acción:** Antes → rumores y falta de protocolo. Con YAKU ALERT → mensaje preventivo estructurado (*Qué, Dónde, Cuándo, Qué hacer, Quién informa*) + boletín descargable offline + enlaces a SENAMHI / INDECI / UNT.

### Value Proposition Canvas y FODA Simplificado
- **Propuesta de valor:** Traducir datos meteorológicos reales y geometrías espaciales del campus en orientaciones preventivas explicables, transparentes y utilizables incluso sin internet.
- **Fortalezas:** Software funcional verificado (`43/43` pruebas `pytest`: 26 en `test_api.py` y 17 en `test_conditions.py`), análisis geométrico real (Shapely), modo offline, cero datos personales (Ley N.° 29733), ética científica estricta.
- **Oportunidades:** Articulación con DITT, OTI y Defensa Civil UNT; escalabilidad por GeoJSON a distritos de Trujillo.
- **Debilidades:** Umbrales experimentales aún no calibrados hidrológicamente; validación presencial con usuarios en ejecución.
- **Amenazas:** Falta de sensores locales en campus; dependencia de validación institucional para rutas operativas oficiales.

---

## 2. Lean Startup y Validación Real

Ciclo aplicado: **CONSTRUIR → MEDIR → APRENDER → MEJORAR**.

- **Pruebas técnicas ejecutadas (verificadas):** 43 pruebas automatizadas (`pytest`): 26 en `test_api.py` y 17 en `test_conditions.py`, build de producción (`vite build`), Docker Compose (`healthy`), verificación offline y comparador de escenarios.
- **Validación con usuarios reales (pendiente de registro en campo — sin inventar encuestas):**
  - **Tareas:** (1) Encontrar su facultad, (2) Consultar la lluvia prevista, (3) Interpretar el pronóstico, (4) Identificar una simulación, (5) Consultar elementos expuestos, (6) Encontrar una orientación y generar boletín.
  - **Métricas reales a registrar:** tiempo por tarea (s), errores, comprensión (1–5) y comentarios textuales.

---

## 3. Scrum — Sprint Final (Priorización P0 / P1 / P2)

| Prioridad | Tarea | Estado | Evidencia |
|---|---|---|---|
| **P0** | Preservar 6 vistas, 7 endpoints FastAPI, Shapely y modo offline | Completo | `43/43` `pytest` + `vite build` |
| **P0** | Flujo «Consulta tu facultad» (Dashboard → Mapa UNT) | Completo | `FacultyLookupCard.jsx` + `CampusMapView.jsx` |
| **P0** | Mensajes preventivos (Qué/Dónde/Cuándo/Qué hacer/Quién informa) | Completo | `PreventiveMessageCard.jsx` + `PreventionView.jsx` |
| **P1** | Boletín preventivo descargable e imprimible (100% offline) | Completo | `frontend/src/utils/bulletin.js` |
| **P1** | Comparador de escenarios A vs B vs C | Completo | `SimulatorView.jsx` |
| **P1** | Validación con usuarios UNT y video de respaldo | Pendiente (campo) | Protocolo en `ENTREGABLE_4_PLAN_VALIDACION.md` |
| **P2** | Sensores IoT, ML calibrado, SMS masivos, expansión regional | Futuro (roadmap) | Documentado en arquitectura modular |

---

## 4. Business Model Canvas Simplificado (Factibilidad vs Viabilidad)

- **Factibilidad técnica (demostrada):** Construido 100% con software libre (React, FastAPI, Leaflet, Shapely, Docker) y APIs abiertas (Open-Meteo, OSM, DEM Copernicus).
- **Viabilidad operativa y sostenibilidad:**
  - **Usuarios:** Estudiantes, docentes y personal administrativo UNT.
  - **Clientes / Aliados institucionales potenciales:** UNT (DITT, OTI, Defensa Civil UNT), municipalidades distritales de Trujillo (El Porvenir, Alto Trujillo, Víctor Larco), COER La Libertad.
  - **Canales:** Plataforma web institucional + boletín imprimible/descargable offline.
  - **Estructura de costos:** Costo de licenciamiento **S/ 0** (open-source); hosting desplegable en servidores existentes de la UNT o VPS básico de bajo costo.
  - **Mecanismos de sostenibilidad:** Adopción institucional académica (tesis/prácticas preprofesionales para calibración), fondos de innovación (DITT / ProInnóvate) y convenios municipales. *No se reportan ingresos ni contratos ficticios.*
  - **Crecimiento progresivo:** **Piloto UNT → Distritos de Trujillo → Otras regiones del norte del Perú**.
