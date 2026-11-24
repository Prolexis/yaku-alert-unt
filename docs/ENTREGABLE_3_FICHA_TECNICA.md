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
- **Pruebas automatizadas:** `pytest` + `fastapi.testclient`.

---

## 3. ¿Cómo se utiliza? (3 Vistas Principales)
1. **Vista 1 — Monitoreo:** Muestra el pronóstico horario (24–48 h), intensidad máxima (mm/h), acumulados, duración estimada, probabilidad y humedad. Permite activar el **Modo sin conexión (caché)** y verificar fuente, unidades, hora de actualización y limitaciones.
2. **Vista 2 — Mapa de Escenarios Experimentales:** Visualiza el campus UNT en Leaflet con edificios, accesos, puntos de encuentro referenciales y rutas referenciales. El panel izquierdo permite ejecutar el **Simulador Offline** con tres zonas por mecanismo —A: acumulación por relieve (DEM de 30 m), B: ingreso por avenidas y puertas (zonas reportadas por testimonio/prensa) y C: combinación— calculando con Shapely qué edificios y accesos quedan dentro de cada zona. La lluvia no modifica estos polígonos.
3. **Vista 3 — Prevención y Respuesta:** Genera la **Ficha Preventiva Explicable**, detallando por separado el peligro, la exposición espacial, las reglas exactas activadas (`R-MET-*`, `R-ACU-*`, `R-ESP-*`), las orientaciones preventivas, las alternativas de continuidad académica UNT, el contexto informativo de quebradas de Trujillo y los límites legales/científicos.

---

## 4. Seguridad, Ética y Normativa
- **Sin datos personales (Ley N.° 29733):** No solicita registro, DNI, correo ni ubicación GPS del usuario.
- **Sin falsas alertas (Ley N.° 29664 — SINAGERD):** No emite alertas operativas reales ni sustituye a Defensa Civil UNT, SENAMHI, COEN o INDECI.
- **Cabeceras de seguridad HTTP:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
