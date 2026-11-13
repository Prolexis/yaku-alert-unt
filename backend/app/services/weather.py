import json
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


def parse_open_meteo_payload(
    raw: dict[str, Any],
    data_status: str,
    fetched_at_utc: str,
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
    temp = hourly_raw.get("temperature_2m", [])

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
        temp_val = float(temp[idx]) if idx < len(temp) and temp[idx] is not None else None

        points.append(
            HourlyForecastPoint(
                time=str(t),
                precipitation_mm=round(p_val, 2),
                precipitation_probability_pct=pr_val,
                rain_mm=round(r_val, 2),
                relative_humidity_2m_pct=h_val,
                wind_speed_10m_kmh=round(w_val, 1) if w_val is not None else None,
                temperature_2m_c=round(temp_val, 1) if temp_val is not None else None,
            )
        )

    first_24 = points[:24]
    first_48 = points[:48]
    max_intensity = max((pt.precipitation_mm for pt in first_24), default=0.0)
    acc_24 = round(sum(pt.precipitation_mm for pt in first_24), 2)
    acc_48 = round(sum(pt.precipitation_mm for pt in first_48), 2)
    event_hours = sum(1 for pt in first_24 if pt.precipitation_mm >= 0.1)

    probs = [pt.precipitation_probability_pct for pt in first_24 if pt.precipitation_probability_pct is not None]
    max_prob = max(probs) if probs else None

    hums = [pt.relative_humidity_2m_pct for pt in first_24 if pt.relative_humidity_2m_pct is not None]
    avg_hum = round(sum(hums) / len(hums), 1) if hums else None

    units_raw = raw.get("hourly_units", {})
    units = {
        "precipitation": str(units_raw.get("precipitation", "mm")),
        "precipitation_probability": str(units_raw.get("precipitation_probability", "%")),
        "relative_humidity_2m": str(units_raw.get("relative_humidity_2m", "%")),
        "wind_speed_10m": str(units_raw.get("wind_speed_10m", "km/h")),
        "temperature_2m": str(units_raw.get("temperature_2m", "°C")),
    }

    data_nature = (
        "DATOS_REALES_API_PRONOSTICO"
        if data_status == "LIVE_API"
        else "RESPALDO_LOCAL_CACHE_PRONOSTICO"
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
            max_probability_pct=max_prob,
            avg_humidity_pct=avg_hum,
        ),
        hourly=points,
        limitations=[
            "Resolución espacial aproximada de modelo global (~0.1°–0.25°); no captura microdrenajes internos del campus.",
            "Los valores son pronósticos horarios, no observaciones en tiempo real de estación meteorológica.",
            "La probabilidad de precipitación no equivale a probabilidad de inundación ni de activación de quebradas.",
        ],
    )


async def fetch_weather_for_unt(force_offline: bool = False) -> WeatherResponse:
    now_utc = datetime.now(timezone.utc).isoformat()
    params = {
        "latitude": UNT_CAMPUS_LAT,
        "longitude": UNT_CAMPUS_LON,
        "hourly": "precipitation,precipitation_probability,rain,relative_humidity_2m,wind_speed_10m,temperature_2m",
        "timezone": UNT_TIMEZONE,
        "forecast_days": 2,
    }

    if not force_offline:
        try:
            # Force IPv4 local_address to avoid IPv6 TLS handshake timeouts on Windows networks
            transport = httpx.AsyncHTTPTransport(local_address="0.0.0.0")
            async with httpx.AsyncClient(transport=transport, timeout=8.0) as client:
                resp = await client.get(OPEN_METEO_URL, params=params)
                resp.raise_for_status()
                raw = resp.json()
                return parse_open_meteo_payload(raw, data_status="LIVE_API", fetched_at_utc=now_utc)
        except Exception:
            pass

    if not WEATHER_FALLBACK_PATH.exists():
        raise FileNotFoundError("No se encontró el archivo local de respaldo meteorológico.")

    with WEATHER_FALLBACK_PATH.open("r", encoding="utf-8") as f:
        fallback_raw = json.load(f)

    return parse_open_meteo_payload(
        fallback_raw,
        data_status="OFFLINE_FALLBACK",
        fetched_at_utc=f"{now_utc} (usando caché local verificada)",
    )
