# ENTREGABLE 3 — FICHA TÉCNICA
**Nombre de la propuesta:** YAKU ALERT — UNT  
**Desafío:** Desafío 3 — Gestión de riesgos y desastres ante el Fenómeno El Niño  
**Nivel de Madurez Tecnológica (TRL):** TRL 3–4 (Prueba de concepto y prototipo funcional evaluado en entorno simulado)

---

## 1. Descripción General
**YAKU ALERT — UNT** es una aplicación web full-stack de monitoreo meteorológico, análisis espacial geográfico y apoyo preventivo explicable para la Ciudad Universitaria de la Universidad Nacional de Trujillo (UNT). Distingue de forma permanente entre **datos reales de pronóstico** y **escenarios sintéticos simulados**.

---

## 2. Arquitectura y Herramientas Utilizadas
- **Frontend:** React 18, Vite, Tailwind CSS, Leaflet (mapas interactivos), Lucide React.
- **Backend:** Python 3.11, FastAPI, Uvicorn, Pydantic v2 (validación estricta de entradas), HTTPX (cliente API con forzado IPv4 y fallback local).
- **Procesamiento Geoespacial:** Shapely 2.x (cálculo real de intersecciones geométricas y porcentajes de solapamiento sobre GeoJSON).
- **Datos y Respaldo Offline:**
  - API meteorológica real: **Open-Meteo Weather Forecast API** (`latitude=-8.114656`, `longitude=-79.038595`, `America/Lima`).
  - Caché local verificada (`open_meteo_fallback.json`) para operación sin internet.
  - Capas referenciales del campus UNT (`campus_unt.geojson`) y escenarios experimentales por mecanismo (`hazard_scenarios.geojson`).
  - Lluvia histórica regional: Open-Meteo Archive en tres ventanas documentadas (2017, 2023, 2025); reanálisis aproximado, no sustituye estaciones SENAMHI. Si no hay conexión, los valores previos 12/28/45 mm/h se etiquetan como supuestos de demostración.
- **Pruebas automatizadas:** `pytest` + `fastapi.testclient`.

---

## 3. ¿Cómo se utiliza? (3 áreas funcionales principales; 6 vistas de navegación)
1. **Vista 1 — Monitoreo:** Muestra el pronóstico horario (24–48 h), intensidad máxima (mm/h), acumulados, duración estimada, probabilidad y humedad. Permite activar el **Modo sin conexión (caché)** y verificar fuente, unidades, hora de actualización y limitaciones.
2. **Vista 2 — Mapa de Escenarios:** Visualiza geometrías OSM referenciales, accesos y zonas separadas: **A** sectores bajos p15 experimental del DEM GLO-30 (~30 m); **B** puntos/franjas reportadas por testimonio o prensa; **C** relieve p30 más reportes. La influencia punteada **SINTÉTICA** se calcula aparte y sus exposiciones no se suman a las del escenario. Shapely mide intersecciones, no simula flujo hidráulico. La lluvia no modifica geometrías.
3. **Vista 3 — Prevención y Respuesta:** Genera la **Ficha Preventiva Explicable**, detallando por separado el peligro, la exposición espacial, las reglas exactas activadas (`R-MET-*`, `R-ACU-*`, `R-ESP-*`), las orientaciones preventivas, las alternativas de continuidad académica UNT, el contexto informativo de quebradas de Trujillo y los límites legales/científicos.

---

## 4. Seguridad, Ética y Normativa
- **Sin datos personales (Ley N.° 29733):** No solicita registro, DNI, correo ni ubicación GPS del usuario.
- **Sin falsas alertas (Ley N.° 29664 — SINAGERD):** No emite alertas operativas reales ni sustituye a Defensa Civil UNT, SENAMHI, COEN o INDECI.
- **Cabeceras de seguridad HTTP:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.

## 5. Naturaleza de datos y límites de la demostración

- **OSM referencial:** edificios, accesos, vías y perímetro; no son catastro oficial verificado por la UNT.
- **Testimonio no verificado / prensa:** zonas reportadas ancladas a geometrías OSM. Las franjas de Av. Jesús de Nazareth y Av. Juan Pablo II se muestran solo dentro de 40 m del perímetro; la extensión real del encharcamiento no está documentada.
- **Experimental DEM:** A usa p15 y C usa p30 de Copernicus GLO-30. La resolución de ~30 m no representa puertas, microdrenaje ni flujo; no se modela flujo hidráulico.
- **Sintético demostrativo:** azimut de descenso DEM (~203°), desplazamiento configurable por defecto B=40 m y C=80 m, buffer lateral 15 m. Son parámetros elegidos solo como escalas ilustrativas: C duplica B para distinguir el escenario combinado y 15 m da visibilidad lateral al polígono; no hay base de campo. No predicen inundación ni dependen de la lluvia. 40 m de frente es un recorte cartográfico para mostrar el tramo de avenida junto al campus, no una medición o umbral de agua.
- **Lluvia de referencia:** máximos horarios, máximos móviles 24 h y horas con precipitación ≥0,1 mm consultados para 12–18 mar 2017, 9–16 mar 2023 y 26–31 mar 2025. El reanálisis puede subestimar eventos locales; no reemplaza estaciones SENAMHI. Los presets se asignan por acumulado de 24 h ascendente y limitan su duración a 1–24 h. Si la fuente da valores cercanos a cero, se muestran tal cual; los antiguos 12/28/45 mm/h quedan etiquetados solo como supuestos.
- Valores consultados el 24-nov-2026: 2017 = 3,1 mm/h máx., 21,8 mm/24 h, 49 h húmedas (B, duración acotada a 24 h); 2023 = 2,8 mm/h, 23,8 mm/24 h, 60 h (C, acotada a 24 h); 2025 = 5,0 mm/h, 13,0 mm/24 h, 16 h (A). El orden de presets es por acumulado ascendente (A=2025, B=2017, C=2023), no cronológico.
- **Canaletas nuevas de la UNT:** no modeladas (sin datos). La lista de curación permanece vacía y se llenará solo con datos de la UNT o una visita de campo.
- Las zonas y respuestas no declaran ningún lugar seguro y no reemplazan estudios de CENEPRED/SIGRID/INDECI.

### Preguntas probables del jurado

1. **¿Por qué A y C caen en el suroeste?** Por los sectores relativamente bajos que resultan de los percentiles del DEM en el campus. Es una tendencia experimental del DSM de 30 m, no una trayectoria de agua ni una predicción local.
2. **¿Por qué la Puerta 4 no aparece en el DEM?** El DEM describe elevación en celdas de ~30 m, no puertas, muros ni aberturas; la Puerta 4 es un anclaje testimonial/prensa en B/C, no un elemento inferido del DEM.
3. **¿De dónde sale el alcance sintético?** De parámetros de demostración arbitrarios (40/80 m más 15 m lateral), orientados por el azimut DEM (~203°); no hay base de campo, por eso debe calibrarse con datos de la UNT.
