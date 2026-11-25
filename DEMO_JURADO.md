# GUION DE DEMOSTRACIÓN PARA JURADO (90 SEGUNDOS), RESPALDO OFFLINE Y VALIDACIÓN CON USUARIOS

> **URL local de demostración:** `http://localhost:8080` (Docker Compose activo: `yaku-alert-backend` en `:8000` y `yaku-alert-frontend` en `:8080`)  
> **Instalación verificada para la demo:** `Comedor Universitario` (`way/1034573626`, OpenStreetMap ODbL, registrado en `campus_unt.geojson`)  
> **Escenario configurado para la demo:** `Escenario C — Combinado` (relieve DEM Copernicus GLO-30 + zonas reportadas + alcance sintético)  
> **Evidencias visuales reales:** Carpeta `docs/evidencias/` (`01_dashboard.png` a `11_modo_offline.png`)

---

## 1. Configuración exacta previa a la demostración

1. Verificar contenedores saludables: `docker compose ps` (`yaku-alert-backend` healthy, `yaku-alert-frontend` up).
2. Abrir `http://localhost:8080` en pantalla completa (1280×860 o superior), tema claro activo.
3. Confirmar en la barra superior el indicador verde **`Pronóstico`** (o **`Caché local`** si se decide demostrar offline).
4. Tener a mano `docs/evidencias/` como respaldo visual inmediato ante cualquier contingencia de proyector o red.

---

## 2. Guion cronometrado de demostración (90 segundos exactos)

| Tiempo | Vista | Acción exacta en pantalla | Mensaje clave para el jurado | Evidencia real |
|---|---|---|---|---|
| **00:00 – 00:15** | `Dashboard` | Mostrar `Condiciones en la UNT`, fuente `Open-Meteo · Pronóstico, no medición local`, hora Lima y KPIs 24 h. | *"Ante lluvias intensas o El Niño en Trujillo, un estudiante recibe reportes genéricos. YAKU ALERT traduce pronóstico y cartografía real de la UNT en información preventiva clara, separando siempre pronóstico de simulación."* | `docs/evidencias/01_dashboard.png` |
| **00:15 – 00:35** | `Asistente YAKU` → `Mapa UNT` | Abrir botón flotante **Asistente YAKU**, pulsar **`¿Dónde está el Comedor Universitario?`** y luego **`Ver en Mapa UNT`**. | *"Sin depender de LLMs externos ni conexión, el Asistente YAKU consulta el catálogo real de OpenStreetMap, ubica `Comedor Universitario` (`way/1034573626`) y centra Leaflet mostrando su ficha sin declarar nunca si un edificio es seguro o peligroso."* | `docs/evidencias/03_asistente_yaku.png`, `docs/evidencias/04_mapa_leaflet.png` |
| **00:35 – 00:55** | `Simulaciones` → `Mapa UNT` | Entrar a **Simulaciones**, seleccionar **Escenario C — Combinado**, pulsar **Ejecutar simulación** y mostrar edificios/accesos interceptados (Shapely) y banner **`MODO SIMULACIÓN — DATOS SINTÉTICOS`**. | *"Para preparación ante eventos extremos, calculamos intersecciones geométricas reales con Shapely sobre escenarios topográficos experimentales (DEM Copernicus GLO-30) y capas reportadas. Toda la interfaz se identifica como simulación."* | `docs/evidencias/05_escenario_c.png`, `docs/evidencias/06_mapa_con_escenario_c.png` |
| **00:55 – 01:15** | `Prevención` | Abrir **Prevención**, cambiar a **`Pronóstico / Caché`**, marcar la casilla manual **`Quebrada San Ildefonso activada`**, expandir **Reglas técnicas activadas** y pulsar **Descargar boletín**. | *"El motor no es caja negra: explica cada regla activada, permite declarar condiciones externas manualmente sin fingir sensores inexistentes, estructura el aviso en QUÉ/DÓNDE/CUÁNDO/QUÉ HACER/QUIÉN INFORMA y descarga un boletín HTML 100% offline."* | `docs/evidencias/07_prevencion_ficha.png`, `docs/evidencias/08_prevencion_condiciones_manuales.png` |
| **01:15 – 01:30** | `Continuidad` | Pasar a **Continuidad**, mostrar protocolos por rol (estudiante, docente, autoridad) y canales oficiales (SENAMHI, INDECI, COEN). | *"YAKU ALERT no reemplaza a SENAMHI ni a INDECI: los complementa para orientar a la comunidad UNT y sostener la continuidad académica incluso sin internet."* | `docs/evidencias/09_continuidad.png` |

---

## 3. Procedimiento de recuperación si falla internet durante la demo

YAKU ALERT fue diseñado y verificado para seguir operando **100% sin internet externo**:

1. **Si Open-Meteo falla o tarda:** El backend cambia automáticamente a `backend/app/data/weather_cache.json` y muestra el banner de respaldo con fecha y motivo. También se puede forzar en un clic pulsando el botón **`Pronóstico`** en la barra superior para pasar a modo **`Caché local`** (`docs/evidencias/11_modo_offline.png`).
2. **Si los tiles de OpenStreetMap/Satélite no cargan en Leaflet:** Abrir el control **`Capas`** del mapa y seleccionar **`Modo Vectorial`** (renderiza 100% con el GeoJSON local del campus sin descargar mapas externos).
3. **Asistente YAKU, Simulador Shapely, Condiciones Manuales y Boletín:** Todos operan 100% en local (`localhost:8080` + `localhost:8000`) y no requieren internet.
4. **Si el contenedor se detuviera:** Ejecutar `docker compose up -d` en la raíz del repositorio (toma ~5 segundos con las imágenes ya construidas localmente).

---

## 4. Formulario de validación con usuarios reales (UNT)

> **Política de integridad:** Este registro está **en blanco** de forma deliberada. No contiene participantes ni métricas inventadas. El equipo debe aplicarlo con 5–10 estudiantes/docentes reales de la UNT antes de la evaluación final.

### Instrucciones para el facilitador
- Entregar el enlace local (`http://localhost:8080`) en laptop o móvil sin ayudar al participante, salvo bloqueo total.
- Usar cronómetro por tarea y anotar cada error o duda sin inducir respuestas.
- Pedir al participante que piense en voz alta.

### Las 5 tareas estandarizadas
- **T1 (Pronóstico y límites):** Identificar si lloverá en las próximas 24 horas en la UNT y verificar si el dato es un pronóstico o una medición local.
- **T2 (Asistente YAKU + Mapa):** Abrir el **Asistente YAKU**, preguntar por el **Comedor Universitario** (o su facultad) y ubicarlo en **Mapa UNT**.
- **T3 (Simulación vs realidad):** Activar el **Escenario C** en **Simulaciones** y explicar con sus palabras si representa una alerta real o un escenario sintético.
- **T4 (Prevención y boletín):** Revisar la ficha en **Prevención** (QUÉ / DÓNDE / CUÁNDO / QUÉ HACER) y descargar el boletín preventivo.
- **T5 (Condiciones externas):** En modo `Pronóstico / Caché`, localizar las casillas de condiciones externas y explicar de dónde provienen esos datos (declaración manual vs sensores).

### Registro de campo (en blanco — para completar por el equipo)

| ID | Perfil (Facultad / Ciclo / Rol) | Dispositivo (PC / Móvil) | Tarea | Tiempo (s) | Errores (#) | Resultado (Éxito / Parcial / Fallo) | Dificultad percibida (1=Muy fácil, 5=Muy difícil) | Comentario textual del participante |
|---|---|---|---|---|---|---|---|---|
| U01 | | | T1 / T2 / T3 / T4 / T5 | | | | | |
| U02 | | | T1 / T2 / T3 / T4 / T5 | | | | | |
| U03 | | | T1 / T2 / T3 / T4 / T5 | | | | | |
| U04 | | | T1 / T2 / T3 / T4 / T5 | | | | | |
| U05 | | | T1 / T2 / T3 / T4 / T5 | | | | | |
