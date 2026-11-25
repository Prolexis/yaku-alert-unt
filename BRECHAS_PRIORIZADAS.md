# ANÁLISIS DE BRECHAS PRIORIZADAS — YAKU ALERT UNT

> Clasificación objetiva basada en la auditoría real del código fuente y en el impacto directo sobre la rúbrica de Innova Norte 3G 2026, priorizando **alto impacto con bajo riesgo de regresión**.

---

## 1. Comparación contra funcionalidades candidatas

| Funcionalidad candidata | Estado antes de la auditoría | Brecha real detectada | Prioridad | Decisión adoptada |
|---|---|---|---|---|
| **1. Condiciones externas declarables en UI (`/api/conditions`)** | Solo en backend (17 tests en `test_conditions.py`), sin interfaz en frontend. | Funcionalidad valiosa ya probada en backend que el usuario/jurado no podía ver ni usar. | **P0** | **IMPLEMENTADA** en `PreventionView.jsx`, `App.jsx` y `api.js`. |
| **2. Búsqueda universal de instalaciones UNT («Explora tu campus»)** | Ya implementada (`campusCatalog.js`, `FacultyLookupCard.jsx`, `CampusMapView.jsx`). | Cobertura completa de 11 categorías OSM + nombres oficiales UNT; solo faltaba auditarla y verificarla en build/Docker. | **P0** | **VERIFICADA** (sin reconstruir). |
| **3. Consulta personalizada por edificio, facultad, comedor o auditorio** | Ya implementada dentro de «Explora tu campus» (Dashboard y Mapa UNT). | Ficha con ubicación, fuente geográfica y exposición en el último escenario simulado. | **P0** | **VERIFICADA**. |
| **4. Asistente conversacional orientado a prevención (offline)** | No existía en el sistema. | Estudiantes o visitantes nuevos necesitaban un punto de entrada conversacional rápido sin riesgo de alucinaciones ni dependencia de internet. | **P1** | **IMPLEMENTADA** (`YakuAssistantDrawer.jsx` 100% determinístico y offline). |
| **5. Documentación auditable + guion de demo + protocolo de validación** | Dispersa en `README.md` y `docs/`. | Faltaba consolidar inventario técnico, matriz de rúbrica, resultados de pruebas reales y guion de 90 s para jurado. | **P0** | **IMPLEMENTADA** (6 documentos entregables). |
| **6. Boletín preventivo descargable offline** | Ya implementado (`utils/bulletin.js`, HTML autocontenido imprimible a PDF). | Suficiente y libre de dependencias; convertir a PDF binario en servidor añadiría peso y riesgo innecesario. | **P2** | **MANTENER** solución HTML imprimible offline. |
| **7. Integración con sensores físicos / API oficial SENAMHI en vivo** | No disponible (Open-Meteo es la fuente abierta activa). | No existe API pública oficial de SENAMHI con SLA ni sensores físicos instalados en la UNT. | **P2** | **DIFERIDA** a hoja de ruta institucional post-hackathon. |
| **8. Interacción por voz (Web Speech API)** | No implementada. | Soporte inconsistente entre navegadores y entornos sin internet (muchos navegadores envían el audio a la nube, rompiendo el modo offline). | **P2** | **DESCARTADA** para esta entrega para preservar estabilidad y funcionamiento offline. |
| **9. Validación de campo con estudiantes UNT** | Pendiente (no se inventan encuestas). | Requiere interacción humana real fuera del código. | **P0 (equipo)** | **DOCUMENTADO** protocolo listo para ejecutar en `DEMO_JURADO.md`. |

---

## 2. Justificación de las 3 mejoras seleccionadas

1. **Conectar `/api/conditions` al frontend (P0):** Aprovecha 100% código backend ya validado por 17 pruebas automatizadas, cerrando una desconexión crítica entre backend y frontend con riesgo técnico mínimo y alto valor demostrativo en el motor preventivo explicable.
2. **Asistente YAKU determinístico y offline (P1):** Eleva la accesibilidad y experiencia de usuario (UX) permitiendo consultas directas sobre clima, facultades/edificios, simulaciones y protocolos con enlaces directos a Leaflet, sin depender de LLMs externos ni comprometer la ética/rigor científico.
3. **Paquete de auditoría, pruebas verificables y guion de jurado (P0):** Asegura trazabilidad completa ante el jurado técnico y entrega un protocolo honesto para la validación real con estudiantes antes de la final.
