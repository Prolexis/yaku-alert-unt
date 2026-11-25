# Diagnóstico de acumulación y ajuste del relleno (Fase 1.5)

**Capa nueva y exploratoria.** Este informe diagnostica dónde se acumula el agua modelada,
qué hace el relleno de microdepresiones y qué tope de relleno se adopta. No es una
estimación de eventos futuros ni un estudio hidrológico.

- **Script reproducible:** `scripts_nuevos/diagnostico_acumulacion.py`
- **Datos crudos del informe:** `datos_nuevos/analisis/diagnostico_acumulacion_datos.json`
- **Motor:** `backend/app/services/hydro.py` (autómata celular, numpy, determinista)
- **Superficie:** `backend/app/data/terrain_grid.json` (122×123 celdas de 10 m)
- **Parámetros:** `backend/app/data/hydro_params.json`

## Método y definiciones

- **Hora pico:** el marco horario con mayor área mojada (la reporta el motor como `peak_hour`).
- **Celda mojada:** lámina ≥ 1 cm (umbral visible, SUPUESTO).
- **Grupo:** componentes conexas de 8 vecinos de celdas mojadas.
- **Zona de acumulación:** grupo de ≥ 5 celdas (≥ 500 m²) con profundidad máxima ≥ 5 cm.
- **Cota cruda:** elevación bilineal del DEM de 30 m. **Cota rellenada:** superficie de
  enrutamiento (cruda + relleno de microdepresiones).
- **Casos** (todos con la serie horaria de `hydro_params.json`):
  1. `evento_2023_p4_medio` — evento 2023-03-10 (35 mm), drenaje normal, ingreso P4 medio.
  2. `extremo_p4_alto` — extremo hipotético (70 mm), drenaje obstruido, P4 alto, secundario activo.
  3. `solo_lluvia_sin_ingreso` — los mismos 35 mm sin ingreso externo.

---

## 1. El relleno de microdepresiones y las 20 mayores subidas

### 1.1 Distribución de la subida (solo celdas rellenadas)

| Tope | Celdas rellenadas | p50 | p90 | p99 | máx |
|---|---:|---:|---:|---:|---:|
| sin tope (Fase 1) | 2 807 | 0,32 m | 0,91 m | 1,58 m | 2,63 m |
| 1,0 m | 2 231 | 0,26 m | 0,75 m | 1,00 m | 1,00 m |
| **0,5 m (adoptado)** | **1 707** | **0,20 m** | **0,50 m** | **0,50 m** | **0,50 m** |

Con el tope adoptado, el preprocesamiento rellena 1 744 celdas (subida > 0; el informe
cuenta 1 707 con subida ≥ 5 mm, el resto son diferencias de redondeo).

### 1.2 Dónde están las 20 mayores subidas (sin tope)

| # | Subida | lon, lat | Cota cruda | Elemento más cercano | Zona reportada |
|---:|---:|---|---:|---|---|
| 1 | 2,63 m | -79,04122, -8,11823 | 16,0 | Estacionamiento (27 m) | — |
| 2 | 2,40 m | -79,04122, -8,11814 | 16,2 | Estacionamiento (20 m) | — |
| 3 | 2,38 m | -79,04131, -8,11823 | 16,3 | Estacionamiento (22 m) | — |
| 4 | 2,17 m | -79,04131, -8,11814 | 16,5 | Estacionamiento (13 m) | — |
| 5 | 2,10 m | -79,04113, -8,11823 | 16,6 | Estacionamiento (34 m) | — |
| 6 | 1,91 m | -79,04113, -8,11814 | 16,7 | Estacionamiento (30 m) | — |
| 7 | 1,91 m | -79,03678, -8,11235 | 24,1 | Área deportiva (30 m) | — |
| 8 | 1,88 m | -79,03678, -8,11226 | 24,1 | Área deportiva (24 m) | — |
| 9 | 1,85 m | -79,03678, -8,11217 | 24,1 | Área deportiva (20 m) | — |
| 10 | 1,84 m | -79,03687, -8,11235 | 24,1 | Área deportiva (25 m) | — |
| 11 | 1,83 m | -79,03659, -8,11208 | 24,1 | Estacionamiento (15 m) | **CIDUNT** |
| 12 | 1,82 m | -79,03668, -8,11208 | 24,1 | Estacionamiento (13 m) | **CIDUNT** |
| 13 | 1,82 m | -79,03986, -8,11371 | 21,0 | Edificio sin nombre (12 m) | — |
| 14 | 1,81 m | -79,03650, -8,11208 | 24,2 | Estacionamiento (22 m) | **CIDUNT** |
| 15 | 1,80 m | -79,03678, -8,11208 | 24,2 | Estacionamiento (17 m) | **CIDUNT** |
| 16 | 1,79 m | -79,04122, -8,11832 | 16,9 | Estacionamiento (35 m) | — |
| 17 | 1,76 m | -79,04140, -8,11823 | 16,9 | Estacionamiento (21 m) | — |
| 18 | 1,76 m | -79,03986, -8,11380 | 21,1 | Edificio sin nombre (8 m) | — |
| 19 | 1,74 m | -79,03687, -8,11226 | 24,2 | Área deportiva (16 m) | — |
| 20 | 1,72 m | -79,04403, -8,11687 | 17,9 | Área deportiva (60 m) | — |

**Hallazgo central:** las depresiones más profundas del DEM **no son ruido repartido**:
se agrupan (a) en el estacionamiento suroeste / punto más bajo del campus (cotas 16–18 m),
(b) en el **estadio** (cotas 24,1 m) y (c) **dentro de la zona reportada del estacionamiento
junto a CIDUNT** (cotas 24,1 m). Es decir, el DEM sí contiene cuencas internas que coinciden
con los puntos que el equipo reporta como empozamiento. **El relleno sin tope las eliminaba.**

---

## 2. Comparación de topes de relleno

Cada celda del siguiente cuadro es una corrida completa del motor (48 h) con el relleno
recalculado a ese tope:

| Tope | Caso | Hora pico | Prof. máx | Área mojada pico | Zonas ≥ 500 m² |
|---|---|---:|---:|---:|---:|
| sin tope | 2023 + P4 medio | h+9 | 38,2 cm | 480 200 m² | 25 |
| sin tope | extremo + P4 alto | h+10 | 95,6 cm | 655 600 m² | 6 |
| sin tope | solo lluvia | h+10 | 7,5 cm | 21 400 m² | 1 |
| 1,0 m | 2023 + P4 medio | h+9 | 94,7 cm | 427 800 m² | 34 |
| 1,0 m | extremo + P4 alto | h+10 | 176,8 cm | 625 500 m² | 7 |
| 1,0 m | solo lluvia | h+10 | 7,5 cm | 23 300 m² | 1 |
| **0,5 m** | **2023 + P4 medio** | **h+9** | **120,4 cm** | **383 800 m²** | **52** |
| **0,5 m** | **extremo + P4 alto** | **h+10** | **203,3 cm** | **594 000 m²** | **19** |
| **0,5 m** | **solo lluvia** | **h+10** | **10,2 cm** | **24 100 m²** | **5** |

### Localización de los grupos con 1,0 m vs 0,5 m

| Tope | Caso | Grupos principales (sector, profundidad máx) |
|---|---|---|
| 1,0 m | 2023 | SO 18,6 cm (153 900 m²) · S 16,0 · **NO 36,0 (Av. Jesús de Nazareth)** · O 15,5 |
| 1,0 m | extremo | SO 79,9 cm (573 700 m²) · SO 29,9 · O 24,4 |
| 0,5 m | 2023 | SO 16,1 cm (53 100 m²) · **SO 30,6 (estadio)** · S 15,8 · **NO 60,7 (CIDUNT)** |
| 0,5 m | extremo | SO 53,4 cm (241 300 m²) · **SO 68,6 (estadio)** · **NO 107,6 (Av. Jesús de Nazareth)** |

Con 0,5 m aparecen empozamientos en zonas coherentes con los reportes (CIDUNT, estadio,
estacionamiento suroeste, avenidas), que con 1,0 m y sin tope no se distinguen.

### Decisión

| | Valor |
|---|---|
| Valor anterior (`fill_max_rise_m`) | `null` (sin tope; máx observado 2,63 m) |
| **Valor nuevo** | **0,5 m** |
| Motivo | Conservar las cuencas internas que el DEM y los reportes del equipo coinciden en señalar (CIDUNT, estadio, estacionamiento suroeste) sin dejar que el relleno las borre. |

**Por qué 0,5 m y no 1,0 m:** con 1,0 m las depresiones de CIDUNT y del estadio (subidas de
1,7–1,9 m) siguen rellenas y no aparecen como zonas; con 0,5 m sí aparecen (CIDUNT: 23 800 m²
con 60,7 cm; estadio: 27 800 m² con 30,6 cm).

**Costo declarado (no se oculta):** el máximo sube de 38,2 cm (sin tope) a 120,4 cm en el
evento 2023 y a 203,3 cm en el extremo hipotético. Ese máximo **no lo produce el tope**, sino
la combinación declarada de ingreso externo sostenido 48 h + cuenca cerrada + drenaje
limitado: sin tope el mismo volumen se repartía en una lámina de 480 000 m² (≈4 cm de media),
que es menos realista que el empozamiento en las cuencas que el propio DEM y los reportes
identifican. El máximo de 120,4 cm ocurre en una depresión del DEM a cota 24,6 m
(-79,036230, -8,112079), a ~50 m de un estacionamiento; el de 203,3 cm, en el mismo punto.

**Nota de honestidad:** un DEM de 30 m con error vertical ±4 m no puede resolver un
empozamiento de 1–2 m: la profundidad es una estimación exploratoria del modelo, no un nivel
medido. Los máximos deben leerse como "el modelo concentra agua aquí", no como una cota de
inundación.

---

## 3. ¿Se acumula en más de una zona o solo en el suroeste?

Con el tope adoptado (0,5 m), **en más de una zona**:

| Caso | Zonas ≥ 500 m² | Sectores con acumulación |
|---|---:|---|
| 2023 + P4 medio | 52 | SO (coliseo, estadio, edificios), S (Puerta 2, Biblioteca de Idiomas), O (varios), **NO (CIDUNT)** |
| extremo + P4 alto | 19 | SO (dos grandes sábanas), **NO (Av. Jesús de Nazareth)**, O, S (Puerta 3), E |
| solo lluvia | 5 | SO/O pequeños (Auditorio, estacionamiento, Física) |

Sin ingreso externo, el drenaje (8 mm/h) se lleva casi todo: 10,2 cm de pico y 0 m³
almacenados al final. La acumulación sostenida aparece **solo** cuando se activa el ingreso
externo, que es un parámetro graduable declarado, no un caudal medido.

### 3.1 Los 10 mayores grupos en la hora pico (tope 0,5 m)

**Caso 1 — evento 2023 + P4 medio (pico h+9, máx 120,4 cm, 52 zonas):**

| Área | Prof. máx | Cota cruda / rellenada | Sector | Elemento más cercano |
|---:|---:|---|---|---|
| 53 100 m² | 16,1 cm | 19,64 / 19,72 | SO | Coliseo C.E.E. Rafael Narváez (84 m) |
| 27 800 m² | 30,6 cm | 18,59 / 18,65 | SO | Área deportiva (13 m) |
| 27 600 m² | 15,8 cm | 22,76 / 22,81 | S | Puerta 2 (43 m) |
| 25 000 m² | 15,5 cm | 25,43 / 25,47 | O | Edificio sin nombre OSM (219 m) |
| 23 800 m² | 60,7 cm | 26,43 / 26,50 | NO | **CIDUNT (29 m)** |
| 17 600 m² | 17,2 cm | 24,12 / 24,19 | O | Escuela de Ciencias Biológicas (21 m) |
| 15 100 m² | 24,3 cm | 26,25 / 26,30 | S | Biblioteca de Idiomas (2 m) |
| 14 600 m² | 23,2 cm | 20,83 / 20,96 | SO | Edificio sin nombre OSM (28 m) |
| 13 400 m² | 10,6 cm | 22,49 / 22,57 | S | Edificio sin nombre OSM (219 m) |
| 11 400 m² | 14,7 cm | 26,60 / 26,70 | NO | Edificio sin nombre OSM (22 m) |

**Caso 2 — extremo hipotético + P4 alto (pico h+10, máx 203,3 cm, 19 zonas):**

| Área | Prof. máx | Cota cruda / rellenada | Sector | Elemento más cercano |
|---:|---:|---|---|---|
| 241 300 m² | 53,4 cm | 24,43 / 24,49 | SO | Facultad de Ingeniería Química (20 m) |
| 202 800 m² | 68,6 cm | 20,33 / 20,39 | SO | Área deportiva (26 m) |
| 65 900 m² | 107,6 cm | 27,17 / 27,22 | NO | Acceso Av. Jesús de Nazareth (66 m) |
| 14 200 m² | 49,0 cm | 19,05 / 19,10 | SO | Acceso OSM (222 m) |
| 11 000 m² | 52,3 cm | 23,99 / 24,03 | O | Edificio sin nombre OSM (400 m) |
| 10 300 m² | 21,1 cm | 18,50 / 18,58 | SO | Acceso OSM (167 m) |
| 8 400 m² | 36,5 cm | 30,17 / 30,23 | NE | Acceso Av. Jesús de Nazareth (231 m) |
| 6 300 m² | 23,5 cm | 21,56 / 21,59 | S | Puerta 3 (390 m) |
| 5 500 m² | 49,8 cm | 22,40 / 22,46 | O | Edificio sin nombre OSM (199 m) |
| 4 900 m² | 28,0 cm | 27,79 / 27,89 | E | Área deportiva (69 m) |

**Caso 3 — solo lluvia, sin ingreso (pico h+10, máx 10,2 cm, 5 zonas):**

| Área | Prof. máx | Cota cruda / rellenada | Sector | Elemento más cercano |
|---:|---:|---|---|---|
| 2 500 m² | 5,6 cm | 22,58 / 22,81 | O | Edificio sin nombre OSM (16 m) |
| 1 300 m² | 8,0 cm | 24,71 / 24,81 | S | Edificio sin nombre OSM (38 m) |
| 900 m² | 9,6 cm | 22,95 / 23,20 | SO | Auditorio Coopérnico (22 m) |
| 700 m² | 6,5 cm | 21,55 / 21,65 | SO | Estacionamiento (30 m) |
| 500 m² | 5,3 cm | 24,60 / 24,78 | SO | Facultad de Ciencias Físicas y Matemáticas (7 m) |

---

## 4. Puntos reportados por el equipo como sumideros opcionales

### 4.1 ¿Están representados en el modelo?

| Punto reportado | En el modelo | Cómo |
|---|---|---|
| **Puerta 4 / Av. Jesús de Nazareth** | Sí | Celdas de ingreso `p4` (obligatorias) y zona reportada `rep_puerta4` |
| **Av. Juan Pablo II** | Sí | Ingreso secundario `secundario` (P1–P3) y zona `rep_av_juan_pablo` |
| **CIDUNT** | Parcial | Zona reportada `rep_estac_cidunt` (la depresión del DEM coincidía, pero el relleno la eliminaba) |
| **Derecho** | Parcial | Zona reportada `rep_estac_derecho` (sin depresión marcada en el DEM) |

Las 4 zonas están en `campus_unt.geojson` (`category = zona_reportada`) y ahora también como
`reported_zones` en `terrain_grid.json` (614 celdas abiertas).

### 4.2 Sumideros locales opcionales

- **Bandera:** `use_reported_sinks` (en `POST /api/hydro/run`, en `GET /api/hydro/forecast`
  y en el motor). **Apagada por defecto.**
- **Efecto:** las celdas de cada zona reportada retienen hasta `storage_depth_m` de lámina
  (almacenamiento local); el excedente sigue el flujo y el drenaje normal. La masa se
  conserva (el agua retenida queda contada en `almacenada`).
- **Profundidad SUPUESTA:** `storage_depth_m = 0,20 m` (rango 0,05–0,60), declarada en
  `hydro_params.json -> sumideros_reportados`, con `reported = true` en cada sumidero.
- **API:** `assumptions[]` indica si están ACTIVOS (y con qué profundidad) o DESACTIVADOS;
  `parameters.reported_sinks` y `metadata.reported_sinks` listan celdas y profundidad.

---

## 5. Supuestos que la API declara siempre

`assumptions[]` de `/api/hydro/run`, `/api/hydro/forecast` y (en su bloque propio)
`/api/hydro/presets` incluye, entre otros:

- "DEM de 30 m interpolado a 10 m, error vertical ±4 m".
- "Microdepresiones rellenadas hasta 0,5 m por celda para el enrutamiento (priority flood,
  práctica estándar); las cotas reportadas son las del DEM crudo".
- "Las profundidades que muestra esta respuesta son estimaciones exploratorias de una capa
  de agua modelada, no mediciones ni niveles de inundación observados".
- Estado de los sumideros reportados (activos/desactivados).

## 6. Pruebas

`backend/tests/test_hydro.py` añade:

- `test_priority_flood_fill_respects_max_rise` — el relleno sube como máximo el tope y, sin
  tope, rellena más que con tope.
- `test_reported_sinks_add_local_storage_and_conserve_mass` — con sumideros activos hay más
  agua almacenada en las celdas reportadas, la masa se conserva y los supuestos lo declaran.

## 7. Limitaciones

- El DEM de 30 m (±4 m) no resuelve la topografía real a 10 m: las cuencas internas son
  probables, no medidas.
- Las profundidades máximas (120 cm en 2023, 203 cm en el extremo) dependen del ingreso
  externo sostenido y del estado de drenaje declarados; no son cotas de inundación.
- Los umbrales de grupo (≥ 500 m², ≥ 5 cm) son de comunicación, no estándares.
- Ningún resultado califica edificios, accesos ni zonas como seguros o peligrosos.
