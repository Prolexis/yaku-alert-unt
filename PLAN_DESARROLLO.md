# PLAN DE DESARROLLO — YAKU ALERT — UNT
**Hackathon Innova Norte 3G 2026 — Desafío 3: Gestión de riesgos y desastres ante el Fenómeno El Niño**

---

## 1. Resumen Ejecutivo y Alcance Definitivo

**YAKU ALERT — UNT** es una plataforma web inteligente de monitoreo meteorológico, análisis espacial geográfico, evaluación preventiva explicable y simulación de continuidad académica para la Ciudad Universitaria de la Universidad Nacional de Trujillo (UNT), diseñada con arquitectura escalable hacia comunidades vulnerables de Trujillo y el norte del Perú.

### Diferenciación frente a plataformas existentes en el Perú
Tras investigar las plataformas oficiales peruanas:
- **GEOQUEBRADAS (MINAM):** Identifica a escala nacional/distrital la posible activación de quebradas y afectación agregada, con actualización diaria. No está orientada a la microescala de un campus universitario ni a orientaciones de continuidad académica.
- **SIGRID (CENEPRED):** Repositorio geoespacial nacional de peligros, vulnerabilidades y elementos expuestos. Es una herramienta técnica de consulta GIS, no un asistente preventivo explicable en tiempo real para estudiantes/docentes.
- **ISAAC (SENAMHI):** Monitorea acumulados de lluvia y umbrales pluviométricos para activación de quebradas en cuencas específicas de Lima (Rímac/Chosica/Chaclacayo).
- **ARES (SENAMHI):** Sistema de monitoreo y pronóstico frente a inundaciones urbanas.
- **CENDEHUA (IGP):** Sistema de alerta temprana instrumental (cámaras, sensores de nivel/continuidad) en quebradas específicas (Huaycoloro, Río Seco en Lima; Limón en Piura; volcánicas en Arequipa).

**Nuestra innovación diferencial (sin afirmar ser los primeros en monitorear):**
Un **Motor de Decisiones Preventivas Explicables (Explainable Preventive Engine)** a microescala universitaria que conecta:
`Datos meteorológicos reales (Open-Meteo + respaldo offline)` → `Contexto geográfico del campus UNT (Shapely + GeoJSON)` → `Evaluación experimental transparente por reglas` → `Identificación de exposición espacial` → `Aviso preventivo con trazabilidad, fuente, hora e incertidumbre` → `Orientación preventiva y continuidad universitaria`.

Cada salida del sistema responde explícitamente: *¿Qué datos lo sustentan? ¿De dónde proceden? ¿Cuándo se actualizaron? ¿Qué limitaciones e incertidumbre tienen?*

---

## 2. Arquitectura Técnica

Se adopta una arquitectura limpia, modular y mantenible (sin microservicios ni sobreingeniería):

```
YAKU ALERT/
├── backend/                  # FastAPI + Python 3.11 + Shapely + httpx
│   ├── app/
│   │   ├── main.py           # API REST, CORS, cabeceras de seguridad, healthcheck
│   │   ├── config.py         # Coordenadas UNT (-8.114656, -79.038595), rutas y límites
│   │   ├── models.py         # Esquemas Pydantic con validación estricta
│   │   ├── services/
│   │   │   ├── weather.py    # Cliente Open-Meteo (IPv4) + caché/respaldo offline
│   │   │   ├── spatial.py    # Análisis espacial real con Shapely (intersecciones, buffers)
│   │   │   ├── preventive_engine.py  # Motor de reglas transparentes y explicables
│   │   │   └── simulator.py  # Simulador determinista offline de lluvia extrema/escenarios
│   │   └── data/
│   │       ├── campus_unt.geojson        # Edificios, accesos, puntos de encuentro referenciales
│   │       ├── hazard_scenarios.geojson  # Escenarios experimentales por mecanismo (relieve DEM / zonas reportadas)
│   │       ├── protocols.json            # Protocolos SINAGERD/preventivos y continuidad
│   │       └── open_meteo_fallback.json  # Respaldo local verificable para modo offline
│   ├── tests/                # Suite pytest (API, offline, Shapely, motor, seguridad)
│   └── requirements.txt
├── frontend/                 # React + Vite + Tailwind CSS + Leaflet
│   ├── src/
│   │   ├── components/       # Navbar, Banner Real/Simulado, Vistas 1, 2 y 3
│   │   ├── services/api.js   # Cliente REST con fallback offline local en navegador
│   │   └── data/             # Datos de respaldo offline para funcionamiento sin internet
├── docs/                     # Entregables oficiales, matriz de cumplimiento y validación
└── pitch/                    # Generador y archivo PowerPoint (.pptx, máx. 7 diapositivas)
```

---

## 3. Backlog Priorizado (P0, P1, P2)

### Prioridad P0 (Crítico — MVP Funcional Demostrable)
- [x] Inspección de bases oficiales (`BASES HACKATHON 2026- VF (1).pdf`) y verificación de API Open-Meteo.
- [ ] **Backend FastAPI:** Endpoint `/api/weather` (Open-Meteo real con forzado IPv4 + fallback offline etiquetado), `/api/campus/layers` (GeoJSON UNT), `/api/preventive/evaluate` (motor explicable), `/api/simulate` (simulador offline determinista con Shapely), `/api/protocols` (orientaciones y continuidad).
- [ ] **Análisis Espacial Real (Shapely):** Cálculo de intersección geométrica entre las zonas experimentales por mecanismo (relieve DEM y zonas reportadas) y edificios, accesos y puntos de encuentro del campus UNT.
- [ ] **Motor Preventivo Explicable:** Reglas transparentes que distinguen **peligro**, **exposición** y **riesgo**, sin convertir probabilidad de lluvia en probabilidad de huaico ni presentar umbrales experimentales como validados científicamente.
- [ ] **Frontend React + Tailwind + Leaflet:** 3 vistas principales:
  1. *Monitoreo:* Pronóstico horario, precipitación, probabilidad, intensidad, acumulados, duración, humedad, fuente, unidades y timestamp.
  2. *Mapa de riesgo y escenarios:* Campus UNT en Leaflet, edificios, accesos, puntos de encuentro referenciales, rutas referenciales (no garantizadas) y zonas de simulación.
  3. *Prevención y respuesta:* Ficha preventiva explicable, avisos demostrativos, protocolos de consulta y alternativas de continuidad académica.
- [ ] **Modo Offline:** Funcionamiento completo de simulación y consulta sin conexión a internet, con indicador permanente visible que distingue **DATOS REALES** de **ESCENARIO SIMULADO / SINTÉTICO**.
- [ ] **Pruebas automatizadas (`pytest`):** Cobertura de API disponible/no disponible, datos inválidos, análisis Shapely dentro/fuera de zona, reproducibilidad de simulaciones y seguridad básica.

### Prioridad P1 (Alto Valor — Entregables Oficiales Stage-Gate 1 y Final)
- [ ] `docs/MATRIZ_CUMPLIMIENTO.md` (requisitos, fechas, normativa).
- [ ] `docs/ENTREGABLE_1_FICHA_PROBLEMA.md`.
- [ ] `docs/ENTREGABLE_3_FICHA_TECNICA.md`.
- [ ] `docs/ENTREGABLE_4_PLAN_VALIDACION.md` (diferenciando pruebas ejecutadas de validación con usuarios pendiente, sin inventar encuestas).
- [ ] `pitch/YAKU_ALERT_UNT_PITCH.pptx` (máximo 7 diapositivas en PowerPoint) + guion de demo 90–120 s + 20 preguntas difíciles de jurado (`docs/DEFENSA_JURADO.md`).
- [ ] `README.md` con instrucciones reproducibles de instalación y ejecución.

### Prioridad P2 (Mejoras de Calidad y Desempeño)
- [ ] Exportación/impresión limpia de Ficha Preventiva.
- [ ] Análisis de cuenca de aporte referencial para quebradas de Trujillo (San Ildefonso, San Carlos, El León) como contexto informativo externo al campus.
- [ ] Evaluación estricta final contra la rúbrica de 100 puntos.

---

## 4. Cronograma Interno hacia el Cierre

| Hito | Fecha límite | Responsable |
|---|---|---|
| Cierre de inscripción del equipo en formulario oficial | 13 nov 2026 | Equipo / Líder |
| Fase 1 & 2: Arquitectura + MVP funcional completo | 13 nov 2026 | Desarrollo |
| Fase 3: Suite de pruebas y verificación offline/móvil | 13 nov 2026 | QA / Seguridad |
| Fase 4 & 5: 4 Entregables Stage-Gate 1 + Pitch 7 slides | 13 nov 2026 | Documentación |
| Validación con usuarios reales UNT (encuestas/tareas reales) | 14–24 nov 2026 | Equipo (en campo) |
| Capacitaciones virtuales obligatorias (7:00 p. m.) | 23–25 nov 2026 | Todo el equipo |
| **Entrega oficial Stage-Gate 1 (Fase Virtual)** | **25 nov 2026, 11:59 p. m.** | Líder |
| Mentoría presencial y ensayo (DITT - Independencia 186) | 26 nov 2026, 12:00 m | Todo el equipo |
| Final y Pitch (Cámara Gesell - Derecho UNT) | 27 nov 2026 | Todo el equipo |
