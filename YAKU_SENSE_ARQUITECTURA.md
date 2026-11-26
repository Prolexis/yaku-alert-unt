# YAKU SENSE — ARQUITECTURA DE RED IoT SIMULADA (UNT)

> **Estado actual:** Red de monitoreo IoT **virtual / simulada** integrada en **YAKU ALERT — UNT** (rama `simulacion-dinamica`).  
> **Transparencia:** **No existen sensores físicos instalados** ni gateway LoRaWAN operativo en la Ciudad Universitaria UNT. Todas las ubicaciones son propuestas sujetas a verificación en campo y sus lecturas derivan de escenarios experimentales (`hydro.py`) o quedan explícitamente como *«Sin lectura disponible»*.

---

## 1. Catálogo de los 6 sensores virtuales (`backend/app/data/sensores_virtuales.geojson`)

Todas las coordenadas están en **EPSG:4326 (WGS 84)**, dentro del perímetro del campus UNT y verificadas sobre **celdas abiertas exteriores** (`open_mask == True`) de `terrain_grid.json` (malla de 10 m derivada de DEM Copernicus GLO-30 + huellas OpenStreetMap).

| ID | Nombre y categoría | Variable y unidad | Coordenadas (lat, lon) y celda `(r, c)` | Criterio de ubicación | Fuente de lectura actual |
|---|---|---|---|---|---|
| **S01** | Pluviómetro en área abierta (`pluviometria`) | Precipitación horaria (`mm/h`) y acumulada (`mm`) | `-8.117776, -79.040767` · celda `(96, 45)`, cota `18.14 m`, `area_deportiva` | Celda abierta con vecindad 3×3 libre de edificios para evitar apantallamiento. | Reutiliza exactamente la serie horaria de lluvia del escenario activo (sin serie paralela). |
| **S02** | Nivel de agua en Puerta 4 (`nivel_agua`) | Lámina superficial modelada (`cm`) | `-8.111627, -79.036049` · celda `(28, 97)`, cota `27.62 m`, `via` | Celda abierta del conjunto de ingreso `p4` frente a Av. Jesús de Nazareth. | **Lámina modelada en el punto virtual** extraída de `hydro.py` en `(28, 97)`. |
| **S03** | Nivel de agua en Comedor Universitario (`nivel_agua`) | Lámina superficial modelada (`cm`) | `-8.116058, -79.039588` · celda `(77, 58)`, cota `20.84 m`, `otro` | Celda abierta exterior adyacente al Comedor Universitario (`way/1034573626`). | **Lámina modelada en el punto virtual** extraída de `hydro.py` en `(77, 58)`. |
| **S04** | Nivel de agua en Pabellón zona baja — Esc. Ing. de Materiales (`nivel_agua`) | Lámina superficial modelada (`cm`) | `-8.115696, -79.040132` · celda `(73, 52)`, cota `19.77 m`, `otro` | Pabellón académico con menor cota exterior en `terrain_grid.json` (`bld_osm_376779175`). | **Lámina modelada en el punto virtual** extraída de `hydro.py` en `(73, 52)`. |
| **S05** | Humedad del suelo en área verde (`humedad_suelo`) | Humedad volumétrica del suelo (`% VWC`) | `-8.112079, -79.037228` · celda `(33, 84)`, cota `25.77 m`, `area_verde` | Área verde con vecindad 3×3 abierta donde `hydro.py` aplica infiltración. | **Sin lectura disponible** (`hydro.py` asume infiltración de `5 mm/h` sin balance calibrado de VWC; no se inventan cifras). |
| **S06** | Temperatura y humedad ambiental — Biblioteca Central (`ambiental`) | Temperatura (`°C`) y Humedad relativa (`%`) | `-8.115154, -79.038771` · celda `(67, 67)`, cota `21.33 m`, `otro` | Exterior protegido adyacente a `Biblioteca Central` (`way/376779178`). | **Sin lectura disponible** (sin estación local instalada; backend actual solo ingesta precipitación). |

> **Nota sobre estado de ubicación:** Todos los puntos llevan la etiqueta **«Ubicación propuesta — pendiente de verificación de campo»**.

---

## 2. Integración con el autómata celular (`hydro.py`) y sincronización temporal

- **Estrategia de muestreo:** Lectura determinista de la **celda abierta exacta `(r, c)`** de la matriz de profundidad horaria `depth` (en metros, convertida a centímetros con 1 decimal) producida por `hydro.py`. No se promedian celdas bloqueadas ni se modifica el algoritmo físico.
- **Sincronización Play / Pause:** `DynamicSimulationView.jsx` comparte `hour` y `hydroResult` con `App.jsx`, `CampusMapView.jsx` y `YakuAssistantDrawer.jsx`. Al avanzar o pausar la animación, los marcadores y fichas de `S01–S04` reflejan exactamente la hora simulada activa sin relojes paralelos.
- **Simulación de conectividad:** Los botones **«Simular desconexión»** y **«Restablecer comunicación»** congelan la última lectura visible y registran su antigüedad en horas simuladas, **sin reemplazar el valor por cero** y **sin alterar los cálculos hidrológicos**.
- **Aislamiento del motor preventivo real:** Los sensores virtuales **nunca** alimentan las condiciones externas del modo pronóstico real ni generan alertas operativas oficiales.

---

## 3. Arquitectura IoT física propuesta (etapa futura — P2, NO operativa)

```text
Sensor físico en exterior del campus (S01–S06)
  ↓
Microcontrolador de bajo consumo (ESP32 / MCU) + módulo LoRaWAN
  ↓
Gateway LoRaWAN del campus (Ethernet institucional + respaldo celular)
  ↓
Servidor de red LoRaWAN (ChirpStack o The Things Stack)
  ↓
Integración autenticada MQTT o Webhook HTTP → Backend FastAPI
  ↓
Validación de unidades/IDs/duplicados + Almacenamiento con timestamp
  ↓
Visualización en Mapa Leaflet (YAKU ALERT) y Asistente YAKU
```

### Hardware candidato por tipo
- **S01 (Pluviómetro):** Pluviómetro de balancín (*tipping bucket*) + ESP32/LoRaWAN + carcasa IP65.
- **S02, S03, S04 (Nivel superficial):** Sensor sin contacto (radar de corto alcance o ultrasonido impermeable **sujeto a evaluación de zona ciega y precisión en láminas someras de 2 cm**) o sonda diseñada específicamente para aniegos superficiales.
- **S05 (Humedad del suelo):** Sonda capacitiva impermeable o TDR de humedad volumétrica (`% VWC`).
- **S06 (Ambiente):** Sensor termo-higrométrico **SHT31** o **BME280** dentro de escudo de radiación ventilado.

---

## 4. Limitaciones y requisitos previos a una instalación física real

1. **Regulación de espectro (Perú):** Verificar bandas ISM libres/autorizadas ante el **MTC** (p. ej. plan `AU915`).
2. **Cobertura radioeléctrica:** No existe prueba de línea de vista ni cobertura LoRaWAN confirmada en la UNT; requiere estudio de campo (*site survey*).
3. **Calibración y precisión:** Un DEM de 30 m (`±4 m` LE90) y celdas de 10 m no garantizan precisión centimétrica real; los sensores físicos requerirán calibración en laboratorio y campo.
4. **Energía y mantenimiento:** Evaluar alimentación solar/batería, limpieza de pluviómetros/sondas y protección antivandalismo.
5. **Permisos institucionales:** Aprobación formal de la Oficina de Infraestructura y Defensa Civil de la UNT.
6. **Operación offline:** El catálogo y la simulación operan sin internet externo, pero requieren el servidor local FastAPI (`localhost:8000`) en ejecución.

---

## 5. Guion de demostración de YAKU SENSE para el jurado (60–90 segundos)

1. Abrir **Mapa UNT** y pulsar el botón **`Sensores IoT [SIM]`** → aparecen los 6 marcadores (`S01–S06`) con leyenda.
2. Hacer clic en **`S03`** (*Comedor Universitario*) → mostrar la ficha lateral compacta, su ubicación propuesta, advertencias y desplegar **«¿Cómo se conectaría físicamente?»** (flujo LoRaWAN).
3. Pasar a **Simulación dinámica `[EXP]`**, elegir **`Evento tipo 2023`**, drenaje **`Obstruido (hipótesis)`**, ingreso Puerta 4 **`Alto`**, y pulsar **Calcular**.
4. Mostrar cómo **`S02`** (Puerta 4) y **`S03`** (Comedor) actualizan sus lecturas sincronizadas al pulsar **Reproducir / Pausa**.
5. Pulsar **«Simular desconexión»** en `S03`, avanzar la línea de tiempo y comprobar que se conserva el último dato recibido con su antigüedad (sin ponerse en cero ni alterar el agua modelada).
6. Abrir **Asistente YAKU** y preguntar **«¿Qué indica el sensor del comedor?»** → el asistente explica la lectura virtual y ofrece el botón directo **`Ver S03 en Mapa UNT`**.
7. **Mensaje de cierre:** *«YAKU ALERT ya integra pronósticos, cartografía y simulaciones preventivas. Con YAKU SENSE demostramos cómo incorporaríamos una futura red de monitoreo IoT distribuida alrededor de las instalaciones universitarias. Por ahora, los sensores son virtuales y sus lecturas derivan de escenarios experimentales; la instalación y validación física son etapas posteriores.»*
