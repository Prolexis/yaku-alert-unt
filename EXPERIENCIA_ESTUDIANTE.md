# EXPERIENCIA ESTUDIANTE Y SEPARACIÓN POR ROLES — YAKU ALERT UNT

> **Rama:** `simulacion-dinamica`  
> **Objetivo:** Ofrecer una experiencia pública clara, comprensible y sin jerga técnica para **Estudiantes y Visitantes**, conservando intactas todas las capacidades técnicas y de diagnóstico en el rol **Administrador**.

---

## 1. Flujo público: Estudiante / Visitante (acceso sin inicio de sesión)

**CONSULTAR → EXPLORAR → SIMULAR → COMPRENDER → ACTUAR**

Navegación simplificada en 5 secciones:
1. **Inicio (`DashboardView.jsx`):** Resumen meteorológico de Open-Meteo, buscador «Explora tu campus» y acceso rápido.
2. **Mapa UNT (`StudentMonitoringMap.jsx`):** Mapa de monitoreo público con pronóstico 24 h / 48 h, búsqueda de facultades/pabellones/comedor, capa comprensible **«Zonas de atención»**, tarjeta breve por instalación/zona y botón *«Ver recomendaciones»*.
3. **Simulación sencilla (`StudentSimpleSimulation.jsx`):** Flujo en 3 pasos:
   - **Paso 1:** Elegir **Escenario tipo 2017** o **Escenario tipo 2023**.
   - **Paso 2:** Pulsar **«Ver simulación»** (`GET /api/public/simulation/{preset_id}`).
   - **Paso 3:** Reproducir / pausar / reiniciar la animación horaria, consultar hasta 3 indicadores básicos y hacer clic en cualquier edificio para ver su resultado exploratorio.
4. **Prevención (`PreventionView.jsx`):** Aviso estructurado en 5 ejes (*QUÉ / DÓNDE / CUÁNDO / QUÉ HACER / QUIÉN INFORMA*) y boletín HTML descargable 100% offline.
5. **Continuidad académica (`ContinuityView.jsx`):** Orientaciones por rol y canales oficiales (`SENAMHI`, `INDECI`, `COEN`).

El **Asistente YAKU** (`YakuAssistantDrawer.jsx`) adapta sus atajos y respuestas al rol activo: en modo estudiante responde consultas sobre pronóstico, facultades, zonas del mapa, escenarios 2017/2023 y protocolos **sin exponer sensores S01–S06 ni diagnósticos MQTT**.

---

## 2. Separación estricta entre Monitoreo y Simulación

| Aspecto | Contexto A: Mapa de monitoreo (`StudentMonitoringMap`) | Contexto B: Simulación sencilla (`StudentSimpleSimulation`) |
|---|---|---|
| **Qué representa** | Información actualizada disponible hoy en el campus. | Escenarios exploratorios de referencia (**tipo 2017** y **tipo 2023**). |
| **Fuente principal** | Pronóstico horario Open-Meteo (o caché offline) + OpenStreetMap + antecedentes documentados. | Autómata celular exploratorio (`hydro.py`) con presets cerrados definidos en servidor. |
| **Identificador visual** | Sello verde **`Monitoreo · Pronóstico Open-Meteo (no medición en tiempo real)`**. | Sello ámbar persistente **`SIMULACIÓN EXPERIMENTAL · NO REPRESENTA LA SITUACIÓN ACTUAL`**. |
| **Contaminación cruzada** | Nunca muestra resultados de los escenarios 2017/2023 como si ocurrieran hoy. | Nunca confunde la hora simulada (`h+X`) con la hora actual de Lima. |

---

## 3. Permisos por rol y transparencia de seguridad

- **Estudiante / Visitante (por defecto, público):**
  - **Ve:** Inicio, Mapa de monitoreo UNT, Simulación sencilla (solo `evento_2017_03` y `evento_2023_03_10`), Prevención, Continuidad académica y Asistente YAKU público.
  - **NO ve:** Sensores físicos/virtuales (`S01`–`S06`), gateways, conectividad MQTT, parámetros de drenaje/OS.060/infiltración/Puerta 4, condiciones externas editables ni diagnósticos técnicos.
  - **Restricción en backend:** `GET /api/public/simulation/{preset_id}` solo admite `evento_2017_03` y `evento_2023_03_10`, usa parámetros fijos del servidor, cachea resultados y omite `virtual_sensors` (`null`).
- **Administrador (vista técnica):**
  - Conserva todas las vistas y herramientas técnicas: `Monitoreo`, `Mapa UNT + IoT` (`Sensores IoT [SIM]`), `Simulación dinámica [EXP]` con controles completos, `Simulaciones [SIM]` (A/B/C/D), edición manual de condiciones externas en `Prevención` y consultas de sensores en `Asistente YAKU`.
- **Nota honesta de seguridad:** Actualmente el proyecto **no cuenta con autenticación real ni RBAC en backend** ni con broker MQTT conectado. El selector *«Acceso Administrador»* en la barra lateral implementa la **separación visual y funcional para demostración**; antes de un despliegue institucional en producción, las rutas administrativas (`/api/hydro/run`, `/api/sensors/virtual`, declaración de condiciones y futuro MQTT) deberán protegerse con autenticación real (JWT/OAuth2 + RBAC en FastAPI) y nunca exponer secretos en el navegador.

---

## 4. Criterios usados para «Zonas de atención» y limitaciones científicas

- **Fuentes reutilizadas (sin índices arbitrarios):**
  - Perímetro e instalaciones de **OpenStreetMap** (`campus_unt.geojson`).
  - Antecedentes locales documentados (`reported_zones` / 2017 y 2023).
  - Relieve relativo del **DEM Copernicus GLO-30** (resolución 30 m, error vertical `±4 m`).
  - Láminas modeladas del autómata celular exploratorio (`hydro.py`).
- **Limitaciones declaradas:**
  - Open-Meteo entrega pronósticos numéricos, no mediciones en tiempo real de estaciones en el campus.
  - No existen sensores físicos ni conectividad MQTT operativa instalada en la UNT.
  - Los escenarios «tipo 2017» y «tipo 2023» usan acumulados diarios de referencia con hietograma horario supuesto; no son reconstrucciones exactas ni modelos hidrodinámicos validados.
  - Ninguna vista declara instalaciones como «seguras» o «peligrosas» ni sustituye alertas oficiales de **SENAMHI, INDECI, COEN o Defensa Civil UNT** (Ley N.° 29664).

---

## 5. Instrucciones para probar ambos escenarios y guion de demo (1 minuto)

1. Abrir `http://localhost:8080` (inicia directamente en **Estudiante / Visitante**, sin login).
2. **Parte 1 — Mapa de monitoreo (20 s):** Ir a **Mapa UNT**, mostrar pronóstico Open-Meteo (24 h / 48 h y hora Lima), buscar `Comedor Universitario` y señalar las *Zonas de atención*. Confirmar que no aparecen sensores `S01–S06`.
3. **Parte 2 — Simulación sencilla (25 s):** Ir a **Simulación sencilla**, elegir **Escenario tipo 2017**, pulsar **Ver simulación**, mostrar la evolución horaria y hacer clic sobre un pabellón para ver su ficha exploratoria. Luego cambiar a **Escenario tipo 2023**, pulsar **Ver simulación** y comparar la diferencia.
4. **Parte 3 — Separación por roles (15 s):** Pulsar **Acceso Administrador** en la barra lateral y mostrar que solo el rol administrador accede a **Simulación dinámica `[EXP]`** (drenaje, Puerta 4), **Mapa UNT + IoT** (`S01`–`S06`) y herramientas técnicas.
