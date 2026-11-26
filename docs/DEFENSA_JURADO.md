# GUION DE PITCH, DEMO EN VIVO Y DEFENSA ANTE EL JURADO
**Hackathon Innova Norte 3G 2026 — Desafío 3: Fenómeno El Niño (Final presencial: 27-nov-2026)**  
**Formato:** 5 min de pitch (guion calibrado a **4 min 30 s**, dejando 30 s de margen) + 5 min de preguntas · **7 diapositivas** (`pitch/YAKU_ALERT_UNT_PITCH.pptx`).

---

## 1. Guion Cronometrado del Pitch (4 min 30 s)

| Tiempo | Diapositiva / Vista | Mensaje clave |
|---|---|---|
| **0:00 – 0:40** | **Slide 1** (Portada + Problema UNT) | En marzo de 2017 y marzo de 2023 la Ciudad Universitaria UNT sufrió ingreso de agua por Puerta 4 y anegamientos en zonas bajas (Comedor, Puerta 3, estacionamientos). Estudiantes, docentes y administrativos reciben pronósticos dispersos sin microescala de campus ni guía clara de continuidad. |
| **0:40 – 1:15** | **Slide 2** (Propuesta 2 roles + Motor Explicable) | Creamos **YAKU ALERT — UNT** con 2 roles: **Estudiante** (orientación en <10 s con puntos seguros, rutas referenciales y simulación en 1 clic) y **Gestión UNT** (autómata celular 10 m, reglas transparentes `R-MET`/`R-HID`, red conceptual `YAKU SENSE` y generador de avisos por perfil). |
| **1:15 – 2:45** | **DEMO EN VIVO (90 s exactos)** *(Slide 3 de respaldo)* | Recorrido continuo en vivo (ver detalle exacto en la Sección 2; sirve también para grabar el video de respaldo). |
| **2:45 – 3:15** | **Slide 4** (Validación y Pivote UX) | Al probar la versión inicial detectamos sobrecarga técnica para estudiantes; pivotamos ocultando sensores y controles hidrológicos en vista pública (`virtual_sensors: null`). Hoy contamos con **70/70 pruebas `pytest`** aprobadas y el protocolo de campo T1–T5 listo, sin inventar encuestas previas. |
| **3:15 – 3:45** | **Slide 5** (YAKU SENSE + Incentivo S/ 1,500) | `YAKU SENSE` (`S01`–`S06`, LoRaWAN AU915 + MQTT) se declara explícitamente `PROPUESTA_FUTURA_NO_OPERATIVA`. Destinaremos el incentivo de **S/ 1,500** al levantamiento en campo de las **canaletas nuevas de la UNT** y el piloto con Defensa Civil / Servicios Generales UNT para escalar a TRL 5–6. |
| **3:45 – 4:10** | **Slide 6** (Ética, Seguridad y Marco Normativo) | Cumplimiento estricto **TRL 3–4**: Ley N.° 29664 (SINAGERD), D.S. N.° 048-2011-PCM, D.S. N.° 115-2022-PCM (**PLANAGERD 2022–2030**) y **Ley N.° 29733** (cero PII, cero GPS). Sin conexión a sistemas productivos; nunca reemplaza alertas oficiales de SENAMHI/COEN. |
| **4:10 – 4:30** | **Slide 7** (Cierre e Impacto UNT) | Software libre (costo licencia S/ 0), 100 % offline y demostrable hoy. Invitamos a DITT, UNT y RUI a articular el piloto institucional y proyectar la solución a La Libertad. *(30 s de colchón de seguridad).* |

---

## 2. Guion Exacto de Demo en Vivo — 90 Segundos (y Video de Respaldo)

1. **[0:00 – 0:15] Inicio 75/25 (`DashboardView`):**
   - Mostrar el gráfico protagonista de próximas 24 h (75 %) y los 4 indicadores compactos (25 %).
   - Escribir `"Comedor"` en *Explora tu campus* y activar brevemente **Modo offline** en la cabecera para mostrar que el respaldo local (`OFFLINE_FALLBACK`) responde al instante.
2. **[0:15 – 0:30] Mapa Estudiante (`StudentMonitoringMap`):**
   - Mostrar el mapa en modo **Solo vectorial (sin internet)** activado automáticamente al estar offline.
   - Señalar las zonas de atención y los **5 puntos seguros verdes y 5 rutas referenciales** de evacuación con su nota ética TRL 3–4.
3. **[0:30 – 0:50] Simulación 1 clic 2023 (`StudentSimpleSimulation`):**
   - Clic en **Simulación de lluvias** → seleccionar **Escenario tipo 2023** → pulsar **Ver simulación**.
   - Avanzar la barra horaria para mostrar el desplazamiento del agua y cómo se **resalta automáticamente la ruta alternativa** al detectarse acumulación en accesos críticos (`P4` / `P3`), sin sensores ni ruido técnico.
4. **[0:50 – 1:15] Switch a Gestión / Administrador (`DynamicSimulationView` + `PreventionView`):**
   - Cambiar el selector de rol a **Administrador / Gestión**.
   - Mostrar 5 s la **Simulación dinámica** (malla 10 m + nodos `YAKU SENSE` rotulados `PROPUESTA_FUTURA_NO_OPERATIVA`).
   - Entrar a **Prevención** → en el generador de avisos, elegir perfil **Personal administrativo** y canal **WhatsApp / Telegram** → pulsar **Copiar aviso** (confirmación *"Copiado"*) y señalar la etiqueta *"Simulación de difusión (TRL 3–4)"*.
5. **[1:15 – 1:30] Continuidad académica y administrativa (`ContinuityView`):**
   - Abrir **Continuidad** y mostrar las tarjetas **Antes / Durante / Después** diferenciando **Actividades académicas** (aula virtual, reprogramación sin penalización) y **Actividades administrativas** (Mesa de Partes virtual UNT, trabajo remoto en planta baja, resguardo de expedientes y equipos).

---

## 3. Respuestas Breves (≤ 30 s) a las 5 Preguntas Críticas del Jurado

### (a) ¿Qué relación tiene con SENAMHI / COEN y con estudios hidráulicos formales?
> *«No competimos ni reemplazamos a SENAMHI, COEN, INDECI ni estudios de CENEPRED. YAKU ALERT (TRL 3–4) actúa como capa traductora a microescala universitaria bajo la Ley N.° 29664, D.S. N.° 048-2011-PCM y PLANAGERD 2022–2030: convierte el pronóstico abierto en orientaciones preventivas explicables y pautas de continuidad académica y administrativa, remitiendo siempre a los canales oficiales para decisiones operativas.»* (~22 s)

### (b) ¿Modelaron las canaletas nuevas de la Ciudad Universitaria UNT?
> *«No las hemos inventado porque no contamos todavía con su inventario geométrico ni hidráulico oficial, y en nuestra interfaz lo declaramos explícitamente como limitación. Justamente, el levantamiento en campo de las canaletas nuevas y microdrenajes junto con Defensa Civil y Servicios Generales UNT es el primer hito de nuestro plan de validación y el destino principal del incentivo de S/ 1,500.»* (~21 s)

### (c) ¿Por qué `YAKU SENSE` es virtual y determinista?
> *«Por integridad técnica: no tenemos hardware instalado hoy en el campus ni en las quebradas, y por eso `YAKU SENSE` (`S01`–`S06`, arquitectura LoRaWAN AU915 + MQTT) está rotulado en UI y API como `PROPUESTA_FUTURA_NO_OPERATIVA` y oculto para estudiantes. Al acoplarlo de forma determinista a la malla de 10 m demostramos cómo se integraría telemetría real en TRL 5–6 sin engañar al usuario ni introducir datos aleatorios.»* (~24 s)

### (d) ¿Qué pasa si durante una lluvia extrema se corta internet o la energía eléctrica?
> *«El sistema está blindado 100 % offline: ante corte de red, el backend usa caché meteorológica local (`OFFLINE_FALLBACK`) y todos los mapas cambian automáticamente al modo **Solo vectorial (sin internet)** con los GeoJSON locales. Además, en Prevención se puede descargar o imprimir el boletín preventivo y copiar avisos locales; ante corte eléctrico en campus, los boletines impresos y la app desplegada en un equipo con batería o servidor UPS institucional siguen operando sin nube.»* (~26 s)

### (e) ¿Cómo garantizan la privacidad bajo la Ley N.° 29733?
> *«Por diseño (*Privacy by Design*): el prototipo no tiene registro de cuentas, no solicita DNI, correo ni teléfono, no usa cookies de rastreo ni pide geolocalización GPS del celular del estudiante, y no se conecta a ningún sistema productivo de la UNT. Cumplimos al 100 % la Ley N.° 29733 sin almacenar ningún dato personal.»* (~18 s)

---

## 4. Trazabilidad Técnica y Preguntas Complementarias

- **Escenarios heredados (Shapely A/B/C/D):**
  - **A (relieve):** percentil 15 de Copernicus GLO-30 (~30 m, ±4 m vertical). Tendencia experimental, no ruta de agua.
  - **B (reporte):** zonas ancladas a OSM por testimonio/prensa; franjas viales recortadas a buffer de 40 m del perímetro.
  - **C (combinado):** DEM p30 + zonas reportadas. **D:** condiciones externas declaradas manualmente (sí/no).
  - **Influencia SINTÉTICA:** azimut de descenso DEM (~203°), alcances ilustrativos de 40 m (B) / 80 m (C) y buffer 15 m. La lluvia no altera estas geometrías heredadas; alimenta las reglas preventivas y el autómata celular de 10 m.
- **Autómata celular de 10 m (`hydro.py`):** 8 vecinos sobre superficie *priority flood*, con conservación de masa verificada por pruebas automatizadas (`test_hydro.py`).
- **Puntos seguros y rutas referenciales (`evacuation_reference.geojson`):** 5 puntos en cota alta (25,6–27,8 m s.n.m.) y 5 rutas validadas dentro del polígono UNT (`test_evacuation.py`), marcados con `reference_only: true`.
- **Verificación automatizada real:** **70 pruebas `pytest` aprobadas** (`test_api.py`, `test_conditions.py`, `test_evacuation.py`, `test_hydro.py`, `test_public_student.py`, `test_virtual_sensors.py`) + compilación limpia `vite build`.
- **¿Por qué no Machine Learning?** No existen series históricas etiquetadas de anegamiento interno en la UNT; un motor explicable (`R-MET`/`R-HID`) evita sobreajuste y garantiza trazabilidad total ante autoridades.
- **¿Cómo escalar fuera de la UNT?** Reemplazando los GeoJSON del campus por capas de distritos vulnerables de Trujillo (El Porvenir, Alto Trujillo, Víctor Larco), preservando el motor explicable y el modo offline.
