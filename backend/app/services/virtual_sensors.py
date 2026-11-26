"""YAKU SENSE — Servicio de red de sensores IoT virtuales (simulados).

Gestiona el catálogo georreferenciado de 6 sensores virtuales (S01-S06) sobre la
Ciudad Universitaria UNT y extrae lecturas deterministas y reproducibles a partir
de los resultados reales del autómata celular exploratorio (`hydro.py`) y de la
serie de lluvia del escenario activo.

REGLAS ESTRICTAS:
- No existen sensores físicos instalados.
- No se generan lecturas aleatorias de nivel de agua.
- No se inventan mediciones de humedad del suelo ni temperatura local cuando el
  modelo o la API no producen esa variable.
- No modifica el algoritmo físico de `hydro.py` ni altera las reglas preventivas
  de modo pronóstico real.
"""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Any, Sequence

import numpy as np

from app.config import DATA_DIR

SENSORS_GEOJSON_PATH = DATA_DIR / "sensores_virtuales.geojson"

IOT_ARCHITECTURE_PROPOSAL = {
    "title": "¿Cómo se conectaría físicamente? (Propuesta futura)",
    "operational_status": "PROPUESTA_FUTURA_NO_OPERATIVA",
    "pipeline": [
        "Sensor físico en exterior del campus",
        "Microcontrolador de bajo consumo (ESP32 / MCU) + módulo LoRaWAN",
        "Gateway LoRaWAN del campus (Ethernet o respaldo celular)",
        "Servidor de red LoRaWAN (ChirpStack o The Things Stack)",
        "Integración autenticada por MQTT o webhook HTTP hacia FastAPI",
        "Validación de unidades/duplicados, almacenamiento con timestamp y visualización en Leaflet + Asistente YAKU",
    ],
    "requirements_before_deployment": [
        "Verificar bandas de frecuencia libres/autorizadas en Perú (MTC, p. ej. AU915).",
        "Realizar pruebas de cobertura radioeléctrica real y línea de vista en la UNT (cobertura NO confirmada).",
        "Evaluar autonomía energética, mantenimiento preventivo y protección IP65/vandalismo.",
        "Calibrar sensores en laboratorio/campo (especialmente zona ciega en láminas someras de 2 cm).",
        "Gestionar permisos formales de instalación con Infraestructura y Defensa Civil UNT.",
    ],
}


@lru_cache(maxsize=1)
def _load_raw_geojson() -> dict[str, Any]:
    with SENSORS_GEOJSON_PATH.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def get_virtual_sensors_catalog(grid: Any | None = None) -> dict[str, Any]:
    """Devuelve el catálogo GeoJSON de sensores virtuales validado contra la malla."""
    raw = _load_raw_geojson()
    features_out: list[dict[str, Any]] = []

    for feat in raw.get("features", []):
        props = dict(feat.get("properties", {}))
        coords = feat.get("geometry", {}).get("coordinates", [])
        lon = float(coords[0]) if len(coords) >= 2 else None
        lat = float(coords[1]) if len(coords) >= 2 else None

        in_domain = False
        is_open_cell = False
        cell_rc = props.get("grid_rc")
        if grid is not None and lon is not None and lat is not None:
            col = int((lon - grid.origin_lon) / grid.dx_deg)
            row = int((grid.origin_lat - lat) / grid.dy_deg)
            if 0 <= row < grid.ny and 0 <= col < grid.nx:
                in_domain = True
                is_open_cell = bool(grid.open_mask[row, col])
                cell_rc = [row, col]

        props["in_model_domain"] = in_domain
        props["is_open_cell"] = is_open_cell
        props["grid_rc"] = cell_rc
        props["iot_architecture"] = IOT_ARCHITECTURE_PROPOSAL

        features_out.append({
            "type": "Feature",
            "geometry": feat.get("geometry"),
            "properties": props,
        })

    return {
        "type": "FeatureCollection",
        "name": raw.get("name", "yaku_sense_sensores_virtuales_unt"),
        "metadata": dict(raw.get("metadata", {})),
        "iot_architecture": IOT_ARCHITECTURE_PROPOSAL,
        "features": features_out,
    }


def build_virtual_sensor_readings(
    grid: Any,
    hourly_depths: Sequence[np.ndarray],
    rainfall_mm_h: Sequence[float],
    scenario_label: str,
    data_nature: str,
    run_id: str,
) -> list[dict[str, Any]]:
    """Extrae lecturas horarias deterministas para S01-S06 desde una corrida de hydro.py."""
    catalog = get_virtual_sensors_catalog(grid)
    n_hours = len(hourly_depths)
    rain_series = [round(float(v), 2) for v in rainfall_mm_h[:n_hours]]
    readings_out: list[dict[str, Any]] = []

    for feat in catalog["features"]:
        props = feat["properties"]
        sid = props["id"]
        coords = feat["geometry"]["coordinates"]
        in_domain = bool(props.get("in_model_domain"))
        is_open_cell = bool(props.get("is_open_cell"))
        rc = props.get("grid_rc")

        series: list[dict[str, Any]] = []
        status = "no_reading"
        peak_value: float | None = None
        peak_hour: int | None = None
        last_value: float | None = None
        reading_note = props.get("reading_source", "")

        if sid == "S01":
            acc = 0.0
            for idx in range(n_hours):
                val = rain_series[idx] if idx < len(rain_series) else 0.0
                acc = round(acc + val, 2)
                series.append({
                    "hour": idx + 1,
                    "label": f"h+{idx + 1}",
                    "value": val,
                    "accumulated_mm": acc,
                })
                if peak_value is None or val > peak_value:
                    peak_value = val
                    peak_hour = idx + 1
            last_value = series[-1]["value"] if series else None
            status = "active_virtual" if series else "no_reading"

        elif sid in ("S02", "S03", "S04"):
            if in_domain and is_open_cell and rc is not None:
                row, col = int(rc[0]), int(rc[1])
                for idx, depth_arr in enumerate(hourly_depths):
                    depth_cm = round(float(depth_arr[row, col]) * 100.0, 1)
                    series.append({
                        "hour": idx + 1,
                        "label": f"h+{idx + 1}",
                        "value": depth_cm,
                    })
                    if peak_value is None or depth_cm > peak_value:
                        peak_value = depth_cm
                        peak_hour = idx + 1
                last_value = series[-1]["value"] if series else None
                status = "active_virtual" if series else "no_reading"
            else:
                status = "no_reading"
                reading_note = "Punto fuera del ámbito abierto de terrain_grid.json — Información no disponible."

        else:
            # S05 (humedad del suelo) y S06 (temperatura / humedad ambiental):
            # El modelo hydro.py no calcula humedad volumétrica calibrada ni T/HR local.
            status = "no_reading"

        readings_out.append({
            "id": sid,
            "name": props["name"],
            "short_name": props["short_name"],
            "category": props["category"],
            "category_label": props["category_label"],
            "sensor_type": props["sensor_type"],
            "variable": props["variable"],
            "unit": props["unit"],
            "secondary_unit": props.get("secondary_unit"),
            "coordinates": coords,
            "location_label": props["location_label"],
            "location_status": props["location_status"],
            "associated_facility_id": props.get("associated_facility_id"),
            "associated_facility_name": props.get("associated_facility_name"),
            "grid_rc": rc,
            "in_model_domain": in_domain,
            "is_open_cell": is_open_cell,
            "physical_technology": props["physical_technology"],
            "connectivity_protocol": props["connectivity_protocol"],
            "reading_label": props["reading_label"],
            "reading_source": reading_note,
            "data_nature": props["data_nature"],
            "scenario_label": scenario_label,
            "scenario_data_nature": data_nature,
            "run_id": run_id,
            "virtual_status": status,
            "last_value": last_value,
            "peak_value": peak_value,
            "peak_hour": peak_hour,
            "series": series,
            "warnings": props.get("warnings", []),
            "iot_architecture": IOT_ARCHITECTURE_PROPOSAL,
        })

    return readings_out
