# REDISEÑO UX/UI INTEGRAL — EXPERIENCIA ESTUDIANTE / VISITANTE (YAKU ALERT — UNT)

> **Rama:** `alexis-100`  
> **Principio rector:** **MENOS TEXTO + MENOS BOTONES + MENOS DECISIONES + MAYOR CLARIDAD**  
> **Recorrido objetivo:** **CONSULTAR → UBICARSE → EXPLORAR → COMPRENDER → ACTUAR**

---

## 1. Objetivos del rediseño

1. Reducir al mínimo la carga cognitiva para cualquier estudiante, docente, trabajador o visitante de la Ciudad Universitaria UNT sin conocimientos de programación, GIS, hidrología o sensores IoT.
2. Permitir que el propósito de cada pantalla y su acción principal se reconozcan de inmediato.
3. Corregir inconsistencias científicas, visuales y de etiquetado detectadas en la interfaz previa sin eliminar capacidades técnicas del rol Administrador (`Gestión UNT`).

---

## 2. Problemas UX y de rigor detectados en la auditoría

| # | Hallazgo detectado | Causa / Problema UX | Solución implementada |
|---|---|---|---|
| **1** | **Logotipo roto en barra lateral y modal** | `frontend/Dockerfile` no copiaba la carpeta `public/` (`public/assets/yaku-alert-icon.png` y `nexorisk-icon.png`). | Añadido `COPY public ./public` en `frontend/Dockerfile` + fallback SVG automático (`onError`) en `BrandLogo.jsx`. |
| **2** | **Etiqueta «En vivo» en cabecera** | Llamar «En vivo» a un pronóstico horario de Open-Meteo induce a creer que proviene de estaciones o sensores en tiempo real. | Reemplazado por **«Pronóstico actualizado»** (con hora de Lima), **«Dato en caché»** (offline) y **«Simulación experimental»**. |
| **3** | **Confusión entre probabilidad (100 %) e intensidad (0.1 mm/h)** | Un estudiante podía interpretar `100 %` como lluvia torrencial o inundación inminente aunque el acumulado fuera `0.2 mm`. | Añadida explicación directa en `Inicio`: *«Una probabilidad alta indica posibilidad de que caiga al menos llovizna (≥0.1 mm), pero la cantidad prevista es de 0.2 mm en 24 h (intensidad máx. 0.1 mm/h)»*. |
| **4** | **Expresiones «zonas seguras», «evacúa por ruta segura» y «puerta libre»** | Ningún modelo exploratorio ni ausencia de reportes certifica que una ruta o puerta sea físicamente segura. | Renombrado en toda la experiencia pública a **«Puntos de encuentro y rutas referenciales»**; las puertas P1–P4 muestran **«Sin información actualizada»** (aclarando que la ausencia de reportes no confirma verificación en campo), **«Reporte pendiente de verificar»**, **«Estado verificado (con reporte)»** o **«Condición referencial»**. |
| **5** | **Afirmaciones de «Calibración histórica» y «resolución 10 m»** | Remuestrear un DEM de ~30 m a celdas de 10 m no añade nueva resolución topográfica observada, y los presets 2017/2023 son referencias documentadas con hietograma supuesto. | Corregido en `DataSourcesPanel.jsx` y `/api/sources/status` (`backend/app/main.py`), y trasladado en `Inicio` al acordeón secundario **«Cómo funciona YAKU ALERT»**. |
| **6** | **Cabecera sobrecargada (11 controles simultáneos)** | Mezclaba acceso administrativo (`Gestión UNT`) con perfiles públicos (`Estudiante`, `Docente`, `Administrativo`). | Cabecera limpia con título, estado informativo, fuente/hora, selector compacto **«Perfil: Estudiante / Docente / Administrativo»** (que solo adapta recomendaciones sin dar privilegios admin) y acceso a `Gestión UNT` separado en el pie del menú lateral. |
| **7** | **Inicio demasiado largo y con CTAs repetidos** | Tenía botones duplicados, tira de 3 pasos redundante y 5 tarjetas técnicas de fuentes dominando la vista. | Reestructurado en **Sección A** (`¿Cómo está el pronóstico en la UNT?`), **Sección B** (3 acciones únicas: *1. Buscar mi facultad*, *2. Simular lluvias*, *3. ¿Qué hago si llueve fuerte?*) y **Sección C** (gráfico 75 % / indicadores 25 %, puertas referenciales y acordeón secundario *«Cómo funciona YAKU ALERT»*). |
| **8** | **Mapa UNT con demasiados botones flotantes y 5 KPIs arriba** | El estudiante veía 5 tarjetas y 7 botones antes de buscar su facultad. | Principio **Primero buscar, después explorar**: buscador protagonista **«¿Qué lugar de la UNT buscas?»**, franja meteorológica de 1 línea y controles de visualización agrupados en un solo menú **«Capas y mapa base»**. |
| **9** | **Prevención empezaba por bloques técnicos (QUÉ/DÓNDE/CUÁNDO)** | El estudiante tenía que leer 4 bloques de diagnóstico antes de ver qué hacer. | Jerarquía invertida en vista Estudiante: **1) «¿Qué puedo hacer ahora?»** (máx. 3 acciones claras), **2) «¿Por qué aparece esta recomendación?»**, **3) «Ver detalles, ficha completa (5 ejes) y fuentes»** desplegable + descarga de boletín. |
| **10** | **Continuidad mostraba 3 columnas × 2 ámbitos a la vez** | Pantalla extensa que mezclaba tareas administrativas con académicas. | Selector compacto de **una sola fase a la vez (`Antes | Durante | Después`)**, filtrado automáticamente según el perfil público activo (`Estudiante`, `Docente` o `Personal administrativo`), mostrando 3 recomendaciones principales y botón *«Ver todas las recomendaciones»*. |

---

## 3. Criterios de accesibilidad (WCAG 2.2 AA) y diseño responsive

- **Navegación por teclado y lectores de pantalla:** Roles ARIA (`tablist`, `tab`, `listbox`, `option`, `aria-expanded`, `aria-pressed`), etiquetas asociadas (`htmlFor` / `aria-label`) y texto `sr-only` en el gráfico horario de 24 h.
- **No dependencia exclusiva del color:** Cada estado preventivo o referencial combina color + etiqueta textual explícita (`Informativo`, `Sin información actualizada`, `Simulación experimental`).
- **Responsive verificado:** Sin desbordamiento horizontal (`scrollWidth <= innerWidth`) en móvil (`390 × 844`), tablet (`768 × 1024`) y escritorio (`1440 × 900` / `1920 × 1080`), en modo claro y oscuro.

---

## 4. Preservación de capacidades del rol Administrador (`Gestión UNT`)

El rol **Gestión UNT** conserva intactas todas sus herramientas:
- `ExecutiveDecisionCard`, bandeja de reportes comunitarios, validación y emisión de avisos CAP 1.2, y decisiones de continuidad en SQLite.
- `Monitoreo sinóptico`, `Mapa UNT + IoT` (red virtual **YAKU SENSE** `S01–S06` con simulación de desconexión y arquitectura LoRaWAN), `Simulación dinámica [10m]` (drenaje, Puerta 4, reglas `R-HID`) y `Escenarios A/B/C/D`.

---

## 5. Protocolo de prueba de usabilidad con estudiantes (regla de 5 segundos)

> **Nota de integridad:** Este protocolo está preparado para ejecutarse con estudiantes reales de la UNT. **No se declaran resultados de participantes inventados.**

- **Tarea A:** Consultar el pronóstico de lluvia en `Inicio` y explicar si lloverá fuerte o solo hay probabilidad de llovizna.
- **Tarea B:** Usar *«1. Buscar mi facultad»* o **Mapa UNT** (`¿Qué lugar de la UNT buscas?`) para ubicar el `Comedor Universitario`.
- **Tarea C:** Entrar a **Simular lluvias** y ejecutar el **Escenario tipo 2017**.
- **Tarea D:** Confirmar en pantalla que la simulación es experimental y no una alerta actual.
- **Tarea E:** Abrir **Prevención** (`¿Qué puedo hacer ahora?`) y **Continuidad académica** (`Antes | Durante | Después`).
