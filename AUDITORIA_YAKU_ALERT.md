# AUDITORÍA INTEGRAL — YAKU ALERT UNT

> **Proyecto:** YAKU ALERT — UNT (Ciudad Universitaria, Universidad Nacional de Trujillo)  
> **Competencia:** Hackathon Innova Norte 3G 2026 — Desafío 03 (Riesgos y Fenómeno El Niño)  
> **Fecha de auditoría:** 24 de noviembre de 2026  
> **Alcance:** Inspección directa del código fuente (`backend/`, `frontend/`, `docker-compose.yml`, `scripts/`, `docs/`), pruebas automatizadas (`pytest`, `vite build`) y servicios desplegados en Docker (`localhost:8080` y `localhost:8000`).

---

## 1. Resumen arquitectónico real

| Capa | Tecnología verificada | Archivos principales | Estado |
|---|---|---|---|
| **Backend API** | Python 3.11, FastAPI, Pydantic v2, Shapely 2.x, HTTPX (IPv4 forzado) | `backend/app/main.py`, `schemas.py`, `services/{weather,geospatial,preventive_engine,protocols,conditions}.py` | Operativo (7 endpoints REST) |
| **Frontend SPA** | React 18, Vite 5, Tailwind CSS 3, Leaflet, Lucide Icons | `frontend/src/App.jsx`, 6 vistas en `components/`, `components/ui/`, `services/api.js`, `utils/{campusCatalog,bulletin,formatters}.js` | Operativo (6 vistas + Asistente YAKU) |
| **Datos locales** | GeoJSON (OSM + capas curadas + escenarios DEM Copernicus GLO-30) y JSON locales | `backend/app/data/*.geojson`, `backend/app/data/*.json` | Operativo (con respaldo offline) |
| **Despliegue** | Docker Compose (`yaku-alert-backend`, `yaku-alert-frontend`) | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` | Operativo y saludable |
| **Pruebas** | `pytest` (43 casos automatizados en backend) + `vite build` | `backend/tests/test_*.py` | Operativo (43/43 pasan) |

---

## 2. Inventario funcional detallado

### F01. Salud del servicio y trazabilidad de arranque
1. **Nombre:** Monitor de salud de API (`/api/health`)
2. **Objetivo:** Verificar disponibilidad del backend, versión y estado de carga de capas geoespaciales.
3. **Usuario al que beneficia:** Equipo técnico, Docker healthcheck y jurado durante la demo.
4. **Cómo funciona:** Retorna JSON con `status: "ok"`, versión de la API y metadatos de salud.
5. **Archivos involucrados:** `backend/app/main.py`, `docker-compose.yml`
6. **Endpoint utilizado:** `GET /api/health`
7. **Fuente de datos:** Estado en memoria del proceso FastAPI.
8. **Tipo de datos:** Reales (telemetría del contenedor).
9. **Estado:** Implementada.
10. **Evidencia técnica:** Healthcheck de Docker Compose activo en `:8000/api/health`.
11. **Resultado de pruebas:** HTTP 200 OK verificado en `pytest` y `curl`.
12. **Limitaciones:** No consulta conectividad externa a Open-Meteo (deliberado para no fallar en modo offline).
13. **Mejoras recomendadas:** Mantener ligero; opcionalmente exponer timestamp del caché meteorológico.

---

### F02. Monitoreo meteorológico Open-Meteo con respaldo offline
1. **Nombre:** Monitoreo meteorológico y caché de resiliencia
2. **Objetivo:** Mostrar pronóstico de precipitación horaria (24 h / 48 h), acumulados, intensidad máxima y probabilidad para la Ciudad Universitaria UNT.
3. **Usuario al que beneficia:** Estudiantes, docentes, trabajadores y comité universitario.
4. **Cómo funciona:** Consulta la API pública Open-Meteo con transporte IPv4 explícito (`local_address="0.0.0.0"` para evitar timeouts IPv6 en Windows). Si falla la red o se activa `offline=true`, sirve `weather_cache.json` identificándolo claramente como caché local.
5. **Archivos involucrados:** `backend/app/services/weather.py`, `backend/app/data/weather_cache.json`, `frontend/src/components/MonitoringView.jsx`, `frontend/src/components/DashboardView.jsx`
6. **Endpoint utilizado:** `GET /api/weather?offline={bool}`
7. **Fuente de datos:** Open-Meteo (modelo numérico de pronóstico) + `weather_cache.json`.
8. **Tipo de datos:** Reales (pronóstico externo) y almacenados (caché offline).
9. **Estado:** Implementada.
10. **Evidencia técnica:** Gráficas SVG interactivas de 24 h y 48 h, formato horario `America/Lima` (`utils/formatters.js`), avisos explícitos de "Pronóstico, no medición local".
11. **Resultado de pruebas:** Verificado en modo en línea y con `?offline=true` (HTTP 200).
12. **Limitaciones:** No proviene de una estación pluviométrica física dentro del campus ni reemplaza avisos oficiales de SENAMHI.
13. **Mejoras recomendadas:** Permitir en el futuro ingesta de avisos oficiales de SENAMHI cuando exista API institucional.

---

### F03. Motor preventivo de reglas explicables
1. **Nombre:** Evaluación preventiva multicriterio sin caja negra
2. **Objetivo:** Clasificar las condiciones en niveles preventivos (`Nivel 1 — Informativo`, `Nivel 2 — Vigilancia`, `Nivel 3 — Precaución`, `Nivel 4 — Restricción Preventiva`) mostrando explícitamente cada regla disparada y su peso.
3. **Usuario al que beneficia:** Autoridades universitarias, docentes y estudiantes.
4. **Cómo funciona:** Evalúa lluvia acumulada 24 h, intensidad máxima horaria, probabilidad de lluvia y condiciones externas declaradas (en modo en vivo) o afectación espacial de escenarios sintéticos (en simulación). Nunca convierte probabilidad de lluvia en probabilidad de huaico.
5. **Archivos involucrados:** `backend/app/services/preventive_engine.py`, `backend/app/main.py`, `frontend/src/components/PreventionView.jsx`, `frontend/src/components/ui/PreventiveMessageCard.jsx`
6. **Endpoint utilizado:** `GET /api/preventive/evaluate?offline={bool}&conditions={csv}`
7. **Fuente de datos:** Pronóstico meteorológico + reglas determinísticas + catálogo de condiciones externas.
8. **Tipo de datos:** Reales (pronóstico), declarativos (condiciones externas) y referenciales (reglas).
9. **Estado:** Implementada.
10. **Evidencia técnica:** Matriz de reglas trazables (`rules_triggered`), mensajes estructurados (QUÉ / DÓNDE / CUÁNDO / QUÉ HACER / QUIÉN INFORMA) y separación estricta entre pronóstico y simulación.
11. **Resultado de pruebas:** Cubierta por tests unitarios en `backend/tests/test_preventive_engine.py` y `test_conditions.py`.
12. **Limitaciones:** Los umbrales son referenciales de prototipo y deben validarse con la Oficina de Defensa Civil / Gestión del Riesgo de la UNT.
13. **Mejoras recomendadas:** Documentar calibración con autoridades UNT tras pruebas de campo.

---

### F04. Declaración manual de condiciones externas en el entorno UNT
1. **Nombre:** Condiciones externas declarables (`/api/conditions` conectado a `PreventionView`)
2. **Objetivo:** Permitir que un operador o usuario declare manualmente condiciones observables en el entorno inmediato (`av_jesus_nazareth`, `av_juan_pablo_ii`, `quebrada_san_ildefonso`) para recalcular el nivel preventivo en vivo.
3. **Usuario al que beneficia:** Personal de seguridad, comité preventivo y estudiantes informados.
4. **Cómo funciona:** El frontend consulta `GET /api/conditions` al cargar y renderiza controles interactivos en la vista de Prevención (solo en modo pronóstico en vivo). Al marcar una condición, invoca `GET /api/preventive/evaluate?conditions=...` y muestra las reglas aplicadas.
5. **Archivos involucrados:** `backend/app/services/conditions.py`, `backend/app/data/condiciones_externas.json`, `frontend/src/services/api.js`, `frontend/src/App.jsx`, `frontend/src/components/PreventionView.jsx`
6. **Endpoint utilizado:** `GET /api/conditions` y `GET /api/preventive/evaluate?conditions=...`
7. **Fuente de datos:** Catálogo curado `condiciones_externas.json` + declaración manual sí/no del usuario.
8. **Tipo de datos:** Referenciales (catálogo) y declarativos (entrada manual, sin sensores).
9. **Estado:** Implementada (brecha P0 cerrada durante esta auditoría).
10. **Evidencia técnica:** 17 tests en `backend/tests/test_conditions.py` + panel interactivo en `PreventionView.jsx` con advertencia explícita de declaración manual sin sensores automáticos.
11. **Resultado de pruebas:** Validada en backend (`pytest`) y en compilación/despliegue frontend.
12. **Limitaciones:** No persiste entre sesiones ni valida la veracidad del reporte en campo (es una herramienta de apoyo a la decisión).
13. **Mejoras recomendadas:** En una fase institucional, vincular con cuentas autenticadas del comité de gestión de riesgos UNT.

---

### F05. Mapa interactivo del campus UNT y análisis espacial Shapely
1. **Nombre:** Visor cartográfico GIS del campus UNT
2. **Objetivo:** Visualizar perímetro del campus, edificios reales de OpenStreetMap, accesos, puntos de encuentro referenciales, rutas peatonales referenciales y capas de escenarios de exposición.
3. **Usuario al que beneficia:** Toda la comunidad universitaria y visitantes.
4. **Cómo funciona:** Sirve capas GeoJSON desde `/api/campus/layers` y las renderiza en Leaflet con 3 mapas base (OpenStreetMap, Satélite y Modo Vectorial offline-friendly), control de capas y cálculo real de intersección espacial en backend con Shapely 2.x.
5. **Archivos involucrados:** `backend/app/services/geospatial.py`, `backend/app/data/{campus_unt,hazard_scenarios,meeting_points,reference_routes}.geojson`, `frontend/src/components/CampusMapView.jsx`
6. **Endpoint utilizado:** `GET /api/campus/layers`
7. **Fuente de datos:** OpenStreetMap (`campus_unt.geojson`), capas referenciales curadas y análisis topográfico experimental DEM Copernicus GLO-30 (`hazard_scenarios.geojson`).
8. **Tipo de datos:** Reales (huellas OSM y DEM) + referenciales (puntos/rutas) + sintéticos (escenarios de peligro).
9. **Estado:** Implementada.
10. **Evidencia técnica:** Intersección geométrica real con `shapely.geometry` para edificios y accesos; foco animado sobre polígonos y puntos seleccionados.
11. **Resultado de pruebas:** Verificada en `backend/tests/test_geospatial.py` y compilación frontend.
12. **Limitaciones:** Algunos pabellones en OSM carecen de etiqueta de nombre ("Sin identificar"); `Facultad de Medicina` está fuera del campus principal y `Estomatología` no está etiquetada en OSM dentro del perímetro.
13. **Mejoras recomendadas:** Enriquecer nombres oficiales en OSM en colaboración con la oficina de infraestructura UNT.

---

### F06. Buscador universal «Explora tu campus»
1. **Nombre:** Buscador universal de instalaciones UNT (`Explora tu campus`)
2. **Objetivo:** Permitir a cualquier estudiante, docente o visitante localizar facultades, pabellones, aulas, laboratorios, auditorios, bibliotecas, comedor, oficinas, deportes, accesos y puntos de encuentro.
3. **Usuario al que beneficia:** Estudiantes, ingresantes, docentes y visitantes.
4. **Cómo funciona:** Construye un catálogo normalizado desde `campus_unt.geojson` y `meeting_points.geojson` (`campusCatalog.js`), agrupa 11 categorías reales, tolera tildes/mayúsculas (`normalizeText`), normaliza nombres oficiales de facultades según `unitru.edu.pe` eliminando duplicados de OSM, diferencia registros verificados/referenciales/sin identificar y permite abrir en el mapa, consultar el escenario simulado o ir a orientaciones.
5. **Archivos involucrados:** `frontend/src/utils/campusCatalog.js`, `frontend/src/utils/formatters.js`, `frontend/src/components/ui/FacultyLookupCard.jsx`, `frontend/src/components/DashboardView.jsx`, `frontend/src/components/CampusMapView.jsx`
6. **Endpoint utilizado:** Consume datos de `GET /api/campus/layers` y resultados de `POST /api/simulate`.
7. **Fuente de datos:** `campus_unt.geojson` y `meeting_points.geojson`.
8. **Tipo de datos:** Reales (OSM) y referenciales (puntos de encuentro).
9. **Estado:** Implementada.
10. **Evidencia técnica:** Disponible tanto en Dashboard como en Mapa UNT; nunca califica una instalación como "segura" o "peligrosa" por cálculos experimentales; muestra "Información no disponible" cuando falta evidencia.
11. **Resultado de pruebas:** Verificada con `vite build` y despliegue en Docker.
12. **Limitaciones:** Depende de la cobertura de nombres en OSM (edificios sin etiqueta se listan transparentemente como "Sin identificar").
13. **Mejoras recomendadas:** Añadir alias cortos de jerga estudiantil (ej. "Pabellón Pool", "Comedor") si la UNT valida el mapeo.

---

### F07. Simulador de escenarios sintéticos (A, B, C y personalizado) + Comparador
1. **Nombre:** Simulador preventivo Fenómeno El Niño y comparador A vs B vs C
2. **Objetivo:** Evaluar escenarios de entrenamiento (`A: Lluvia intensa`, `B: Aniego urbano`, `C: Escenario severo tipo El Niño / Quebrada San Ildefonso` y `Personalizado`) calculando edificios y accesos interceptados con Shapely.
3. **Usuario al que beneficia:** Comité de gestión de riesgos, autoridades, docentes y jurado.
4. **Cómo funciona:** `POST /api/simulate` combina el nivel meteorológico evaluado con la geometría del escenario seleccionado (escenarios precalculados DEM / alcance sintético `synthetic_reach_m`). En `SimulatorView.jsx` incluye un comparador lado a lado A vs B vs C con tabla comparativa y aviso claro de que las geometrías son escenarios de entrenamiento y no pronósticos dinámicos de inundación.
5. **Archivos involucrados:** `backend/app/main.py`, `backend/app/services/geospatial.py`, `backend/app/services/preventive_engine.py`, `frontend/src/components/SimulatorView.jsx`
6. **Endpoint utilizado:** `POST /api/simulate`
7. **Fuente de datos:** `hazard_scenarios.geojson` (DEM Copernicus GLO-30 experimental), `campus_unt.geojson` y parámetros del escenario.
8. **Tipo de datos:** Sintéticos / experimentales (claramente etiquetados en UI y API).
9. **Estado:** Implementada.
10. **Evidencia técnica:** Banner persistente de "SIMULACIÓN" en barra superior y vistas; cálculo real de intersecciones; test automatizado garantiza que ni la UI ni los documentos afirmen que cambiar la lluvia altera los polígonos de peligro.
11. **Resultado de pruebas:** Cubierta por `backend/tests/test_api.py` y `test_scientific_rigor.py`.
12. **Limitaciones:** No es un modelo hidráulico 2D (tipo HEC-RAS / IBER) ni reemplaza estudios oficiales de CENEPRED/ANA.
13. **Mejoras recomendadas:** Incorporar capas oficiales de peligros de la Municipalidad Provincial de Trujillo / CENEPRED cuando se publiquen en formato abierto.

---

### F08. Protocolos, orientaciones y continuidad universitaria
1. **Nombre:** Guía de orientaciones preventivas y continuidad académica
2. **Objetivo:** Ofrecer acciones claras antes, durante y después de lluvias intensas, contexto de la Quebrada San Ildefonso, referencias históricas (`eventos_referencia.json`) y opciones de continuidad universitaria por nivel preventivo.
3. **Usuario al que beneficia:** Estudiantes, docentes, directores de escuela y personal administrativo.
4. **Cómo funciona:** Sirve protocolos estructurados desde `/api/protocols` y los presenta en `PreventionView.jsx` y `ContinuityView.jsx`, diferenciando orientaciones para estudiantes, docentes y autoridades, con canales oficiales (SENAMHI, INDECI, COEN).
5. **Archivos involucrados:** `backend/app/services/protocols.py`, `backend/app/data/{eventos_referencia,evidencia_inundacion}.json`, `frontend/src/components/PreventionView.jsx`, `frontend/src/components/ContinuityView.jsx`
6. **Endpoint utilizado:** `GET /api/protocols`
7. **Fuente de datos:** Guías referenciales basadas en lineamientos de INDECI/SINAGERD y registros históricos documentados.
8. **Tipo de datos:** Referenciales e históricos.
9. **Estado:** Implementada.
10. **Evidencia técnica:** Separación por rol y por nivel preventivo; incluye advertencia legal (Ley N.° 29664 SINAGERD).
11. **Resultado de pruebas:** Verificado vía `GET /api/protocols` en `pytest`.
12. **Limitaciones:** Son orientaciones referenciales; cada facultad requiere aprobar su protocolo interno oficial.
13. **Mejoras recomendadas:** Integrar enlaces directos al reglamento de continuidad académica de la UNT cuando esté disponible.

---

### F09. Boletín preventivo descargable / imprimible 100% offline
1. **Nombre:** Generador de boletín preventivo HTML imprimible
2. **Objetivo:** Permitir exportar en un clic un resumen legible con el estado actual o simulado, nivel preventivo, mensaje estructurado y orientaciones sin depender de servidores externos.
3. **Usuario al que beneficia:** Coordinadores, docentes y estudiantes que necesitan compartir el aviso en formato impreso o PDF (vía diálogo de impresión del navegador).
4. **Cómo funciona:** `utils/bulletin.js` ensambla un documento HTML autocontenido con estilos de impresión y dispara su descarga o vista imprimible.
5. **Archivos involucrados:** `frontend/src/utils/bulletin.js`, `frontend/src/components/PreventionView.jsx`, `frontend/src/components/DashboardView.jsx`
6. **Endpoint utilizado:** Ninguno (generación local en navegador con los datos activos).
7. **Fuente de datos:** Estado activo de evaluación preventiva (en vivo o simulado).
8. **Tipo de datos:** Reales (si es pronóstico) o sintéticos (si es simulación, claramente marcado).
9. **Estado:** Implementada.
10. **Evidencia técnica:** Funciona incluso sin conexión a internet ni librerías pesadas de PDF en servidor.
11. **Resultado de pruebas:** Compilado sin errores en `vite build`.
12. **Limitaciones:** Genera HTML listo para imprimir/guardar como PDF, no un archivo `.pdf` binario directo.
13. **Mejoras recomendadas:** Mantener la generación local para preservar cero dependencias externas.

---

### F10. Asistente YAKU (orientación determinística 100% offline)
1. **Nombre:** Asistente conversacional determinístico «Asistente YAKU»
2. **Objetivo:** Permitir que un estudiante pregunte en lenguaje natural cómo está el clima, dónde queda una facultad o edificio, cómo activar una simulación o qué orientaciones seguir, sin depender de APIs de LLM ni exponer datos personales.
3. **Usuario al que beneficia:** Estudiantes nuevos, visitantes y usuarios móviles que prefieren preguntar antes de navegar menús.
4. **Cómo funciona:** Panel lateral flotante accesible (`YakuAssistantDrawer.jsx`) que interpreta consultas mediante coincidencia normalizada sobre el pronóstico vigente, las reglas preventivas y el catálogo real `buildCampusCatalog` de `campus_unt.geojson`, ofreciendo botones de acción directa (`Ver en mapa`, `Abrir simulador`, `Ver orientaciones`).
5. **Archivos involucrados:** `frontend/src/components/ui/YakuAssistantDrawer.jsx`, `frontend/src/App.jsx`, `frontend/src/utils/campusCatalog.js`
6. **Endpoint utilizado:** Reutiliza los datos ya cargados de `/api/weather`, `/api/campus/layers`, `/api/preventive/evaluate` y `/api/simulate`.
7. **Fuente de datos:** Mismas fuentes verificadas del sistema (sin generación libre ni alucinaciones).
8. **Tipo de datos:** Reales (pronóstico/OSM) y sintéticos (solo cuando hay simulación activa).
9. **Estado:** Implementada (mejora P1 agregada durante esta auditoría).
10. **Evidencia técnica:** Cero llamadas a terceros, cero recolección de datos personales, botones rápidos y acciones conectadas a Leaflet y navegación.
11. **Resultado de pruebas:** Compilado y desplegado en Docker (`vite build` + verificación HTTP).
12. **Limitaciones:** No es un modelo generativo abierto; responde únicamente con datos verificados del sistema (diseño intencional para evitar información falsa en emergencias).
13. **Mejoras recomendadas:** Evaluar en pruebas con estudiantes qué preguntas frecuentes conviene añadir a los atajos rápidos.

---

## 3. Recorrido real del usuario (End-to-End)

1. **Entrada (`DashboardView`):** El estudiante ve de inmediato el estado meteorológico vigente en la UNT (con sello `Pronóstico` o `Caché local`), las métricas 24 h, el nivel preventivo explicable y el buscador **«Explora tu campus»**.
2. **Búsqueda y ubicación (`Explora tu campus` o `Asistente YAKU`):** Escribe por ejemplo `"Ingenieria"` o `"Biblioteca"` (sin necesidad de tildes). Selecciona la instalación, revisa su ficha (categoría, fuente OSM y estado frente al último escenario simulado si existe) y pulsa **«Ver en mapa»**.
3. **Inspección espacial (`CampusMapView`):** Leaflet centra y resalta el polígono o punto exacto dentro de la Ciudad Universitaria UNT, mostrando puntos de encuentro referenciales, accesos y capas activas.
4. **Simulación y comparación (`SimulatorView`):** El usuario o jurado activa el Escenario C (Fenómeno El Niño) o abre el comparador **A vs B vs C**. Toda la interfaz activa el distintivo visual `SIMULACIÓN` para evitar confusión con el pronóstico real.
5. **Análisis preventivo y condiciones externas (`PreventionView`):** Revisa el mensaje estructurado (QUÉ/DÓNDE/CUÁNDO/QUÉ HACER/QUIÉN INFORMA), puede declarar condiciones externas observables en modo en vivo (ej. `Quebrada San Ildefonso`), inspecciona las reglas disparadas y descarga el **boletín preventivo offline**.
6. **Continuidad académica (`ContinuityView`):** Consulta recomendaciones por rol (estudiante, docente, autoridad) para mantener actividades académicas o migrar preventivamente a modalidad virtual según el nivel vigente.

---

## 4. Auditoría de experiencia de usuario (UX/UI)

Evaluación realizada desde la perspectiva de un estudiante de la UNT en escritorio y móvil:

| Aspecto | Hallazgo real | Estado |
|---|---|---|
| **Navegación** | Barra lateral colapsable con 6 vistas claras + barra superior con estado (`Pronóstico` / `Simulación` / `Offline`), recarga, modo oscuro y ayuda. | Sólido |
| **Claridad de mensajes** | El bloque `PreventiveMessageCard` traduce datos técnicos a 5 preguntas simples. Se diferencia explícitamente "Pronóstico" de "Simulación". | Sólido |
| **Tipografía y espaciado** | Jerarquía clara con Tailwind CSS, contraste adecuado en modo claro y oscuro. | Sólido |
| **Exceso de texto** | Reducido en Dashboard mediante el buscador compacto `Explora tu campus`; las vistas de Prevención y Continuidad siguen siendo informativamente densas en móvil. | Mejorable (P2) |
| **Adaptabilidad móvil** | Diseño responsive con sidebar colapsable y tarjetas apilables; el mapa Leaflet y el drawer del Asistente YAKU se adaptan a pantallas pequeñas. | Sólido |
| **Accesibilidad** | Botones con `aria-label`, etiquetas de foco, contraste alto y navegación por teclado en buscador y asistente. | Sólido |
| **Comprensión de pronóstico vs simulación** | Banner superior y etiquetas dedicadas distinguen inequívocamente escenarios sintéticos de pronósticos reales. | Sólido |
| **Utilidad del asistente** | El Asistente YAKU reduce la fricción para usuarios nuevos y conecta preguntas directas con el mapa y las orientaciones sin inventar datos. | Sólido |
