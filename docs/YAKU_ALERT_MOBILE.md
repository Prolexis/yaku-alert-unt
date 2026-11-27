# YAKU ALERT MOBILE — Documentación Técnica y Operativa (APK Android)

## 1. Propósito y Decisión de Producto (Una Sola Pantalla)

**YAKU ALERT MOBILE** (`pe.edu.unt.yakualert`) es la aplicación Android exclusiva para **estudiantes y visitantes** de la Ciudad Universitaria de la Universidad Nacional de Trujillo (UNT), desarrollada para **Hackathon Innova Norte 3G 2026 — Desafío 03 (Fenómeno El Niño)**.

Siguiendo el principio de mínima carga cognitiva (**`ABRIR → MIRAR → ENTENDER → RECIBIR AVISO → CONSULTAR QUÉ HACER`**), la APK presenta **una sola pantalla principal** centrada en el mapa interactivo de la UNT:

- **Sin menú lateral, sin 5 pestañas inferiores y sin vistas administrativas.**
- **Sin sensores `S01–S06`, gateways, telemetría MQTT ni configuración hidrológica.**
- **Encabezado mínimo:** `YAKU ALERT` · `Universidad Nacional de Trujillo`, indicador de conexión, buscador, botón de notificaciones y selector de modo claro/oscuro.
- **Mapa protagonista (70–80 % del alto útil):** cartografía real de la UNT (`OpenStreetMap`), instalaciones principales, zonas de atención documentadas, áreas elevadas/puntos de encuentro referenciales y —únicamente durante un simulacro activo— la evolución horaria del agua modelada.
- **Buscador directo:** *«¿Qué lugar de la UNT buscas?»* con chips de acceso rápido (`Comedor Universitario`, `Biblioteca Central`, `Rectorado`, `Ingeniería de Sistemas`, `Puerta 4`).
- **Panel inferior inteligente (Bottom Sheet de 2 posiciones):**
  - *Contraído:* resumen del pronóstico actual (o del simulacro activo).
  - *Expandido:* ficha de la instalación seleccionada con botón **«Ver recomendaciones»** o controles del simulacro educativo.

---

## 2. Arquitectura y Separación de Contextos en el Mismo Mapa

La aplicación opera sobre una única instancia de Leaflet con dos contextos visual y semánticamente separados:

### Contexto A — Monitoreo Actual (predeterminado)
- Muestra el pronóstico actualizado de **Open-Meteo** (indicando fuente y hora local `America/Lima`; nunca usa la etiqueta *«En vivo»* para pronósticos numéricos).
- Muestra instalaciones del campus, zonas de atención con antecedentes documentados (2017/2023) y puntos de encuentro referenciales.
- **Nunca superpone polígonos de agua de simulaciones históricas sobre el monitoreo actual.**

### Contexto B — Simulacro Educativo
- Se activa automáticamente cuando un administrador publica un simulacro autorizado desde la plataforma web o cuando el estudiante abre un escenario educativo (`Escenario tipo 2017` o `Escenario tipo 2023`).
- Muestra de forma persistente el cintillo:
  **`«SIMULACRO EDUCATIVO — NO ES UNA EMERGENCIA REAL»`**
- Renderiza las capas horarias preconstruidas (`h+1` a `h+24`) producidas por el motor hidrológico exploratorio del backend (`hydro.py`) sin recargar el mapa ni generar parpadeos.
- Incluye siempre el botón directo **`«Volver al monitoreo»`**.

---

## 3. Sincronización en Tiempo Real Web → APK (`WebSockets` + Control de Revisión)

### Modelo de Sesión en el Servidor (`backend/app/services/drill_sync.py`)
El backend FastAPI actúa como única fuente de verdad de la sesión pública de simulacro:

| Campo | Tipo | Descripción |
|---|---|---|
| `session_id` | `string` | Identificador único de la sesión (`drill-YYYYMMDDHHMMSS-hex` o `idle`). |
| `scenario_id` | `string \| null` | `evento_2017_03` o `evento_2023_03_10`. |
| `scenario_title` | `string \| null` | `Escenario tipo 2017` o `Escenario tipo 2023`. |
| `status` | `enum` | `idle` \| `published` \| `playing` \| `paused` \| `finished`. |
| `simulated_hour` | `int` | Hora simulada vigente (`1` a `24`). |
| `revision` | `int` | Secuencia entera monótona creciente que impide aplicar eventos antiguos o desordenados. |
| `published_at` | `string \| null` | Marca temporal ISO-8601 UTC de publicación. |
| `updated_at` | `string` | Marca temporal ISO-8601 UTC de última actualización. |
| `is_public` | `bool` | `true` mientras el simulacro está publicado (`published`, `playing`, `paused`). |
| `result_reference` | `object \| null` | Referencia ligera a `/api/public/simulation/{scenario_id}` con lámina máxima, hora pico e instalación focalizada (sin transmitir mallas GeoJSON completas por cada mensaje WebSocket). |

### Endpoints de Sincronización y Seguridad Administrativa
- `GET /api/public/drill/state`: devuelve el estado vigente del simulacro público para arranque inicial, clientes que se conectan tarde y reconexiones.
- `WS /api/ws/drill`: canal WebSocket de difusión instantánea (`drill_state`, `drill_published`, `drill_updated`, `drill_finished`).
- `POST /api/drill/publish`: publica explícitamente un simulacro (`evento_2017_03` o `evento_2023_03_10`). **Protegido con validación criptográfica HMAC-SHA256** (`verify_admin_token` en `backend/app/db.py`), aceptando únicamente tokens emitidos para roles administrativos (`directivo` u `operador_riesgos`). Solicitudes anónimas reciben `401 Unauthorized` y tokens de rol `estudiante` reciben `403 Forbidden`.
- `POST /api/drill/control`: sincroniza `play`, `pause`, `resume`, `set_hour` y `notify_facility` (requiere token administrativo verificado).
- `POST /api/drill/finish`: finaliza el simulacro público (`status = "finished"`, `is_public = false`) y devuelve las APKs al contexto de monitoreo.

---

## 4. Notificaciones Push, Deduplicación y Apertura Contextual

### Tres Niveles de Transporte Honestos
1. **Sincronización con APK abierta (`WebSocket` en vivo):** actualiza el mapa, la hora simulada y el banner interactivo de simulacro al instante.
2. **Notificaciones nativas Android (`@capacitor/local-notifications`):** cuando el dispositivo conectado recibe un evento de publicación o un aviso contextual de acumulación modelada con permiso otorgado (compatible con Android 13+ `POST_NOTIFICATIONS`), emite una notificación nativa en la bandeja del sistema Android. Al tocarla (`localNotificationActionPerformed`), la APK abre el escenario, salta a la hora simulada y enfoca la instalación correspondiente.
3. **Notificaciones remotas Firebase Cloud Messaging (`@capacitor/push-notifications` + FCM backend):**
   - El backend incluye soporte de despacho FCM (`_dispatch_fcm_if_configured` en `backend/app/services/drill_sync.py`) y registro consentido de dispositivos en la tabla SQLite `mobile_devices` (`POST /api/public/devices/register`).
   - El endpoint `GET /api/public/devices/push-status` informa de manera transparente si las credenciales externas de Firebase (`FCM_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` / `FCM_SERVICE_ACCOUNT_JSON` y `frontend/android/app/google-services.json`) están presentes. No se incrustan claves privadas de Firebase en el repositorio.

### Reglas de No Invención y Deduplicación
- Todas las notificaciones utilizan **exclusivamente salidas verificables de `hydro.py`** (por ejemplo, la instalación con nombre propio y lámina modelada `>= 2.0 cm` en el escenario activo).
- Cada aviso lleva un `notification_id` determinista (`{session_id}-publish` o `{session_id}-fac-{facility_id}`).
- Tanto el servidor (`_sent_notification_ids`) como la APK (`yaku_seen_notif_ids` en `localStorage`) deduplican por `notification_id`, garantizando que **no se envíen alertas repetidas por fotograma ni por reconexión**.

---

## 5. Configuración de Capacitor 6 y Permisos Android

- **Identificador de paquete (`appId`):** `pe.edu.unt.yakualert`
- **Nombre de la aplicación (`appName`):** `YAKU ALERT`
- **SDK de compilación / destino:** `compileSdkVersion = 34`, `targetSdkVersion = 34`, `minSdkVersion = 22`
- **Plugins Capacitor instalados:**
  - `@capacitor/app` (manejo nativo del botón Atrás de Android)
  - `@capacitor/local-notifications` (notificaciones nativas en bandeja Android + apertura contextual)
  - `@capacitor/push-notifications` (registro de token FCM y recepción remota)
  - `@capacitor/status-bar` (color institucional `#0B2545`)
- **Permisos declarados en `AndroidManifest.xml` (mínimos):**
  - `android.permission.INTERNET`
  - `android.permission.ACCESS_NETWORK_STATE`
  - `android.permission.POST_NOTIFICATIONS` (Android 13+)
  - `android.permission.VIBRATE`
  - *(No solicita cámara, contactos ni geolocalización GPS).*

---

## 6. Instrucciones de Compilación, Instalación y Configuración de Red

### 6.1 Iniciar el Backend y la Plataforma Web
```powershell
docker compose up -d --build
```
- **Web (Computadora / Administrador):** `http://localhost:8080`
- **Vista Móvil en navegador (Pruebas / E2E):** `http://localhost:8080/?mobile=1`
- **Backend FastAPI (accesible en red local Wi-Fi):** `http://192.168.0.23:8000`

### 6.2 Compilar el APK Android desde el código fuente
```powershell
cd frontend
$env:VITE_MOBILE_APP="true"
npm run build
npx cap sync android
cd android
$env:ANDROID_HOME="C:\Users\Usuario\AppData\Local\Android\Sdk"
.\gradlew.bat assembleDebug --no-daemon
```
Ruta del APK generado:
- `frontend/android/app/build/outputs/apk/debug/app-debug.apk`
- Copia en raíz estándar: `android/app/build/outputs/apk/debug/app-debug.apk`

### 6.3 Instalar la APK en un teléfono Android real
1. Conectar el celular y la computadora a la **misma red Wi-Fi local** (o activar un Hotspot Wi-Fi desde la laptop/celular).
2. Instalar por cable USB con ADB:
   ```powershell
   C:\Users\Usuario\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r android\app\build\outputs\apk\debug\app-debug.apk
   ```
   *(O copiar el archivo `app-debug.apk` al teléfono y abrirlo para instalar).*
3. Al abrir **YAKU ALERT** en el celular, tocar el indicador superior **«Conectado / Sin conexión»** y verificar que la URL del servidor apunte a la IP local de la computadora (preconfigurada en `http://192.168.0.23:8000`).

---

## 7. Guion de Demostración Cronometrado de 60 Segundos (Computadora + Android)

- **Segundos 0–10 (Monitoreo y búsqueda en el celular):**
  Abrir **YAKU ALERT** en el celular Android. Mostrar que carga directamente el mapa de la UNT sin menús complejos. Escribir *«Comedor»* en *«¿Qué lugar de la UNT buscas?»*, seleccionar **Comedor Universitario** y mostrar su ficha en el panel inferior con el pronóstico actual de Open-Meteo.
- **Segundos 10–20 (Publicación del simulacro desde la computadora):**
  En la computadora (`Gestión UNT` → `Simulación Dinámica`), mostrar la tarjeta **«4. Simulacro en APK Estudiante»**, elegir **Escenario tipo 2017 (27.5 mm)** y pulsar **«Publicar simulacro»**.
- **Segundos 20–35 (Sincronización instantánea y evolución del agua):**
  Sin tocar el celular, la APK recibe el evento por WebSocket, muestra el aviso **`YAKU ALERT · SIMULACRO`** y activa el cintillo **`SIMULACRO EDUCATIVO — NO ES UNA EMERGENCIA REAL`**. En la computadora, pulsar **«Iniciar reproducción»**: el jurado observa cómo la hora simulada (`h+1`, `h+2`, ...) y las manchas de agua modelada avanzan en tiempo real en el mapa del celular.
- **Segundos 35–45 (Consulta de instalación en el escenario):**
  En el celular, tocar una instalación con acumulación modelada y pulsar **«Ver recomendaciones»**, destacando que la aplicación explica claramente que se trata de un resultado exploratorio simulado.
- **Segundos 45–55 (Notificación contextual y apertura directa):**
  En la computadora, pulsar **«Emitir aviso contextual de instalación»**. En el celular aparece la notificación **`YAKU ALERT · SIMULACRO`** (*«El modelo representa acumulación de agua cerca de... Consulta el mapa»*). Al tocar la notificación, el mapa del celular enfoca automáticamente la instalación en la hora simulada correspondiente.
- **Segundos 55–60 (Finalización del simulacro):**
  En la computadora, pulsar **«Finalizar simulacro»**. La APK muestra inmediatamente *«El simulacro publicado ha finalizado»* y con un toque en **«Volver al monitoreo»** regresa al estado meteorológico actual.
