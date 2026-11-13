# ENTREGABLE 1 — FICHA DEL PROBLEMA
**Proyecto:** YAKU ALERT — UNT  
**Competencia:** Hackathon Innova Norte 3G 2026 — Desafío 3: Gestión de riesgos y desastres ante el Fenómeno El Niño  
**Pregunta del desafío:** *¿Cómo podemos utilizar la tecnología para prevenir riesgos y mejorar la respuesta de la comunidad ante lluvias intensas e inundaciones?*

---

## 1. ¿Qué problema identificaron?
Las personas de la comunidad universitaria (estudiantes, docentes y personal administrativo de la UNT) tienen dificultades para **interpretar pronósticos meteorológicos numéricos** (mm/h, probabilidad porcentual, acumulados), **localizar qué zonas o accesos del campus podrían verse expuestos** ante lluvias intensas asociadas al Fenómeno El Niño (FEN), y **saber qué medidas preventivas y de continuidad académica adoptar** sin caer en desinformación ni falsas alarmas.

*Nota de rigor:* No se inventan antecedentes históricos de inundaciones internas no documentadas en la UNT; el problema se centra en la brecha de comprensión, preparación preventiva y continuidad operativa universitaria ante eventos extremos en Trujillo.

---

## 2. ¿A quién afecta?
- **Estudiantes de pregrado y posgrado** de la Ciudad Universitaria UNT (especialmente quienes se trasladan desde distritos periféricos o utilizan laboratorios y aulas en primer nivel).
- **Docentes y personal administrativo**, que requieren criterios claros para tomar decisiones de reprogramación o virtualización temporal.
- **Comunidades vulnerables de Trujillo** (en una fase de expansión futura), expuestas a lluvias intensas y al contexto de las quebradas San Ildefonso, San Carlos y El León.

---

## 3. ¿Qué sucede y por qué ocurre?
1. **Datos fragmentados y técnicos:** Plataformas nacionales valiosas como **SENAMHI (ISAAC, ARES)**, **MINAM (GEOQUEBRADAS)**, **CENEPRED (SIGRID)** e **IGP (CENDEHUA)** están diseñadas principalmente para escala nacional/distrital, cuencas específicas (p. ej. Rímac en Lima) o uso técnico GIS, no para microescala universitaria ni orientaciones académicas cotidianas.
2. **Brecha de interpretabilidad:** Un dato aislado como "70% de probabilidad de lluvia" no explica cuánta agua se acumulará, qué accesos podrían anegarse ni si una clase o práctica de laboratorio debe pasar a modalidad virtual.
3. **Ausencia de simuladores preventivos locales:** Sin herramientas de simulación offline, es difícil capacitar a la comunidad universitaria y probar escenarios de continuidad antes de que ocurra una emergencia.

---

## 4. Solución propuesta: YAKU ALERT — UNT
Una plataforma web (TRL 3–4) con un **Motor de Decisiones Preventivas Explicables** que integra:
`Pronóstico meteorológico real (Open-Meteo + respaldo offline)` → `Análisis espacial real del campus UNT (Shapely + GeoJSON)` → `Reglas preventivas transparentes` → `Ficha preventiva explicable + Simulador offline + Alternativas de continuidad académica`.

Cada resultado explica **qué datos lo sustentan, de dónde proceden, cuándo se actualizaron y qué incertidumbre presentan**, cumpliendo estrictamente con la **Ley N.° 29664 (SINAGERD)** y la **Ley N.° 29733 (Protección de Datos Personales)**.
