# GUION DE PITCH, DEMO EN VIVO Y DEFENSA ANTE EL JURADO
**Hackathon Innova Norte 3G 2026 — Desafío 3: Fenómeno El Niño (Final presencial: 27-nov-2026)**  
**Formato:** 5 min de pitch (guion calibrado a **4 min 30 s**, dejando 30 s de margen) + 5 min de preguntas · **7 diapositivas** (`pitch/YAKU_ALERT_UNT_PITCH.pptx`).

---

## 1. Guion Cronometrado del Pitch (4 min 30 s)

| Tiempo | Diapositiva / Vista | Mensaje clave |
|---|---|---|
| **0:00 – 0:40** | **Slide 1** (Portada + Problema UNT) | En marzo de 2017 y marzo de 2023 la Ciudad Universitaria UNT sufrió ingreso de agua por Puerta 4 y anegamientos en zonas bajas (Comedor, Puerta 3, estacionamientos). Estudiantes, docentes y directivos reciben pronósticos dispersos sin microescala de campus ni guía clara de continuidad. |
| **0:40 – 1:15** | **Slide 2** (Propuesta 2 roles + Motor Explicable) | Creamos **YAKU ALERT — UNT** con 2 roles: **Estudiante** (orientación en <10 s con puntos seguros, rutas referenciales y simulación histórica educativa) y **Gestión UNT** (**Semáforo Ejecutivo para Directivos**, autómata celular 10 m, variables sinópticas, red conceptual `YAKU SENSE`, 4 quebradas de Trujillo y generador de avisos por perfil). |
| **1:15 – 2:45** | **DEMO EN VIVO (90 s exactos)** *(Slide 3 de respaldo)* | Recorrido continuo en vivo (ver detalle exacto en la Sección 2; sirve también para grabar el video de respaldo). |
| **2:45 – 3:15** | **Slide 4** (Validación y Feedback Territorial) | Al probar e iterar con especialistas de gestión de riesgos de Trujillo, incorporamos los nombres completos de 38 pabellones que figuraban "sin nombre", probabilidad `%` y variables sinópticas anti-falsas alarmas, la Quebrada de Indoamérica y el módulo de brigadas comunitarias. Hoy contamos con **75/75 pruebas `pytest`** aprobadas. |
| **3:15 – 3:45** | **Slide 5** (Viabilidad, Escalamiento e Incentivo S/ 1,500) | La UNT es piloto validable en malla de 10 m con hoja de ruta de escalamiento a municipalidades distritales (despliegue preventivo de motobombas/brigadas en territorios vecinales) y app móvil con alertas push. `YAKU SENSE` (`S01`–`S06`) se rotula `PROPUESTA_FUTURA_NO_OPERATIVA` y el incentivo de **S/ 1,500** financiará el levantamiento en campo de las **canaletas nuevas UNT**. |
| **3:45 – 4:10** | **Slide 6** (Ética, Seguridad y Marco Normativo) | Cumplimiento estricto **TRL 3–4**: Ley N.° 29664 (SINAGERD), D.S. N.° 048-2011-PCM, D.S. N.° 115-2022-PCM (**PLANAGERD 2022–2030**) y **Ley N.° 29733** (cero PII, cero GPS, checklist local). Canales oficiales diferenciados (COER/COEN, SENAMHI, ENFEN, INDECI). |
| **4:10 – 4:30** | **Slide 7** (Cierre e Impacto UNT) | Software libre (costo licencia S/ 0), 100 % offline y demostrable hoy. Invitamos a DITT, UNT y RUI a articular el piloto institucional y proyectar la solución a La Libertad. *(30 s de colchón de seguridad).* |

---

## 2. Guion Exacto de Demo en Vivo — 90 Segundos (y Video de Respaldo)

1. **[0:00 – 0:15] Inicio 75/25 (`DashboardView`):**
   - Mostrar el gráfico protagonista de próximas 24 h (75 %) y los indicadores compactos con **Probabilidad máxima de lluvia (%)** e indicador de **Confianza del pronóstico** (*Pronóstico probabilístico 48 h — Open-Meteo*).
   - Escribir `"Comedor"` o `"Ingeniería"` en *Explora tu campus* (mostrando nombres completos y legibles) y pulsar **Modo offline** en la cabecera para evidenciar que el respaldo local (`OFFLINE_FALLBACK`) responde de inmediato.
2. **[0:15 – 0:35] Mapa Estudiante (`StudentMonitoringMap`):**
   - Mostrar la cabecera destacada **"Estado actual y pronóstico probabilístico (48 h)"** con su franja **"Qué hacer ahora"** (asistencia normal vs. precaución).
   - Mapa en modo **Solo vectorial (sin internet)** activado automáticamente al estar offline.
   - Señalar los **5 puntos seguros verdes, 5 rutas referenciales** y encender el toggle referencial **"Contexto Trujillo (Ruta del Agua y entorno)"** para mostrar el corredor de Av. Jesús de Nazareth y Urb. San Andrés.
3. **[0:35 – 0:50] Simulación histórica educativa (`StudentSimpleSimulation`):**
   - Clic en **Ver simulación educativa (2017 / 2023)**; destacar la insignia *"Simulación histórica educativa — No representa una alerta en curso"*.
   - Seleccionar **Escenario tipo 2023** → pulsar **Ver simulación**.
   - Avanzar la barra temporal para mostrar el desplazamiento del agua y cómo se **resalta automáticamente la ruta alternativa** al detectarse acumulación en accesos críticos (`P4` / `P3`).
4. **[0:50 – 1:15] Switch a Gestión / Administrador (`DashboardView`, `DynamicSimulationView`, `PreventionView`):**
   - Cambiar el selector de rol a **Administrador / Gestión**.
   - En el inicio de Gestión, mostrar el **Semáforo Ejecutivo para Directivos** (<5 segundos de lectura para un Rector o Decano: decisión sugerida en Verde/Ámbar/Rojo, resumen de riesgo con ventana horaria crítica y top 3 sectores/accesos prioritarios).
   - Mostrar 3 segundos la **Simulación dinámica** (malla 10 m + nodos `YAKU SENSE` rotulados `PROPUESTA_FUTURA_NO_OPERATIVA`).
   - Entrar a **Prevención** → en el generador de avisos institucional, elegir perfil **Personal administrativo** y canal **WhatsApp / Telegram** → pulsar **Copiar aviso** (confirmación *"Copiado"*).
5. **[1:15 – 1:30] Acción comunitaria y continuidad (`ContinuityView`):**
   - Abrir **Continuidad** y mostrar la nueva pestaña **"Acción comunitaria y mochila"**: las 4 brigadas universitarias articuladas a territorios vecinales y el checklist interactivo de Mochila de Emergencia (marcar 2 artículos, barra de progreso en tiempo real sin almacenar PII).
   - Mostrar la pestaña **"Canales oficiales"** diferenciando claramente las competencias de COER/COEN, SENAMHI, ENFEN e INDECI, junto al contexto de las 4 quebradas de Trujillo (incluyendo la Quebrada de Indoamérica en La Esperanza, sin obras de mitigación).

---

## 3. Respuestas Breves (≤ 30 s) a Preguntas Clave del Jurado

### (a) ¿Cómo evitan perder credibilidad por falsas alarmas?
> *«Abordamos las falsas alarmas con rigor probabilístico y de campo: nunca presentamos pronósticos como verdades absolutas ni convertimos probabilidad de lluvia en probabilidad de huaico. Mostramos la probabilidad horaria (%) de Open-Meteo, variables sinópticas complementarias (presión <1000 hPa y viento) que los especialistas locales usan para confirmar inestabilidad, distinguimos tajantemente el pronóstico vigente de las simulaciones históricas educativas, y contrastamos siempre con los avisos oficiales de SENAMHI, COER y ENFEN.»* (~25 s)

### (b) ¿Quién es el usuario decisor real de la plataforma?
> *«Diseñamos dos niveles de usuario diferenciados sin pantallas extra ni logins: para **Directivos y Autoridades UNT** (Rector, Vicerrectores, Decanos y Defensa Civil), el Semáforo Ejecutivo traduce reglas técnicas en decisiones inmediatas de continuidad, virtualidad y resguardo de laboratorios; para **Estudiantes, Docentes y Brigadistas**, el entorno ofrece orientación en menos de 10 segundos sobre accesos habilitados, rutas seguras y preparación de su mochila de emergencia.»* (~26 s)

### (c) ¿Cómo escala fuera de la UNT a nivel municipal o regional?
> *«Nuestra arquitectura está desacoplada sobre mallas GeoJSON y modelos de elevación digital. El piloto en la Ciudad Universitaria UNT valida el motor en celdas de 10 m; para escalar a municipalidades como Trujillo, El Porvenir, La Esperanza o Huanchaco y universidades de la RUI, solo se sustituyen las capas de infraestructura y relieve. Esto permite a gerencias municipales anticipar puntos críticos de aniego y posicionar motobombas y brigadas en territorios vecinales antes de que ocurra el desborde.»* (~27 s)

### (d) ¿Cuál es la diferencia de roles entre COER/COEN, SENAMHI, ENFEN e INDECI en su plataforma?
> *«Respetamos estrictamente las competencias del SINAGERD: **SENAMHI** aporta los avisos meteorológicos e hidrológicos oficiales; **ENFEN** emite los comunicados macroclimáticos del Fenómeno El Niño y temperatura del mar; el **COER La Libertad / COEN** monitorea en campo la activación de quebradas y operaciones de emergencia; e **INDECI** define el marco normativo y guías de preparación comunitaria. YAKU ALERT traduce esta información a microescala de campus sin suplantar a ninguna entidad.»* (~26 s)

### (e) ¿Modelaron las canaletas nuevas de la Ciudad Universitaria UNT?
> *«No las hemos inventado porque no contamos todavía con su inventario geométrico ni hidráulico oficial, y en nuestra interfaz lo declaramos explícitamente como limitación. Justamente, el levantamiento en campo de las canaletas nuevas y microdrenajes junto con Defensa Civil y Servicios Generales UNT es el primer hito de nuestro plan de validación y el destino principal del incentivo de S/ 1,500.»* (~21 s)

### (f) ¿Por qué `YAKU SENSE` es virtual y determinista?
> *«Por integridad técnica: no tenemos hardware instalado hoy en el campus ni en las quebradas, y por eso `YAKU SENSE` (`S01`–`S06`, arquitectura LoRaWAN AU915 + MQTT) está rotulado en UI y API como `PROPUESTA_FUTURA_NO_OPERATIVA` y oculto para estudiantes. Al acoplarlo de forma determinista a la malla de 10 m demostramos cómo se integraría telemetría real en TRL 5–6 sin engañar al usuario ni introducir datos aleatorios.»* (~24 s)

### (g) ¿Qué pasa si durante una lluvia extrema se corta internet o la energía eléctrica?
> *«El sistema está blindado 100 % offline: ante corte de red, el backend usa caché meteorológica local (`OFFLINE_FALLBACK`) con variables sinópticas y todos los mapas cambian automáticamente al modo **Solo vectorial (sin internet)** con los GeoJSON locales. Además, en Prevención se puede descargar o imprimir el boletín preventivo y copiar avisos locales; ante corte eléctrico en campus, los boletines impresos y la app desplegada en un equipo con batería o servidor UPS institucional siguen operando sin nube.»* (~26 s)

### (h) ¿Cómo garantizan la privacidad bajo la Ley N.° 29733?
> *«Por diseño (*Privacy by Design*): el prototipo no tiene registro de cuentas, no solicita DNI, correo ni teléfono, no usa cookies de rastreo ni pide geolocalización GPS del celular del estudiante, el checklist de mochila corre 100 % en memoria local del navegador sin persistir PII, y no se conecta a ningún sistema productivo de la UNT. Cumplimos al 100 % la Ley N.° 29733 sin almacenar ningún dato personal.»* (~20 s)

---

## 4. Trazabilidad Técnica y Datos de Respaldo

- **Malla hidrodinámica 10 m (`hydro.py`):** Autómata celular determinista de 8 vecinos sobre superficie *priority flood* derivada de Copernicus GLO-30, con conservación estricta de balance de masa verificada por tests.
- **Contexto de 4 Quebradas de Trujillo:**
  1. *San Ildefonso:* 35 diques culminados y derivación (ventana referencial de respuesta ~45 min).
  2. *San Carlos:* sector Laredo (conducción hacia río Moche).
  3. *León Dormido:* El Milagro / Huanchaco (riesgo residual por residuos/obstrucciones en cauce).
  4. *Indoamérica:* La Esperanza (identificada, **sin obras de mitigación ejecutadas**).
- **Capa territorial referencial (`trujillo_context_reference.geojson`):** Corredor Av. Jesús de Nazareth (aniegos Puerta 4), sector Urb. San Andrés y trazo referencial de la Ruta del Agua (NE → SO).
- **Puntos seguros y rutas referenciales (`evacuation_reference.geojson`):** 5 puntos en cota alta (25,6–27,8 m s.n.m.) y 5 rutas validadas dentro del polígono UNT, marcados con `reference_only: true`.
- **Verificación automatizada real:** **75 pruebas `pytest` aprobadas** (`test_api.py`, `test_conditions.py`, `test_evacuation.py`, `test_hydro.py`, `test_public_student.py`, `test_virtual_sensors.py`) + compilación limpia `vite build` en ~2 s.
- **¿Por qué no Machine Learning?** No existen series históricas etiquetadas de anegamiento interno en la UNT; un motor explicable (`R-MET`/`R-HID`/`R-EXT`) evita sobreajuste y garantiza trazabilidad total ante autoridades.
