import json
import time
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import (
    OPEN_METEO_URL,
    UNT_CAMPUS_LAT,
    UNT_CAMPUS_LON,
    UNT_TIMEZONE,
    WEATHER_FALLBACK_PATH,
)
from app.db import get_latest_weather_snapshot, save_weather_snapshot
from app.models import HourlyForecastPoint, WeatherResponse, WeatherSummary


def _safe_float(val: Any, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        num = float(val)
        return max(0.0, num) if num == num else default
    except (TypeError, ValueError):
        return default


def _safe_int(val: Any) -> int | None:
    if val is None:
        return None
    try:
        return int(round(float(val)))
    except (TypeError, ValueError):
        return None


CARDINAL_DIRECTIONS = ("N", "NE", "E", "SE", "S", "SO", "O", "NO")


def degrees_to_cardinal(deg: float | int | None) -> str | None:
    if deg is None:
        return None
    try:
        num = float(deg)
        if num != num:
            return None
        idx = int((num % 360) / 45.0 + 0.5) % 8
        return CARDINAL_DIRECTIONS[idx]
    except (TypeError, ValueError):
        return None


def _safe_optional_float(val: Any) -> float | None:
    if val is None:
        return None
    try:
        num = float(val)
        return num if num == num else None
    except (TypeError, ValueError):
        return None


def parse_open_meteo_payload(
    raw: dict[str, Any],
    data_status: str,
    fetched_at_utc: str,
    fallback_reason: str | None = None,
) -> WeatherResponse:
    hourly_raw = raw.get("hourly")
    if not isinstance(hourly_raw, dict) or not hourly_raw.get("time"):
        raise ValueError("Payload meteorológico inválido: falta serie horaria 'hourly.time'.")

    times = hourly_raw.get("time", [])
    precip = hourly_raw.get("precipitation", [])
    prob = hourly_raw.get("precipitation_probability", [])
    rain = hourly_raw.get("rain", [])
    humidity = hourly_raw.get("relative_humidity_2m", [])
    wind = hourly_raw.get("wind_speed_10m", [])
    wind_dir = hourly_raw.get("wind_direction_10m", [])
    temp = hourly_raw.get("temperature_2m", [])
    apparent_temp = hourly_raw.get("apparent_temperature", [])
    pressure = hourly_raw.get("surface_pressure", [])

    points: list[HourlyForecastPoint] = []
    for idx, t in enumerate(times):
        p_val = _safe_float(precip[idx] if idx < len(precip) else 0.0)
        r_val = _safe_float(rain[idx] if idx < len(rain) else p_val)
        pr_val = _safe_int(prob[idx]) if idx < len(prob) else None
        if pr_val is not None:
            pr_val = max(0, min(100, pr_val))
        h_val = _safe_int(humidity[idx]) if idx < len(humidity) else None
        if h_val is not None:
            h_val = max(0, min(100, h_val))
        w_val = _safe_float(wind[idx], 0.0) if idx < len(wind) else None
        wd_val = _safe_int(wind_dir[idx]) if idx < len(wind_dir) else None
        if wd_val is not None:
            wd_val = wd_val % 360
        wd_cardinal = degrees_to_cardinal(wd_val)
        temp_val = _safe_optional_float(temp[idx]) if idx < len(temp) else None
        app_val = _safe_optional_float(apparent_temp[idx]) if idx < len(apparent_temp) else None
        pres_val = _safe_optional_float(pressure[idx]) if idx < len(pressure) else None
        if pres_val is not None and not (800.0 <= pres_val <= 1100.0):
            pres_val = None

        points.append(
            HourlyForecastPoint(
                time=str(t),
                precipitation_mm=round(p_val, 2),
                precipitation_probability_pct=pr_val,
                rain_mm=round(r_val, 2),
                relative_humidity_2m_pct=h_val,
                wind_speed_10m_kmh=round(w_val, 1) if w_val is not None else None,
                wind_direction_10m_deg=wd_val,
                wind_direction_cardinal=wd_cardinal,
                temperature_2m_c=round(temp_val, 1) if temp_val is not None else None,
                apparent_temperature_c=round(app_val, 1) if app_val is not None else None,
                surface_pressure_hpa=round(pres_val, 1) if pres_val is not None else None,
            )
        )

    first_24 = points[:24]
    first_48 = points[:48]
    max_intensity = max((pt.precipitation_mm for pt in first_24), default=0.0)
    acc_24 = round(sum(pt.precipitation_mm for pt in first_24), 2)
    acc_48 = round(sum(pt.precipitation_mm for pt in first_48), 2)
    event_hours = sum(1 for pt in first_24 if pt.precipitation_mm >= 0.1)

    probs_24 = [pt.precipitation_probability_pct for pt in first_24 if pt.precipitation_probability_pct is not None]
    probs_48 = [pt.precipitation_probability_pct for pt in first_48 if pt.precipitation_probability_pct is not None]
    max_prob_24 = max(probs_24) if probs_24 else None
    max_prob_48 = max(probs_48) if probs_48 else None

    hums = [pt.relative_humidity_2m_pct for pt in first_24 if pt.relative_humidity_2m_pct is not None]
    avg_hum = round(sum(hums) / len(hums), 1) if hums else None

    pressures_24 = [pt.surface_pressure_hpa for pt in first_24 if pt.surface_pressure_hpa is not None]
    current_pressure = pressures_24[0] if pressures_24 else None
    min_pressure_24 = min(pressures_24) if pressures_24 else None

    first_pt = first_24[0] if first_24 else None
    current_wind_speed = first_pt.wind_speed_10m_kmh if first_pt else None
    current_wind_deg = first_pt.wind_direction_10m_deg if first_pt else None
    current_wind_cardinal = first_pt.wind_direction_cardinal if first_pt else None
    current_apparent_temp = first_pt.apparent_temperature_c if first_pt else None

    units_raw = raw.get("hourly_units", {})
    units = {
        "precipitation": str(units_raw.get("precipitation", "mm")),
        "precipitation_probability": str(units_raw.get("precipitation_probability", "%")),
        "relative_humidity_2m": str(units_raw.get("relative_humidity_2m", "%")),
        "wind_speed_10m": str(units_raw.get("wind_speed_10m", "km/h")),
        "wind_direction_10m": str(units_raw.get("wind_direction_10m", "°")),
        "temperature_2m": str(units_raw.get("temperature_2m", "°C")),
        "apparent_temperature": str(units_raw.get("apparent_temperature", "°C")),
        "surface_pressure": str(units_raw.get("surface_pressure", "hPa")),
    }

    data_nature = (
        "DATOS_REALES_API_PRONOSTICO"
        if data_status == "LIVE_API"
        else "RESPALDO_LOCAL_CACHE_PRONOSTICO"
    )
    confidence_label = (
        "Pronóstico probabilístico 48 h — Open-Meteo"
        if data_status == "LIVE_API"
        else "Pronóstico probabilístico 48 h — Caché local offline (Open-Meteo)"
    )

    return WeatherResponse(
        location_name="Ciudad Universitaria — UNT (Trujillo, Perú)",
        latitude=float(raw.get("latitude", UNT_CAMPUS_LAT)),
        longitude=float(raw.get("longitude", UNT_CAMPUS_LON)),
        timezone=str(raw.get("timezone", UNT_TIMEZONE)),
        data_status=data_status,
        data_nature=data_nature,
        observation_vs_forecast=(
            "Pronóstico numérico horario (Open-Meteo). No corresponde a mediciones de pluviómetro in situ."
        ),
        source_name="Open-Meteo Weather Forecast API (ECMWF / modelos numéricos)",
        source_url="https://api.open-meteo.com/v1/forecast",
        fetched_at_utc=fetched_at_utc,
        units=units,
        summary=WeatherSummary(
            max_intensity_mm_h=round(max_intensity, 2),
            accumulated_24h_mm=acc_24,
            accumulated_48h_mm=acc_48,
            estimated_event_duration_h=event_hours,
            max_probability_pct=max_prob_24,
            max_probability_24h_pct=max_prob_24,
            max_probability_48h_pct=max_prob_48,
            avg_humidity_pct=avg_hum,
            current_surface_pressure_hpa=current_pressure,
            min_surface_pressure_24h_hpa=min_pressure_24,
            current_wind_speed_kmh=current_wind_speed,
            current_wind_direction_deg=current_wind_deg,
            current_wind_direction_cardinal=current_wind_cardinal,
            current_apparent_temperature_c=current_apparent_temp,
            forecast_confidence_label=confidence_label,
        ),
        hourly=points,
        fallback_reason=fallback_reason,
        cache_period=(
            f"{points[0].time[:10]} a {points[-1].time[:10]}"
            if data_status != "LIVE_API" and points
            else None
        ),
        limitations=[
            "Resolución espacial aproximada de modelo global (~0.1°–0.25°); no captura microdrenajes internos del campus.",
            "Los valores son pronósticos horarios, no observaciones en tiempo real de estación meteorológica.",
            "La probabilidad de precipitación no equivale a probabilidad de inundación ni de activación de quebradas.",
        ],
    )


# Caché en memoria para no repetir la llamada a Open-Meteo en cada recarga.
LIVE_CACHE_SECONDS = 300  # un pronóstico reciente sirve 5 min
FAIL_BACKOFF_SECONDS = 60  # tras un fallo, no reintentar durante 1 min (evita esperas repetidas sin red)
_live_cache: dict[str, Any] = {"ts": 0.0, "raw": None}
_fail_state: dict[str, Any] = {"until": 0.0, "reason": ""}


def reset_weather_cache() -> None:
    _live_cache.update(ts=0.0, raw=None)
    _fail_state.update(until=0.0, reason="")


async def fetch_weather_for_unt(force_offline: bool = False) -> WeatherResponse:
    now_utc = datetime.now(timezone.utc).isoformat()
    params = {
        "latitude": UNT_CAMPUS_LAT,
        "longitude": UNT_CAMPUS_LON,
        "hourly": (
            "precipitation,precipitation_probability,rain,relative_humidity_2m,"
            "wind_speed_10m,wind_direction_10m,temperature_2m,apparent_temperature,surface_pressure"
        ),
        "timezone": UNT_TIMEZONE,
        "forecast_days": 2,
    }
    reason = "Modo sin conexión forzado por el usuario."

    if not force_offline:
        now = time.monotonic()
        if _live_cache["raw"] is not None and now - _live_cache["ts"] < LIVE_CACHE_SECONDS:
            return parse_open_meteo_payload(_live_cache["raw"], data_status="LIVE_API", fetched_at_utc=now_utc)
        if now < _fail_state["until"]:
            reason = _fail_state["reason"]
        else:
            try:
                # Force IPv4 local_address to avoid IPv6 TLS handshake timeouts on Windows networks
                transport = httpx.AsyncHTTPTransport(local_address="0.0.0.0")
                timeout = httpx.Timeout(5.0, connect=3.0)
                async with httpx.AsyncClient(transport=transport, timeout=timeout) as client:
                    resp = await client.get(OPEN_METEO_URL, params=params)
                    resp.raise_for_status()
                    raw = resp.json()
                parsed = parse_open_meteo_payload(raw, data_status="LIVE_API", fetched_at_utc=now_utc)
                _live_cache.update(ts=now, raw=raw)
                try:
                    save_weather_snapshot(raw, fetched_at_utc=now_utc, source="Open-Meteo")
                except Exception:
                    pass
                return parsed
            except Exception as exc:
                reason = f"No se pudo consultar Open-Meteo ({type(exc).__name__}); se usa el respaldo local."
                _fail_state.update(until=now + FAIL_BACKOFF_SECONDS, reason=reason)

    # Prioridad offline 1: último snapshot real almacenado en SQLite
    try:
        latest_snap = get_latest_weather_snapshot()
    except Exception:
        latest_snap = None

    if latest_snap and isinstance(latest_snap.get("payload"), dict):
        return parse_open_meteo_payload(
            latest_snap["payload"],
            data_status="OFFLINE_FALLBACK",
            fetched_at_utc=f"{latest_snap['fetched_at_utc']} (caché SQLite de última consulta real)",
            fallback_reason=reason,
        )

    # Prioridad offline 2: JSON estático empaquetado
    if not WEATHER_FALLBACK_PATH.exists():
        raise FileNotFoundError("No se encontró el archivo local de respaldo meteorológico.")

    with WEATHER_FALLBACK_PATH.open("r", encoding="utf-8") as f:
        fallback_raw = json.load(f)

    return parse_open_meteo_payload(
        fallback_raw,
        data_status="OFFLINE_FALLBACK",
        fetched_at_utc=f"{now_utc} (respaldo local; sus datos son de otra fecha)",
        fallback_reason=reason,
    )
