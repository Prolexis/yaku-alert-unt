# YAKU SENSE — RESULTADOS DE PRUEBAS AUTOMATIZADAS Y E2E

> **Fecha de ejecución:** 26 de noviembre de 2026  
> **Rama:** `simulacion-dinamica`  
> **Entorno:** Python 3.11.9 (`pytest 8.0.0`), Vite 5.4.21, Docker Compose (`yaku-alert-backend` `:8000`, `yaku-alert-frontend` `:8080`), Playwright (`playwright-core` sobre Microsoft Edge headless).

---

## 1. Resumen de verificación integral

| Verificación | Comando / Herramienta | Resultado | Evidencia |
|---|---|---|---|
| **Pruebas backend completas (regresión + YAKU SENSE)** | `cd backend; python -m pytest -q` | **65 / 65 APROBADAS** | 60 pruebas previas (`test_api.py`, `test_conditions.py`, `test_hydro.py`, incluida `test_hydro_responses_never_use_prohibited_phrases`) + 5 pruebas nuevas en `test_virtual_sensors.py`. |
| **Compilación Frontend** | `cd frontend; npm run build` | **APROBADO (exit 0)** | 1603 módulos transformados (`dist/assets/index-B2uFo2bF.js`), 0 errores. |
| **Despliegue Docker Compose** | `docker compose up -d --build` | **APROBADO** | `yaku-alert-backend` (`healthy`) y `yaku-alert-frontend` (`up`), `GET /api/sensors/virtual` → `HTTP 200`. |
| **Pruebas E2E Playwright (YAKU SENSE)** | `node scratch/e2e_yaku_sense.mjs` | **6 / 6 APROBADAS (exit 0)** | 0 errores de página (`pageErrors=[]`), 0 fallos API (`failedApi=[]`), 3 capturas reales en `docs/evidencias/`. |

---

## 2. Matriz de cumplimiento de las 17 pruebas obligatorias

| # | Requisito verificado | Estado | Evidencia técnica |
|---|---|---|---|
| 1 | Seis sensores con IDs únicos (`S01`–`S06`) | **PASS** | `test_six_virtual_sensors_with_unique_ids_and_valid_metadata` |
| 2 | Tipo, variable y unidad válidos | **PASS** | `test_six_virtual_sensors_with_unique_ids_and_valid_metadata` |
| 3 | Coordenadas válidas en EPSG:4326 | **PASS** | `test_virtual_sensors_coordinates_inside_model_domain_and_open_cells` |
| 4 | Puntos dentro del ámbito del modelo y en celdas abiertas exteriores | **PASS** | `in_model_domain == True` y `is_open_cell == True` para los 6 sensores |
| 5 | Sensores de nivel (`S02`, `S03`, `S04`) reciben datos reales de `hydro.py` | **PASS** | `test_hydro_run_populates_deterministic_sensor_series` (`S03` mostró `1.3 cm` máx en Evento 2023) |
| 6 | Series coinciden temporalmente con `frames` del escenario | **PASS** | `[p["hour"] for p in series] == [f.hour for f in frames]` |
| 7 | Sin lecturas aleatorias de nivel (ni datos inventados en `S05`/`S06`) | **PASS** | `S05` y `S06` devuelven `virtual_status == "no_reading"`, `last_value is None` |
| 8 | Reproducibilidad exacta al repetir escenario | **PASS** | `res1.virtual_sensors == res2.virtual_sensors` |
| 9 | Nunca etiqueta datos sintéticos como mediciones reales ni usa términos prohibidos | **PASS** | `test_hydro_responses_never_use_prohibited_phrases` + `reading_label == "Lámina modelada en el punto virtual"` |
| 10 | Desconexión simulada conserva última lectura y antigüedad sin poner en cero | **PASS** | Playwright paso 3 (`docs/evidencias/13_yaku_sense_dinamica.png`: `S03` conservó `1.3 cm` de `h+10` con borde ámbar discontinuo) |
| 11 | Asistente YAKU encuentra sensores por ID, nombre y ubicación | **PASS** | Playwright paso 5 (`docs/evidencias/14_yaku_sense_asistente.png`: `"¿Qué indica el sensor del comedor?"` → `S03` + `Ver S03 en Mapa UNT`) |
| 12 | Mapa permite activar capa, seleccionar sensores y ver fichas/LoRaWAN | **PASS** | Playwright pasos 1–2 (`docs/evidencias/12_yaku_sense_mapa.png`: 6 marcadores + ficha `S03` + acordeón LoRaWAN) |
| 13 | Simulación dinámica sigue funcionando sin la capa de sensores | **PASS** | Playwright paso 4 (`Marcadores tras desactivar=0`, simulación intacta) |
| 14 | Los 11 endpoints existentes conservan su comportamiento | **PASS** | 60 pruebas previas en `pytest` aprobadas sin regresiones |
| 15 | Aplicación funciona en Docker Compose | **PASS** | `docker compose up -d --build` + `GET /api/sensors/virtual` = `HTTP 200` |
| 16 | Frontend compila limpiamente | **PASS** | `npm run build` (`1603` módulos, exit 0) |
| 17 | Pruebas existentes continúan pasando | **PASS** | 65 / 65 aprobadas |

---

## 3. Evidencias visuales reales (`docs/evidencias/`)

- `docs/evidencias/12_yaku_sense_mapa.png` — Capa `Sensores IoT [SIM]` en **Mapa UNT**, ficha técnica de `S03` y acordeón **«¿Cómo se conectaría físicamente?»** (LoRaWAN / ChirpStack).
- `docs/evidencias/13_yaku_sense_dinamica.png` — **Simulación dinámica `[EXP]`** (`Evento tipo 2023`, drenaje obstruido, Puerta 4 alto) con marcadores sincronizados, gráfica de evolución horaria (`Máx: 1.3 cm (h+9)`) y desconexión simulada en `S03` conservando `1.3 cm` (`h+10`).
- `docs/evidencias/14_yaku_sense_asistente.png` — **Asistente YAKU** respondiendo offline a *«¿Qué indica el sensor del comedor?»* con explicación virtual y enlace directo **`Ver S03 en Mapa UNT`**.
