from functools import lru_cache
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.db import (
    authenticate_demo_user,
    build_cap_12_payload,
    confirm_alert_receipt,
    create_alert,
    create_continuity_decision,
    create_report,
    get_alert_by_id,
    get_db_stats,
    init_db,
    list_alerts,
    list_continuity_decisions,
    list_demo_users,
    list_reports,
    list_simulation_runs,
    record_simulation_run,
    resolve_alert,
    resolve_continuity_decision,
    update_report_status,
    validate_alert,
)

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
from app.services.hydro import list_presets, load_terrain_grid, run_hydro_simulation
from app.services.virtual_sensors import get_virtual_sensors_catalog
from app.services.preventive_engine import (
    build_hydro_evaluation,
    evaluate_preventive_rules,
    load_protocols,
)
from app.services.simulator import run_offline_simulation
from app.services.spatial import (
    analyze_conditions_exposure,
    load_campus_geojson,
    load_evacuation_geojson,
    load_hazards_geojson,
    load_trujillo_context_geojson,
)
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
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# Garantizar creación automática de tablas SQLite al arrancar FastAPI
init_db()


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
        "normative_framework": [
            "Ley N.° 29664 (Ley que crea el SINAGERD)",
            "D.S. N.° 048-2011-PCM (Reglamento de la Ley N.° 29664)",
            "D.S. N.° 115-2022-PCM (PLANAGERD 2022–2030)",
            "Ley N.° 29733 (Ley de Protección de Datos Personales)",
        ],
        "privacy": "Sin recopilación de datos personales ni geolocalización GPS (Ley N.° 29733)",
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
        "evacuation": load_evacuation_geojson(),
        "surrounding_context": load_trujillo_context_geojson(),
    }


@app.get("/api/campus/evacuation")
def get_campus_evacuation() -> dict:
    """Puntos seguros y rutas referenciales de evacuación dentro del campus UNT (TRL 3-4)."""
    return load_evacuation_geojson()


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
def _with_hydro_evaluation(response: HydroRunResponse) -> HydroRunResponse:
    response.evaluation = build_hydro_evaluation(response)
    return response


@app.post("/api/hydro/run", response_model=HydroRunResponse)
def hydro_run(payload: HydroRunRequest) -> HydroRunResponse:
    """Corre la simulación exploratoria de escurrimiento con la serie recibida.

    Validación: los campos siguen las reglas de HydroRunRequest (0-200 mm/h,
    máximo 48 h, estados y niveles literales) -> 422 en FastAPI si no cumplen.
    """
    try:
        return _with_hydro_evaluation(
            run_hydro_simulation(
                payload.rainfall_mm_h,
                drainage_state=payload.drainage_state,
                inflow_p4=payload.inflow_p4,
                secondary_inflow=payload.secondary_inflow,
                use_reported_sinks=payload.use_reported_sinks,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/hydro/evaluate", response_model=HydroRunResponse)
def hydro_evaluate(payload: HydroRunRequest) -> HydroRunResponse:
    """Evalúa la corrida y añade reglas R-HID y ventanas de acción explicables."""
    return hydro_run(payload)


@app.get("/api/hydro/presets", response_model=HydroPresetsResponse)
def hydro_presets() -> HydroPresetsResponse:
    """Eventos de referencia con su hietograma horario (acumulado dato + reparto supuesto)."""
    return list_presets()


@app.get("/api/sensors/virtual")
def virtual_sensors_catalog() -> dict:
    """Catálogo georreferenciado de los 6 sensores IoT virtuales (YAKU SENSE, simulados)."""
    return get_virtual_sensors_catalog(load_terrain_grid())


PUBLIC_SIMULATION_PRESETS = {
    "evento_2017_03": {
        "title": "Escenario tipo 2017",
        "summary": (
            "Escenario de lluvia de referencia inspirado en los antecedentes documentados "
            "de marzo de 2017 (27,5 mm en 24 h; hietograma horario supuesto)."
        ),
    },
    "evento_2023_03_10": {
        "title": "Escenario tipo 2023",
        "summary": (
            "Escenario de lluvia de referencia relacionado con los antecedentes documentados "
            "del 10 de marzo de 2023 (35 mm en el día; hietograma horario supuesto)."
        ),
    },
}


@lru_cache(maxsize=4)
def _cached_public_simulation(preset_id: str) -> dict:
    presets_resp = list_presets()
    preset = next((p for p in presets_resp.presets if p.id == preset_id), None)
    if preset is None:
        raise ValueError(f"Preset no disponible: {preset_id}")
    defaults = preset.defaults or {}
    run_resp = _with_hydro_evaluation(
        run_hydro_simulation(
            preset.rainfall_mm_h,
            drainage_state=defaults.get("drainage_state", "normal"),
            inflow_p4=defaults.get("inflow_p4", "medio"),
            secondary_inflow=bool(defaults.get("secondary_inflow", False)),
            use_reported_sinks=False,
            data_nature="SIMULACION_EXPLORATORIA_PUBLICA",
            source=f"{PUBLIC_SIMULATION_PRESETS[preset_id]['title']} ({preset.source})",
        )
    )
    payload = run_resp.model_dump()
    # Vista pública: no expone telemetría ni catálogo de sensores IoT virtuales
    payload["virtual_sensors"] = None
    payload["public_preset"] = {
        "id": preset.id,
        "title": PUBLIC_SIMULATION_PRESETS[preset_id]["title"],
        "summary": PUBLIC_SIMULATION_PRESETS[preset_id]["summary"],
        "total_mm": preset.total_mm,
        "hours": preset.hours,
        "source": preset.source,
        "note": preset.note,
    }
    return payload


@app.get("/api/public/simulation/{preset_id}")
def public_student_simulation(preset_id: str) -> dict:
    """Ejecuta de forma restringida y cacheada solo los escenarios públicos 2017 y 2023."""
    if preset_id not in PUBLIC_SIMULATION_PRESETS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Escenario público no permitido. Solo se admiten: "
                + ", ".join(sorted(PUBLIC_SIMULATION_PRESETS.keys()))
            ),
        )
    try:
        return _cached_public_simulation(preset_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


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

    return _with_hydro_evaluation(
        run_hydro_simulation(
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
    )


# ---------------------------------------------------------------------------
# Persistencia SQLite (7 tablas): Auth Demo, Alertas CAP 1.2, Confirmaciones,
# Reportes Anónimos, Simulacros y Decisiones de Continuidad
# ---------------------------------------------------------------------------
class DemoLoginRequest(BaseModel):
    email: str | None = None
    password: str | None = None
    quick_role: Literal[
        "estudiante",
        "docente",
        "administrativo",
        "directivo",
        "operador_riesgos",
    ] | None = None


class CreateAlertRequest(BaseModel):
    level: Literal[
        "INFORMATIVO",
        "VIGILANCIA_PREVENTIVA",
        "ATENCION_PREVENTIVA",
        "PREPARACION_CRITICA",
    ] = "VIGILANCIA_PREVENTIVA"
    severity: Literal["VERDE", "AMARILLO", "NARANJA", "ROJO"] | None = None
    target_profile: Literal["all", "student", "teacher", "admin"] = "all"
    target_roles: list[Literal["estudiante", "docente", "administrativo"]] = Field(
        default_factory=lambda: ["estudiante", "docente", "administrativo"]
    )
    channel: str = Field(default="campus_banner", max_length=40)
    title: str = Field(default="", max_length=160)
    message: str = Field(default="", max_length=1800)
    what_happens: str | None = Field(default=None, max_length=300)
    where_zone: str | None = Field(default=None, max_length=200)
    when_window: str | None = Field(default=None, max_length=120)
    what_to_do: str | None = Field(default=None, max_length=1500)
    issuer: str | None = Field(default=None, max_length=160)
    affected_zones: list[str] = Field(default_factory=list, max_length=12)
    status: Literal["borrador_pendiente_validacion", "emitida"] | None = None
    validated_by_role: Literal["directivo", "operador_riesgos"] | None = None


class ValidateAlertRequest(BaseModel):
    validated_by_role: Literal["directivo", "operador_riesgos"] = "directivo"


class ConfirmAlertRequest(BaseModel):
    role: Literal["estudiante", "docente", "administrativo", "directivo", "operador_riesgos"] = "estudiante"
    status: Literal["recibido", "en_zona_segura"] = "recibido"


class CreateReportRequest(BaseModel):
    category: Literal[
        "aniego",
        "drenaje_obstruido",
        "acceso_bloqueado",
        "zona_segura_ok",
    ]
    zone_name: str = Field(..., min_length=2, max_length=120)
    lat: float | None = Field(default=None, ge=-90.0, le=90.0)
    lon: float | None = Field(default=None, ge=-180.0, le=180.0)
    severity: Literal["baja", "media", "alta"] = "media"
    note: str = Field(default="", max_length=180)


class UpdateReportStatusRequest(BaseModel):
    status: Literal["pendiente", "verificado", "atendido"]
    verified_by_role: str | None = Field(default=None, max_length=40)


class RecordSimulationRunRequest(BaseModel):
    scenario_name: str = Field(..., min_length=2, max_length=140)
    params: dict = Field(default_factory=dict)
    peak_hour: int = Field(default=1, ge=1, le=48)
    max_depth_cm: float = Field(default=0.0, ge=0.0, le=500.0)
    affected_gates: list[str] = Field(default_factory=list, max_length=10)
    affected_buildings_count: int = Field(default=0, ge=0, le=500)
    executed_by_role: str = Field(default="operador_riesgos", max_length=40)


class CreateContinuityDecisionRequest(BaseModel):
    scope: Literal["academica", "administrativa"]
    target_area: str = Field(..., min_length=2, max_length=140)
    measure: str = Field(..., min_length=5, max_length=500)
    valid_until: str = Field(..., min_length=2, max_length=80)
    decided_by_role: Literal["directivo", "operador_riesgos"] = "directivo"


@app.get("/api/auth/demo-users")
def get_demo_users() -> dict:
    return {
        "users": list_demo_users(),
        "privacy": "5 cuentas sintéticas de demostración (0 PII — Ley N.° 29733).",
    }


@app.post("/api/auth/demo-login")
def post_demo_login(payload: DemoLoginRequest) -> dict:
    auth = authenticate_demo_user(
        email=payload.email,
        password=payload.password,
        quick_role=payload.quick_role,
    )
    if auth is None:
        raise HTTPException(status_code=401, detail="Credenciales demo inválidas o rol no reconocido.")
    return auth


@app.get("/api/alerts")
def get_alerts(
    active_only: bool = Query(default=False, description="Devolver solo alertas emitidas activas"),
    limit: int = Query(default=25, ge=1, le=100),
) -> dict:
    alerts = list_alerts(active_only=active_only, limit=limit)
    active = [a for a in alerts if a["active"] and a["status"] == "emitida"]
    drafts = [a for a in alerts if a["status"] == "borrador_pendiente_validacion"]
    return {
        "active_alerts": active,
        "draft_alerts": drafts,
        "alerts": alerts,
        "total_active": len(active),
        "total_drafts": len(drafts),
    }


@app.post("/api/alerts", status_code=201)
def post_alert(payload: CreateAlertRequest) -> dict:
    if not (payload.title.strip() or (payload.what_happens or "").strip()):
        raise HTTPException(status_code=422, detail="Debe incluir title o what_happens.")
    created = create_alert(
        level=payload.level,
        severity=payload.severity,
        target_profile=payload.target_profile,
        target_roles=payload.target_roles,
        channel=payload.channel,
        title=payload.title,
        message=payload.message,
        what_happens=payload.what_happens,
        where_zone=payload.where_zone,
        when_window=payload.when_window,
        what_to_do=payload.what_to_do,
        issuer=payload.issuer,
        affected_zones=payload.affected_zones,
        status=payload.status,
        validated_by_role=payload.validated_by_role,
    )
    return created


@app.patch("/api/alerts/{alert_id}/validate")
def patch_validate_alert(alert_id: int, payload: ValidateAlertRequest) -> dict:
    """Validación humana obligatoria: convierte borrador en alerta emitida."""
    validated = validate_alert(alert_id, validated_by_role=payload.validated_by_role)
    if validated is None:
        raise HTTPException(status_code=404, detail=f"Alerta #{alert_id} no encontrada.")
    return validated


@app.patch("/api/alerts/{alert_id}/resolve")
def patch_resolve_alert(alert_id: int) -> dict:
    resolved = resolve_alert(alert_id)
    if resolved is None:
        raise HTTPException(status_code=404, detail=f"Alerta #{alert_id} no encontrada.")
    return resolved


@app.get("/api/alerts/{alert_id}/cap")
def get_alert_cap_12(
    alert_id: int,
    format: Literal["json", "xml"] = Query(default="json"),
):
    alert = get_alert_by_id(alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alerta #{alert_id} no encontrada.")
    cap = build_cap_12_payload(alert)
    if format == "xml":
        return Response(
            content=cap["cap_xml"],
            media_type="application/xml",
            headers={
                "Content-Disposition": f'attachment; filename="{alert["cap_identifier"]}.xml"'
            },
        )
    return cap


@app.post("/api/alerts/{alert_id}/confirm", status_code=201)
def post_confirm_alert(alert_id: int, payload: ConfirmAlertRequest) -> dict:
    res = confirm_alert_receipt(alert_id, role=payload.role, status=payload.status)
    if res is None:
        raise HTTPException(status_code=404, detail=f"Alerta #{alert_id} no encontrada.")
    return res


@app.get("/api/reports")
def get_reports(limit: int = Query(default=50, ge=1, le=200)) -> dict:
    reports = list_reports(limit=limit)
    counts = {
        "pendiente": sum(1 for r in reports if r["status"] == "pendiente"),
        "verificado": sum(1 for r in reports if r["status"] == "verificado"),
        "atendido": sum(1 for r in reports if r["status"] == "atendido"),
    }
    return {
        "reports": reports,
        "counts": counts,
        "privacy_notice": "Reportes 100 % anónimos sin PII (Ley N.° 29733).",
    }


@app.post("/api/reports", status_code=201)
def post_report(payload: CreateReportRequest) -> dict:
    return create_report(
        category=payload.category,
        zone_name=payload.zone_name,
        lat=payload.lat,
        lon=payload.lon,
        severity=payload.severity,
        note=payload.note,
    )


@app.patch("/api/reports/{report_id}/status")
def patch_report_status(report_id: int, payload: UpdateReportStatusRequest) -> dict:
    updated = update_report_status(
        report_id, payload.status, verified_by_role=payload.verified_by_role
    )
    if updated is None:
        raise HTTPException(status_code=404, detail=f"Reporte #{report_id} no encontrado.")
    return updated


@app.get("/api/simulations/history")
def get_simulations_history(limit: int = Query(default=30, ge=1, le=100)) -> dict:
    runs = list_simulation_runs(limit=limit)
    return {"runs": runs, "total": len(runs)}


@app.post("/api/simulations/history", status_code=201)
def post_simulation_run(payload: RecordSimulationRunRequest) -> dict:
    return record_simulation_run(
        scenario_name=payload.scenario_name,
        params=payload.params,
        peak_hour=payload.peak_hour,
        max_depth_cm=payload.max_depth_cm,
        affected_gates=payload.affected_gates,
        affected_buildings_count=payload.affected_buildings_count,
        executed_by_role=payload.executed_by_role,
    )


@app.get("/api/continuity/decisions")
def get_continuity_decisions(
    active_only: bool = Query(default=False),
    limit: int = Query(default=30, ge=1, le=100),
) -> dict:
    decisions = list_continuity_decisions(active_only=active_only, limit=limit)
    active = [d for d in decisions if d["active"]]
    return {"active_decisions": active, "decisions": decisions, "total_active": len(active)}


@app.post("/api/continuity/decisions", status_code=201)
def post_continuity_decision(payload: CreateContinuityDecisionRequest) -> dict:
    return create_continuity_decision(
        scope=payload.scope,
        target_area=payload.target_area,
        measure=payload.measure,
        valid_until=payload.valid_until,
        decided_by_role=payload.decided_by_role,
    )


@app.patch("/api/continuity/decisions/{decision_id}/resolve")
def patch_resolve_continuity_decision(decision_id: int) -> dict:
    resolved = resolve_continuity_decision(decision_id)
    if resolved is None:
        raise HTTPException(status_code=404, detail=f"Decisión #{decision_id} no encontrada.")
    return resolved


@app.get("/api/sources/status")
def get_sources_status() -> dict:
    stats = get_db_stats()
    return {
        "persistence": stats,
        "sources": [
            {
                "id": "open_meteo_forecast",
                "name": "Open-Meteo Weather Forecast API",
                "category": "Pronóstico meteorológico 48 h",
                "models": "ECMWF / GFS / ICON",
                "coverage": "Ciudad Universitaria UNT (-8.1147, -79.0392) · 48 h horarias",
                "variables": "Lluvia (mm/h), probabilidad (%), presión (hPa), viento (km/h + °) y sensación térmica (°C)",
                "role": "Alimenta el semáforo preventivo, gráfico 24/48 h y variables sinópticas.",
                "status": "online_with_sqlite_cache",
                "latest_timestamp_utc": stats["latest_snapshot_utc"],
                "url": "https://open-meteo.com/",
            },
            {
                "id": "open_meteo_era5",
                "name": "Open-Meteo Historical Archive (ERA5) + Registros locales",
                "category": "Datos de referencia histórica (2017 y 2023)",
                "models": "Reanálisis ERA5 + antecedentes documentados UNT (parametrización exploratoria, no calibración cuantitativa)",
                "coverage": "Eventos de referencia marzo 2017 (27.5 mm) y 10 marzo 2023 (35 mm; hietograma supuesto)",
                "variables": "Acumulado diario de referencia y sectores históricos de anegamiento",
                "role": "Escenarios educativos interactivos sin confundirse con alertas en curso.",
                "status": "local_verified",
                "latest_timestamp_utc": None,
                "url": "https://open-meteo.com/en/docs/historical-weather-api",
            },
            {
                "id": "dem_osm_hydro",
                "name": "Copernicus DEM GLO-30 + OpenStreetMap + Autómata 10 m",
                "category": "Modelo espacial y escurrimiento exploratorio",
                "models": "DEM ~30 m (±4 m LE90) remuestreado a malla 10 m (sin nueva resolución topográfica observada) + Shapely 2.x",
                "coverage": "Campus UNT completo (edificios nombrados, accesos, puntos de encuentro referenciales)",
                "variables": "Cota relativa, flujo superficial exploratorio y lámina modelada (cm)",
                "role": "Intersección geométrica (Shapely) y autómata celular exploratorio (no modelo hidrodinámico validado).",
                "status": "local_verified",
                "latest_timestamp_utc": None,
                "url": "https://www.openstreetmap.org/",
            },
            {
                "id": "sqlite_local",
                "name": "SQLite 3 Embebido (Yaku Alert)",
                "category": "Persistencia operativa",
                "models": "SQLite WAL local (0 servidores externos)",
                "coverage": f"{stats['active_alerts']} alerta(s) activa(s) · {stats['total_reports']} reporte(s) anónimo(s) · {stats['weather_snapshots']} snapshot(s) clima",
                "variables": "Avisos institucionales, reportes comunitarios anónimos (0 PII) y caché Open-Meteo",
                "role": "Conecta Gestión UNT ↔ Estudiantes en tiempo real y respalda el modo offline.",
                "status": "active",
                "latest_timestamp_utc": stats["latest_snapshot_utc"],
                "url": None,
            },
            {
                "id": "sinagerd_official",
                "name": "COER La Libertad / COEN · SENAMHI · ENFEN · INDECI",
                "category": "Validación oficial Perú",
                "models": "Autoridades técnico-científicas del SINAGERD / PLANAGERD 2022–2030",
                "coverage": "Nacional / Región La Libertad / Provincia de Trujillo",
                "variables": "Avisos oficiales meteorológicos, activación de quebradas, comunicados FEN/TSM y normativa",
                "role": "Únicas fuentes oficiales vinculantes para decisiones de emergencia.",
                "status": "external_reference",
                "latest_timestamp_utc": None,
                "url": "https://www.senamhi.gob.pe/",
            },
        ],
    }
