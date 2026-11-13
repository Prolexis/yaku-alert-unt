# GUION DE DEMOSTRACIÓN Y DEFENSA ANTE EL JURADO

## 1. Recorrido de Demostración (90 a 120 segundos dentro del Pitch de 5 min)

- **[0:00 – 0:20] Vista 1 (Monitoreo Real):** Mostrar el banner superior verde (*DATOS REALES DE PRONÓSTICO — Open-Meteo API*), la ubicación de la Ciudad Universitaria UNT (`-8.1147, -79.0386`), el gráfico de próximas 24 horas y la distinción explícita entre pronóstico numérico y observación in situ. Activar brevemente el check *"Modo sin conexión (caché)"* para demostrar resiliencia offline.
- **[0:20 – 0:55] Vista 2 (Mapa y Simulador Offline con Shapely):** Cambiar a *Escenario B — Lluvia Intensa FEN* (28 mm/h, 4h, drenaje obstruido). Mostrar cómo el banner cambia inmediatamente a ámbar (*MODO ESCENARIO SIMULADO / SINTÉTICO*) y cómo **Shapely** calcula en tiempo real qué pabellones (p. ej. Ingeniería, Biblioteca, Comedor) y accesos (Av. América Oeste) intersectan el polígono simulado, junto a puntos de encuentro y rutas referenciales.
- **[0:55 – 1:35] Vista 3 (Ficha Preventiva Explicable y Continuidad):** Hacer clic en *"Ver Ficha Preventiva →"*. Mostrar la separación entre **Peligro** y **Exposición**, las **reglas transparentes activadas** (`R-MET-02`, `R-ACU-01`, `R-COND-01`, `R-ESP-01`), las **alternativas de continuidad académica** (transición temporal a aula virtual y reprogramación de prácticas) y el bloque de **cumplimiento SINAGERD / Ley N.° 29733**.

---

## 2. 20 Preguntas Difíciles del Jurado y Respuestas Sustentadas

1. **¿En qué se diferencian de SENAMHI, SIGRID, GEOQUEBRADAS o CENDEHUA?**  
   *Respuesta:* Esas plataformas oficiales operan a escala nacional, distrital o en cuencas instrumentadas específicas (como Rímac o Huaycoloro). YAKU ALERT no compite con ellas ni las duplica: traduce datos meteorológicos y contexto espacial a **microescala universitaria** mediante un **motor explicable** que orienta decisiones de prevención y continuidad académica en la UNT.

2. **¿Por qué no usaron Machine Learning o Deep Learning?**  
   *Respuesta:* Porque no existen series históricas etiquetadas de anegamientos internos dentro del campus UNT para entrenar y validar un modelo de ML sin sobreajuste ni falsas correlaciones. Usar un motor de reglas transparentes permite trazabilidad total ante el jurado y autoridades.

3. **¿Sus umbrales de lluvia (10 mm/h, 30 mm/h) están científicamente validados para Trujillo?**  
   *Respuesta:* No, y lo declaramos explícitamente en la interfaz y en la ficha preventiva: son **umbrales experimentales de demostración (TRL 3–4)**. Su calibración formal requiere trabajo conjunto con Defensa Civil UNT e ingenieros hidráulicos/hidrólogos.

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
    *Respuesta:* Es cálculo geométrico real en el backend usando **Shapely 2.x** (`intersects` e `intersection().area`) entre los polígonos GeoJSON de peligro simulado y los polígonos/puntos de edificios y accesos UNT.

12. **¿Cómo detectan si se activan las quebradas San Ildefonso, San Carlos o El León?**  
    *Respuesta:* Este MVP **no** afirma detección en tiempo real de quebradas porque no cuenta con sensores propios ni acceso autorizado a cámaras/pluviómetros del IGP/CENDEHUA o ANIN. Solo presenta contexto informativo externo.

13. **¿Qué pasaría si un edificio de la UNT tiene 4 pisos y el agua afecta el primer piso?**  
    *Respuesta:* El sistema distingue exposición exterior/primer nivel de evacuación total, recomendando resguardo en pisos superiores seguros cuando corresponda y evitando transitar por accesos anegados.

14. **¿Cómo resuelve el problema de continuidad académica de las bases?**  
    *Respuesta:* Cada nivel preventivo en la Vista 3 propone medidas concretas y escalonadas: desde flexibilidad de asistencia y grabación de clases hasta migración temporal al aula virtual UNT y reprogramación de laboratorios sin penalización.

15. **¿Cuál fue el bug o reto técnico más difícil que resolvieron al construirlo?**  
    *Respuesta:* Detectamos en pruebas reales en Windows que `urllib`/IPv6 hacia Open-Meteo sufría timeouts en el handshake TLS, mientras que IPv4 respondía en <4 segundos. Lo resolvimos configurando `httpx.AsyncHTTPTransport(local_address="0.0.0.0")` más respaldo local automático.

16. **¿Qué validaciones reales han hecho hasta hoy y qué falta?**  
    *Respuesta:* Ejecutamos 9 pruebas automatizadas (`pytest`) cubriendo API real, modo offline, Shapely, reproducibilidad y seguridad. La validación presencial con 12–20 estudiantes/docentes UNT está planificada y protocolizada para ejecutarse del 14 al 24 de noviembre, sin inventar datos previos.

17. **¿Cómo se sostiene económicamente después de la hackathon?**  
    *Respuesta:* Costo operativo casi nulo usando datos abiertos y software open-source, integrable en servidores institucionales de la UNT (DITT/OTI) y escalable mediante convenios con municipalidades distritales de La Libertad.

18. **¿Qué pasa si un atacante envía parámetros extremos al simulador?**  
    *Respuesta:* Pydantic valida estrictamente tipos y rangos (ej. intensidad `0..200 mm/h`, duración `1..72 h`, escenarios permitidos), rechazando entradas inválidas con HTTP 422, y el servidor añade cabeceras de seguridad (`nosniff`, `DENY`).

19. **¿Cómo escalarían esto fuera de la UNT hacia comunidades vulnerables de Trujillo?**  
    *Respuesta:* Bastaría con reemplazar el archivo GeoJSON de capas del campus por capas de manzanas, postas médicas y colegios de distritos como El Porvenir o Alto Trujillo, manteniendo intacto el motor explicable y el modo offline.

20. **¿Qué harían con el incentivo económico de S/ 1,500.00 si ganan?**  
    *Respuesta:* Financiar el levantamiento topográfico/GIS de microdrenajes del campus con especialistas de la UNT, ejecutar la validación de campo con usuarios y desplegar un piloto institucional oficial junto a Defensa Civil UNT.
