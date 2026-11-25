from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.models import (
    HydroDrainageState,
    HydroInflowLevel,
    HydroPresetsResponse,
    HydroRunRequest,
    HydroRunResponse,
    PreventiveEvaluation,
    SimulationRequest,
    SimulationResponse,
    WeatherResponse,
)
from app.services.conditions import load_conditions_catalog, resolve_conditions
from app.services.hydro import list_presets, run_hydro_simulation
from app.services.preventive_engine import evaluate_preventive_rules, load_protocols
from app.services.simulator import run_offline_simulation
from app.services.spatial import analyze_conditions_exposure, load_campus_geojson, load_hazards_geojson
from app.services.weather import fetch_weather_for_unt

app = FastAPI(
    title="YAKU ALERT — UNT API",
    description=(
        "Plataforma inteligente de monitoreo meteorológico, análisis espacial (Shapely) "
        "y motor de decisiones preventivas explicables para la UNT. Hackathon Innova Norte 3G 2026."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.get("/api/health")
def health_check() -> dict:
    return {
        "status": "ok",
        "service": "YAKU ALERT — UNT",
        "trl": "TRL 3-4 (Prototipo evaluado en entorno simulado)",
        "privacy": "Sin recopilación de datos personales (Ley N.° 29733)",
    }


@app.get("/api/weather", response_model=WeatherResponse)
async def get_weather(
    offline: bool = Query(default=False, description="Forzar uso de caché local sin conexión"),
) -> WeatherResponse:
    try:
        return await fetch_weather_for_unt(force_offline=offline)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Error obteniendo datos meteorológicos: {exc}")


@app.get("/api/campus/layers")
def get_campus_layers() -> dict:
    return {
        "campus": load_campus_geojson(),
        "hazards": load_hazards_geojson(),
    }


@app.get("/api/preventive/evaluate", response_model=PreventiveEvaluation)
async def get_live_preventive_evaluation(
    offline: bool = Query(default=False, description="Forzar uso de caché local sin conexión"),
    conditions: list[str] = Query(
        default=[],
        description="Condiciones externas declaradas como activas (ids de /api/conditions). Sin ellas, no cambia el comportamiento previo.",
    ),
) -> PreventiveEvaluation:
    try:
        resolved = resolve_conditions(conditions) if conditions else None
        spatial = analyze_conditions_exposure(resolved.active)[0] if resolved else None
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    weather = await fetch_weather_for_unt(force_offline=offline)
    return evaluate_preventive_rules(
        max_intensity_mm_h=weather.summary.max_intensity_mm_h,
        accumulated_mm=weather.summary.accumulated_24h_mm,
        duration_hours=max(1, weather.summary.estimated_event_duration_h),
        drainage_obstructed=False,
        antecedent_soil_saturated=False,
        spatial=spatial,
        is_synthetic=False,
        weather_meta=weather,
        external_rules=resolved.fired_rules if resolved else None,
    )


@app.post("/api/simulate", response_model=SimulationResponse)
def simulate_scenario(payload: SimulationRequest) -> SimulationResponse:
    try:
        return run_offline_simulation(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/conditions")
def get_external_conditions() -> dict:
    """Catálogo de condiciones externas declarables (sí/no) y sus reglas."""
    return load_conditions_catalog()


@app.get("/api/protocols")
def get_protocols() -> dict:
    return load_protocols()


# ---------------------------------------------------------------------------
# Motor de agua (capa NUEVA — no modifica los endpoints anteriores)
# ---------------------------------------------------------------------------
@app.post("/api/hydro/run", response_model=HydroRunResponse)
def hydro_run(payload: HydroRunRequest) -> HydroRunResponse:
    """Corre la simulación exploratoria de escurrimiento con la serie recibida.

    Validación: los campos siguen las reglas de HydroRunRequest (0-200 mm/h,
    máximo 48 h, estados y niveles literales) -> 422 en FastAPI si no cumplen.
    """
    try:
        return run_hydro_simulation(
            payload.rainfall_mm_h,
            drainage_state=payload.drainage_state,
            inflow_p4=payload.inflow_p4,
            secondary_inflow=payload.secondary_inflow,
            use_reported_sinks=payload.use_reported_sinks,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/hydro/presets", response_model=HydroPresetsResponse)
def hydro_presets() -> HydroPresetsResponse:
    """Eventos de referencia con su hietograma horario (acumulado dato + reparto supuesto)."""
    return list_presets()


@app.get("/api/hydro/forecast", response_model=HydroRunResponse)
async def hydro_forecast(
    offline: bool = Query(default=False, description="Forzar caché local sin conexión"),
    drainage_state: HydroDrainageState = Query(
        default="normal", description="normal | obstruido | pendiente_deficiente"
    ),
    inflow_p4: HydroInflowLevel = Query(
        default="medio", description="Nivel de ingreso externo por la Puerta 4"
    ),
    secondary_inflow: bool = Query(default=False, description="Activar ingreso P1-P3"),
    use_reported_sinks: bool = Query(
        default=False,
        description="Activar sumideros locales reportados (CIDUNT, Derecho, P4, Av. Juan Pablo II)",
    ),
) -> HydroRunResponse:
    """Simulación de 48 h alimentada con el pronóstico horario real de /api/weather.

    La serie horaria viene de la API meteorológica (o de la caché local si no hay
    red): data_nature lo indica con el sufijo LIVE_API / OFFLINE_FALLBACK.
    """
    try:
        weather = await fetch_weather_for_unt(force_offline=offline)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Error obteniendo el pronóstico: {exc}")

    series = [0.0] * 48
    for idx, point in enumerate(weather.hourly[:48]):
        series[idx] = max(0.0, round(float(point.precipitation_mm), 4))

    return run_hydro_simulation(
        series,
        drainage_state=drainage_state,
        inflow_p4=inflow_p4,
        secondary_inflow=secondary_inflow,
        use_reported_sinks=use_reported_sinks,
        data_nature=f"SIMULACION_CON_PRONOSTICO_HORARIO_{weather.data_status}",
        source=(
            f"pronóstico horario de {weather.source_name} "
            f"({weather.data_status}, {weather.fetched_at_utc})"
        ),
        weather=weather.model_dump(),
    )
