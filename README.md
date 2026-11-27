# YAKU ALERT — UNT
**Hackathon Innova Norte 3G 2026 — Desafío 3: Gestión de riesgos y desastres ante el Fenómeno El Niño**

Plataforma web de monitoreo meteorológico, simulación exploratoria de escurrimiento superficial, análisis espacial geográfico (Shapely) y motor de decisiones preventivas explicables para la Ciudad Universitaria de la Universidad Nacional de Trujillo (UNT).

---

## Experiencia Diferenciada por Rol

### 1. Vista Estudiante / Visitante (interfaz clara y directa)
- **Inicio (Dashboard):** pronóstico horario 24 h / 48 h (Open-Meteo con respaldo offline), buscador de facultades/instalaciones e indicadores compactos.
- **Mapa de monitoreo UNT (`StudentMonitoringMap`):** ubicación de facultades, zonas de atención (antecedentes históricos y relieve bajo DEM) y capa activable de **puntos seguros y rutas referenciales de evacuación** dentro del campus UNT (TRL 3–4).
- **Simulación sencilla en 1 clic (`StudentSimpleSimulation`):** exploración guiada de los escenarios de referencia **tipo 2017** (`evento_2017_03`) y **tipo 2023** (`evento_2023_03_10`) con reproducción hora por hora y resalte de rutas alternativas ante accesos críticos con acumulación modelada.
- **Restricción de simplicidad:** mantiene ocultos los sensores virtuales (`YAKU SENSE`) y parámetros hidrológicos/técnicos en toda la vista pública (`virtual_sensors: null`).

### 2. Vista Administrador / Gestión (análisis técnico y comunicación preventiva)
- **Simulación dinámica (`DynamicSimulationView`):** autómata celular determinista en cuadrícula regular de **10 m** (8 vecinos, DEM Copernicus GLO-30 con *priority flood*, coeficientes de escorrentía, infiltración, drenaje e ingreso por Puerta 4), alimentable con presets históricos o pronóstico horario de 48 h.
- **Motor de reglas explicables (`R-MET` / `R-ACU` / `R-ESP` / `R-COND` / `R-EXT` / `R-HID`):** separa explícitamente peligro meteorológico, exposición espacial y orientación preventiva, con ventanas de acción por hora.
- **Red de sensores IoT virtuales — `YAKU SENSE`:** 6 nodos georreferenciados simulados acoplados a la malla hidráulica, etiquetados explícitamente como **`PROPUESTA_FUTURA_NO_OPERATIVA`** (sin hardware instalado ni telemetría real).
- **Mapa técnico y análisis espacial Shapely (`CampusMapView` + `SimulatorView`):** escenarios heredados **A** (relieve DEM p15), **B** (zonas reportadas), **C** (combinado) y **D** (condiciones externas declaradas manualmente sí/no).
- **Difusión preventiva simulada por perfil y canal (`PreventionView`):** generador de avisos diferenciados para **Estudiantes**, **Docentes** y **Personal administrativo** en formato **WhatsApp / Telegram** o **Correo institucional UNT**, con copiado en un clic y descarga/impresión de boletín (simulación TRL 3–4; no envía mensajes a sistemas reales).
- **Continuidad académica y administrativa (`ContinuityView`):** pautas diferenciadas por fase (**Antes / Durante / Después**) y por nivel preventivo, cubriendo clases virtuales, reprogramación sin penalización, Mesa de Partes virtual UNT, trabajo remoto temporal en oficinas de planta baja y resguardo de expedientes y equipos.

---

## Estructura del Proyecto

- `backend/` — API REST en **FastAPI** + **Shapely 2.x** + **NumPy** + motor celular 10 m + cliente **Open-Meteo** (respaldo local offline) + suite `pytest` (70 pruebas).
- `frontend/` — Interfaz en **React + Vite + Tailwind CSS + Leaflet** con vistas diferenciadas para Estudiante y Administrador y modo 100 % offline.
- `docs/` — Matriz de cumplimiento, Entregables Stage-Gate 1 (Ficha del Problema, Ficha Técnica, Plan de Validación) y Defensa de Jurado.
- `scripts/` — Generación de malla de terreno (`build_terrain_grid.py`) y calibración histórica (`calibrar_lluvia_historica.py`).
- `pitch/` — Generador y presentación PowerPoint oficial (`YAKU_ALERT_UNT_PITCH.pptx`).

---

## Endpoints Principales de la API (`backend/app/main.py`)

| Método y ruta | Descripción |
| :--- | :--- |
| `GET /api/health` | Estado del servicio, alcance TRL 3–4 y marco normativo completo. |
| `GET /api/weather?offline=false\|true` | Pronóstico horario Open-Meteo o respaldo local (`OFFLINE_FALLBACK`). |
| `GET /api/campus/layers` | Capas GeoJSON del campus (`campus`, `hazards` y `evacuation`). |
| `GET /api/campus/evacuation` | Puntos seguros y rutas referenciales de evacuación dentro del campus UNT. |
| `GET /api/preventive/evaluate` | Evaluación preventiva explicable sobre pronóstico/caché y condiciones externas. |
| `POST /api/simulate` | Simulación paramétrica offline (escenarios A/B/C/D con Shapely). |
| `GET /api/conditions` | Catálogo de condiciones externas declarables manualmente (sí/no). |
| `GET /api/protocols` | Niveles preventivos, continuidad académica/administrativa por fase y contexto de quebradas. |
| `GET /api/hydro/presets` | Presets horarios de referencia (2017, 2023 y escenario extremo hipotético). |
| `POST /api/hydro/run` · `POST /api/hydro/evaluate` | Corrida y evaluación del autómata celular 10 m con reglas `R-HID`. |
| `GET /api/hydro/forecast` | Simulación dinámica de 48 h alimentada con el pronóstico o caché offline. |
| `GET /api/sensors/virtual` | Catálogo de los 6 sensores IoT virtuales `YAKU SENSE` (`PROPUESTA_FUTURA_NO_OPERATIVA`). |
| `GET /api/public/simulation/{preset_id}` | Simulación pública cacheada (`evento_2017_03` / `evento_2023_03_10`, `virtual_sensors: null`). |

---

## Requisitos Previos

- **Docker** y **Docker Compose** (recomendado para demo presencial), o bien:
- **Python 3.11+** y **Node.js 20+** con **npm** para ejecución local directa.

---

## Ejecución Rápida con Docker (Recomendado)

```powershell
docker compose up --build -d
```
- **Frontend (Nginx + React + Leaflet):** `http://localhost:8080`
- **Backend (FastAPI + Shapely):** `http://localhost:8000/docs`

Para detener los contenedores:
```powershell
docker compose down
```

### Ejecutar sin Docker y abrir la vista móvil con QR

Instala primero las dependencias del backend y la web (Python, `pip install -r backend/requirements.txt`, Node.js y `npm install` dentro de `frontend`). Luego ejecuta:

```powershell
./scripts/start-demo-tunnel.ps1
```

El script inicia el backend y la web localmente, abre un túnel temporal de Cloudflare hacia la web, crea el QR para la vista móvil y muestra su enlace. Escanea `YAKU_ALERT_QR_ACTUAL.png` desde el celular. Mantén esa terminal abierta mientras uses la app; `Ctrl+C` detiene los servicios. Cada ejecución puede producir un enlace distinto y reemplaza el QR anterior.

---

## Instalación y Ejecución Local (Sin Docker)

### 1. Backend (FastAPI)
```powershell
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API disponible en: `http://127.0.0.1:8000/docs`

### 2. Frontend (React + Vite + Leaflet)
En otra terminal:
```powershell
cd frontend
npm install
npm run dev
```
Aplicación web disponible en: `http://localhost:5173`

---

## Verificación en Modo 100 % Offline (Sin Wi-Fi)

La plataforma está blindada para demostraciones presenciales sin conexión a internet:
1. Activa el botón **Modo offline** en la cabecera superior (o desconecta la red del equipo).
2. El backend responde automáticamente desde la caché meteorológica local (`OFFLINE_FALLBACK` en `/api/weather` y `/api/hydro/forecast`), declarando el periodo de la caché.
3. Todos los mapas (`StudentMonitoringMap`, `StudentSimpleSimulation` y `CampusMapView`) cambian automáticamente al mapa base **Solo vectorial (sin internet)**, renderizando perímetro, vías, áreas verdes, edificios, agua modelada y puntos/rutas referenciales desde los GeoJSON locales.
4. La simulación dinámica, los presets 2017/2023, las reglas `R-MET`/`R-HID`, el generador de avisos y la vista de continuidad operan 100 % en local.

---

## Ejecución de Pruebas Automatizadas y Compilación

```powershell
# Suite backend (70 pruebas)
cd backend
python -m pytest -v

# Compilación de producción frontend
cd frontend
npm run build
```

---

## Marco Normativo, Alcance TRL 3–4 y Limitaciones

### Cumplimiento normativo (Desafío 3)
- **Ley N.° 29664** (Ley que crea el SINAGERD): apoyo informativo y preparación preventiva; no reemplaza alertas oficiales de SENAMHI, COEN, INDECI ni Defensa Civil UNT.
- **D.S. N.° 048-2011-PCM** (Reglamento de la Ley N.° 29664): alineamiento con los procesos de estimación, prevención y preparación.
- **D.S. N.° 115-2022-PCM** (**PLANAGERD 2022–2030**): contribución a la gestión prospectiva/reactiva y a la continuidad académica y administrativa universitaria.
- **Ley N.° 29733** (Ley de Protección de Datos Personales): cero recopilación de datos personales (PII), cuentas, DNI ni geolocalización GPS.

### Alcance TRL 3–4 y límites científicos declarados
- **Prototipo TRL 3–4:** evaluado en entorno simulado; no es un sistema operativo de alerta temprana ni un modelo hidrodinámico calibrado (no sustituye estudios de CENEPRED/SIGRID/INDECI).
- **Escenarios heredados A/B/C/D:** A usa el percentil 15 del DEM Copernicus GLO-30 (~30 m, error vertical ±4 m); B usa zonas reportadas por testimonio/prensa no verificadas (franjas viales recortadas a 40 m del perímetro); C combina DEM p30 + reportes; D usa condiciones externas declaradas manualmente. La lluvia no altera los polígonos de A/B/C/D (alimenta únicamente las reglas preventivas y el autómata celular de 10 m).
- **Influencia sintética (B/C):** capa demostrativa separada según azimut descendente del DEM (~203°) y alcances arbitrarios de 40/80 m (buffer 15 m); no es predicción.
- **Puntos seguros y rutas referenciales:** generados sobre la malla de elevación del campus con fines orientativos (`reference_only: true`). No reemplazan la señalización oficial de Defensa Civil UNT.
- **Sensores `YAKU SENSE`:** arquitectura IoT simulada (`PROPUESTA_FUTURA_NO_OPERATIVA`) para demostrar integración futura; no existen sensores físicos instalados en el campus ni en las quebradas San Ildefonso, San Carlos o El León.
- **Canaletas nuevas de la UNT (hito del plan de validación):** actualmente no modeladas por ausencia de inventario geométrico/hidráulico; su levantamiento en campo junto con Defensa Civil y Servicios Generales UNT constituye un hito prioritario del plan de validación para pasar a TRL 5–6.
