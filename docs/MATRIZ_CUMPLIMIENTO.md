# MATRIZ DE CUMPLIMIENTO DE BASES OFICIALES
**Documento fuente:** `BASES HACKATHON 2026- VF (1).pdf` — Hackathon Innova Norte 3G 2026 (UNT / VIN / DITT / RUI Nodo Norte).

---

## 1. Requisitos Generales y Elegibilidad

| Requisito de las Bases | Detalle Oficial | Estado Actual | Evidencia / Acción |
|---|---|---|---|
| Desafío elegido | Desafío 3: Gestión de riesgos y desastres ante el Fenómeno El Niño | Completo | Proyecto enfocado 100% en lluvias intensas, inundaciones y contexto de quebradas en UNT/Trujillo |
| Conformación de equipo | 2 a 4 estudiantes de pregrado (máx. 1 de IES), 1 líder, 1 asesor (no jurado/mentor) | Pendiente (gestión humana) | Registrar en formulario oficial antes del cierre (13 nov 2026) |
| Enfoque metodológico | Design Thinking, Lean Startup, desarrollo ágil; TRL 3–4 (prototipo evaluado en entorno simulado) | Completo | Implementado en flujo problema → MVP → simulación → plan de validación |
| Conexión a sistemas reales | No se exige conexión a sistemas institucionales reales ni datos reales internos | Completo | Se usa Open-Meteo real + datos geográficos referenciales y escenarios sintéticos etiquetados |

---

## 2. Cronograma Oficial (2026)

| Etapa / Actividad | Fecha y Hora | Lugar / Modalidad | Estado |
|---|---|---|---|
| Cierre de inscripciones | 13 de noviembre de 2026 | Formulario virtual | En fecha límite hoy |
| Validación de requisitos y subsanación | 14 al 17 de noviembre de 2026 | Proceso interno / correo | Pendiente |
| Publicación de equipos admitidos | 18 al 20 de noviembre de 2026 | Canales oficiales UNT/DITT | Pendiente |
| Capacitaciones virtuales (Talleres generales) | 23, 24 y 25 nov 2026, 7:00 p. m. | Virtual | Pendiente asistencia |
| Taller técnico Desafío 3 | 24 nov 2026, 8:00 p. m. | Virtual | Pendiente asistencia |
| **Cierre entregables Stage-Gate 1** | **25 nov 2026, 11:59 p. m.** | Virtual | **Meta prioritaria** |
| Inauguración local DITT y mentorías | 26 nov 2026, 12:00 m – 6:00 p. m. | DITT, Independencia N.° 186, Trujillo | Pendiente |
| Jornada Final, Pitch y Premiación | 27 nov 2026, 8:00 a. m. – 8:00 p. m. | DITT (mañana) / Cámara Gesell Fac. Derecho UNT (tarde) | Pendiente |

---

## 3. Entregables Obligatorios

| Fase | Entregable | Contenido Mínimo Exigido | Archivo en Repositorio |
|---|---|---|---|
| Stage-Gate 1 (Virtual) | 1. Ficha del problema | A quién afecta, qué sucede, por qué ocurre y solución propuesta | `docs/ENTREGABLE_1_FICHA_PROBLEMA.md` |
| Stage-Gate 1 (Virtual) | 2. Prototipo o MVP | Aplicación/simulación demostrable con funcionalidades principales | `backend/` + `frontend/` |
| Stage-Gate 1 (Virtual) | 3. Ficha técnica | Nombre, cómo se utiliza, herramientas empleadas, enlace/archivo | `docs/ENTREGABLE_3_FICHA_TECNICA.md` |
| Stage-Gate 1 (Virtual) | 4. Plan de validación | Cómo se probó/probará, opiniones recibidas, mejoras y faltantes | `docs/ENTREGABLE_4_PLAN_VALIDACION.md` |
| Stage-Gate 2 (Final) | 5. Pitch deck + Demo + Contingencia | Máx. 7 diapositivas en PowerPoint, 5 min exposición + 5 min preguntas + video de respaldo | `pitch/YAKU_ALERT_UNT_PITCH.pptx` + `docs/DEFENSA_JURADO.md` |

---

## 4. Rúbrica Oficial de Evaluación (Anexo 1)

| N.° | Criterio | Puntaje Máximo | Aplica en Virtual | Aplica en Final |
|---|---|---:|:---:|:---:|
| 1 | Comprensión del usuario y definición del problema | 15 | Sí | Sí |
| 2 | Propuesta de valor e innovación | 15 | Sí | Sí |
| 3 | Funcionalidad y demostración del MVP/prototipo | 25 | Sí | Sí |
| 4 | Validación y aprendizaje | 15 | No | Sí |
| 5 | Viabilidad, impacto y sostenibilidad | 15 | No | Sí |
| 6 | Seguridad, ética y cumplimiento de límites | 10 | No | Sí |
| 7 | Pitch y comunicación | 5 | No | Sí |
| **TOTAL** | | **100** | **55** | **100** |

*Nota de bases:* Mínimo **60/100** puntos en la final para optar por el primer puesto. Desempate: (1) Viabilidad y funcionamiento del prototipo, (2) Innovación, (3) Importancia y claridad del problema.

---

## 5. Cumplimiento Normativo y Ético

| Norma | Aplicación en YAKU ALERT — UNT |
|---|---|
| **Ley N.° 29664 (SINAGERD)** y **D.S. N.° 048-2011-PCM** | El prototipo es una herramienta de apoyo informativo y preparación preventiva; **no reemplaza** las alertas oficiales de SENAMHI, COEN, INDECI ni autoridades de la UNT. |
| **D.S. N.° 115-2022-PCM (PLANAGERD 2022-2030)** | Alineado con los procesos de estimación, prevención, preparación y continuidad operativa ante emergencias. |
| **Ley N.° 29733 (Protección de Datos Personales)** | Cero recopilación de datos personales sensibles, cero geolocalización GPS invasiva sin consentimiento, cero almacenamiento de identidad de usuarios en el MVP. |
| **Transparencia y Límites Científicos** | Distinción explícita y permanente entre **datos reales** (Open-Meteo) y **escenarios simulados/sintéticos**. Sin falsas alertas reales ni conversión automática de probabilidad de lluvia en probabilidad de huaico. |
