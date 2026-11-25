# GUION DE DEMOSTRACIÓN Y DEFENSA ANTE EL JURADO

## 1. Recorrido de Demostración (90 a 120 segundos dentro del Pitch de 5 min)

- **[0:00 – 0:20] Vista 1 (Monitoreo Real):** Mostrar el banner superior verde (*DATOS REALES DE PRONÓSTICO — Open-Meteo API*), la ubicación de la Ciudad Universitaria UNT (`-8.1147, -79.0386`), el gráfico de próximas 24 horas y la distinción explícita entre pronóstico numérico y observación in situ. Activar brevemente el check *"Modo sin conexión (caché)"* para demostrar resiliencia offline.
- **[0:20 – 0:55] Vista 2 (Mapa y Simulador):** Seleccionar *B — Ingreso reportado*. Leer en pantalla la lluvia del evento que se asignó por acumulado de 24 h; los valores se recalibran desde Open-Meteo Archive, no asumir un número fijo. Mostrar zonas testimoniales/prensa y la capa punteada **SINTÉTICA** hacia el SSO (~203°), con Shapely calculando exposición en una sección aparte. Aclarar que la lluvia no cambia la geometría, los testimonios no confirman cierres y los parámetros sintéticos son arbitrarios.
- **[0:55 – 1:35] Vista 3 (Ficha Preventiva Explicable y Continuidad):** Hacer clic en *"Ver Ficha Preventiva →"*. Mostrar la separación entre **Peligro** y **Exposición**, las **reglas transparentes activadas** (`R-MET-02`, `R-ACU-01`, `R-COND-01`, `R-ESP-01`), las **alternativas de continuidad académica** (transición temporal a aula virtual y reprogramación de prácticas) y el bloque de **cumplimiento SINAGERD / Ley N.° 29733**.

---

## 2. Trazabilidad de las capas y parámetros

- **A — relieve:** sectores bajo p15 de Copernicus GLO-30, un DSM de ~30 m. Es experimental y sirve para tendencias, no para charcos ni flujo hidráulico.
- **B — reporte:** zonas ancladas a OSM por testimonio/prensa. Los dos tramos de avenida se recortan a un buffer cartográfico de 40 m del perímetro para mostrar solo el frente del campus; no es un umbral de inundación y la extensión real no está documentada.
- **C — combinado:** p30 experimental más las zonas reportadas, sin fusionar la influencia SINTÉTICA.
- **SINTÉTICO:** envolvente del reporte y su desplazamiento según el azimut de descenso DEM (actualmente ~203°), con alcance por defecto de 40 m en B / 80 m en C y buffer lateral de 15 m. Se eligieron como dos distancias ilustrativas (80 m es el doble para distinguir C) y una expansión lateral visible; no tienen base de campo ni calibración. Son ajustables, no predicen y el alcance no depende de la lluvia.
- **Canaletas nuevas de la UNT:** no modeladas (sin datos). La lista de curación está vacía hasta recibir datos de la UNT o una visita de campo.
- **Lluvia:** `eventos_referencia.json` registra máximos horarios, máximos móviles de 24 h y horas ≥0,1 mm de Open-Meteo Archive. El reanálisis aproxima; no reemplaza estaciones SENAMHI. Los presets asignan A/B/C por acumulado 24 h ascendente; en ausencia de red, 12/28/45 mm/h quedan explícitamente como supuestos de demostración.

| Ventana documentada | Máx. horario | Máx. móvil 24 h | Horas ≥0,1 mm | Preset |
|---|---:|---:|---:|---|
| 12–18 mar 2017 | 3,1 mm/h | 21,8 mm | 49 | B (24 h, acotadas) |
| 9–16 mar 2023 | 2,8 mm/h | 23,8 mm | 60 | C (24 h, acotadas) |
| 26–31 mar 2025 | 5,0 mm/h | 13,0 mm | 16 | A |

Consulta realizada el 24-nov-2026; son valores del reanálisis en el punto de consulta, no mediciones de estación. Presets por acumulado ascendente: A=2025, B=2017, C=2023.
- Todas las capas son referenciales/experimentales y no reemplazan estudios de CENEPRED/SIGRID/INDECI.

## 3. Tres preguntas probables adicionales

1. **¿Por qué A y C caen en el suroeste?**
   *Respuesta:* Los contornos se derivan de percentiles del DEM dentro del campus y el DSM observado tiene cotas relativamente bajas hacia ese sector. Con resolución cercana a 30 m y error vertical declarado, es una tendencia experimental, no una ruta del agua ni un pronóstico de inundación.
2. **¿Por qué la Puerta 4 no aparece en el DEM?**
   *Respuesta:* El DEM solo aporta elevación de celdas de ~30 m; no identifica puertas, muros, huecos ni el ingreso reportado. La Puerta 4 aparece como referencia testimonial/prensa en B/C, no como hallazgo del DEM.
3. **¿De dónde sale el alcance SINTÉTICO?**
   *Respuesta:* 40 m para B, 80 m para C (el doble como contraste visual) y 15 m de expansión lateral son parámetros arbitrarios para una demostración, orientada por el azimut DEM (~203°). No provienen de mediciones ni tienen validación de campo; deben calibrarse con datos de la UNT.

## 4. 20 Preguntas Difíciles del Jurado y Respuestas Sustentadas

1. **¿En qué se diferencian de SENAMHI, SIGRID, GEOQUEBRADAS o CENDEHUA?**  
   *Respuesta:* Esas plataformas oficiales operan a escala nacional, distrital o en cuencas instrumentadas específicas (como Rímac o Huaycoloro). YAKU ALERT no compite con ellas ni las duplica: traduce datos meteorológicos y contexto espacial a **microescala universitaria** mediante un **motor explicable** que orienta decisiones de prevención y continuidad académica en la UNT.

2. **¿Por qué no usaron Machine Learning o Deep Learning?**  
   *Respuesta:* Porque no existen series históricas etiquetadas de anegamientos internos dentro del campus UNT para entrenar y validar un modelo de ML sin sobreajuste ni falsas correlaciones. Usar un motor de reglas transparentes permite trazabilidad total ante el jurado y autoridades.

3. **¿La lluvia de los presets representa un umbral de riesgo validado?**
   *Respuesta:* No. Se consulta precipitación horaria del reanálisis de Open-Meteo para tres ventanas documentadas, pero la grilla puede subestimar lluvia local y no reemplaza estaciones SENAMHI. Si la consulta falla, se conservan 12/28/45 mm/h solo como supuestos de demostración. Ningún valor es un umbral de seguridad.

4. **¿Cómo evitan generar pánico o falsas alertas en los estudiantes?**  
   *Respuesta:* Primero, un banner permanente distingue datos reales de escenarios simulados. Segundo, el sistema nunca emite "alertas rojas operativas" ni órdenes de evacuación obligatoria; genera estados preventivos informativos sujetos a las autoridades del SINAGERD (Ley N.° 29664).

5. **¿Convierten la probabilidad de lluvia de Open-Meteo en probabilidad de huaico?**  
   *Respuesta:* Jamás. La probabilidad de lluvia (>0.1 mm en 1h) es una variable atmosférica; la activación de una quebrada depende de geología, pendiente, suelo antecedente y obras de mitigación. Nuestro motor separa estrictamente peligro meteorológico, exposición espacial y contexto informativo de quebradas.

6. **¿Qué pasa si se cae internet durante una lluvia extrema o durante esta presentación?**  
   *Respuesta:* El backend incluye una caché local verificada de Open-Meteo (`open_meteo_fallback.json`) y el simulador con Shapely funciona 100% offline sin depender de APIs externas.

7. **¿Por qué Open-Meteo y no la API directa de SENAMHI?**  
   *Respuesta:* Open-Meteo ofrece una API REST abierta, documentada y estable sin restricciones de scraping. En producción institucional, la arquitectura modular (`services/weather.py`) permite integrar datos oficiales de SENAMHI mediante convenio.

8. **¿Qué precisión espacial tiene Open-Meteo frente al tamaño del campus UNT?**  
   *Respuesta:* Los modelos globales como ECMWF tienen resolución aproximada de 0.1° a 0.25° (~10–25 km), por lo que no resuelven microdrenajes internos. Esa limitación se muestra explícitamente al usuario en la Vista 1 y Vista 3.

9. **¿Cómo garantizan la privacidad según la Ley N.° 29733?**  
   *Respuesta:* Por diseño (*Privacy by Design*): el MVP no pide registro, DNI, correo ni geolocalización GPS del dispositivo del estudiante. No almacenamos datos personales.

10. **¿Las rutas verdes/moradas en el mapa garantizan que son seguras para evacuar?**  
    *Respuesta:* No. Están etiquetadas explícitamente como *"rutas referenciales de simulación"* y no garantizan transitabilidad ni seguridad operativa en un evento real.

11. **¿El análisis espacial es visual solamente o hay cálculo geométrico real?**  
    *Respuesta:* **Shapely 2.x** calcula intersecciones y áreas sobre polígonos de edificios OSM y zonas separadas: A usa cota baja experimental DEM; B son ubicaciones reportadas; C combina ambas. La influencia SINTÉTICA se calcula aparte. La lluvia alimenta la evaluación preventiva, nunca modifica ningún polígono.

12. **¿Cómo detectan si se activan las quebradas San Ildefonso, San Carlos o El León?**  
    *Respuesta:* Este MVP **no** afirma detección en tiempo real de quebradas porque no cuenta con sensores propios ni acceso autorizado a cámaras/pluviómetros del IGP/CENDEHUA o ANIN. Solo presenta contexto informativo externo.

13. **¿Qué pasaría si un edificio de la UNT tiene 4 pisos y el agua afecta el primer piso?**  
    *Respuesta:* El sistema distingue exposición exterior/primer nivel de evacuación total, recomendando resguardo en pisos superiores seguros cuando corresponda y evitando transitar por accesos anegados.

14. **¿Cómo resuelve el problema de continuidad académica de las bases?**  
    *Respuesta:* Cada nivel preventivo en la Vista 3 propone medidas concretas y escalonadas: desde flexibilidad de asistencia y grabación de clases hasta migración temporal al aula virtual UNT y reprogramación de laboratorios sin penalización.

15. **¿Cuál fue el bug o reto técnico más difícil que resolvieron al construirlo?**  
    *Respuesta:* Detectamos en pruebas reales en Windows que `urllib`/IPv6 hacia Open-Meteo sufría timeouts en el handshake TLS, mientras que IPv4 respondía en <4 segundos. Lo resolvimos configurando `httpx.AsyncHTTPTransport(local_address="0.0.0.0")` más respaldo local automático.

16. **¿Qué validaciones reales han hecho hasta hoy y qué falta?**  
    *Respuesta:* Ejecutamos 43 pruebas automatizadas (`pytest`): 26 casos en `backend/tests/test_api.py` y 17 en `backend/tests/test_conditions.py`, cubriendo API real, modo offline, Shapely, reproducibilidad y seguridad. La validación presencial con 5–10 participantes UNT sigue pendiente y está protocolizada con las tareas T1–T5 de `DEMO_JURADO.md`, sin inventar datos previos.

17. **¿Cómo se sostiene económicamente después de la hackathon?**  
    *Respuesta:* Costo operativo casi nulo usando datos abiertos y software open-source, integrable en servidores institucionales de la UNT (DITT/OTI) y escalable mediante convenios con municipalidades distritales de La Libertad.

18. **¿Qué pasa si un atacante envía parámetros extremos al simulador?**  
    *Respuesta:* Pydantic valida estrictamente tipos y rangos (ej. intensidad `0..200 mm/h`, duración `1..72 h`, escenarios permitidos), rechazando entradas inválidas con HTTP 422, y el servidor añade cabeceras de seguridad (`nosniff`, `DENY`).

19. **¿Cómo escalarían esto fuera de la UNT hacia comunidades vulnerables de Trujillo?**  
    *Respuesta:* Bastaría con reemplazar el archivo GeoJSON de capas del campus por capas de manzanas, postas médicas y colegios de distritos como El Porvenir o Alto Trujillo, manteniendo intacto el motor explicable y el modo offline.

20. **¿Qué harían con el incentivo económico de S/ 1,500.00 si ganan?**  
    *Respuesta:* Financiar el levantamiento topográfico/GIS de microdrenajes del campus con especialistas de la UNT, ejecutar la validación de campo con usuarios y desplegar un piloto institucional oficial junto a Defensa Civil UNT.
