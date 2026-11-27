import asyncio
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.db import (
    authenticate_demo_user,
    build_cap_12_payload,
    claim_active_simulation_alert_dispatch,
    confirm_alert_receipt,
    create_alert,
    create_continuity_decision,
    create_report,
    get_active_simulation,
    get_alert_by_id,
    get_db_stats,
    init_db,
    list_alerts,
    list_continuity_decisions,
    list_demo_users,
    list_reports,
    list_simulation_runs,
    mark_active_simulation_alert_dispatched,
    record_simulation_run,
    resolve_alert,
    resolve_continuity_decision,
    save_active_simulation,
    stop_active_simulation,
    update_alert_whatsapp_status,
    update_report_status,
    validate_alert,
)

from app.models import (
    HydroDrainageScenario,
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
    build_building_recommendations,
    load_campus_geojson,
    load_evacuation_geojson,
    load_hazards_geojson,
    load_trujillo_context_geojson,
)
from app.services.weather import fetch_weather_for_unt
from app.services.whatsapp import get_whatsapp_channel_status, send_cap_alert_whatsapp

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
                drainage_scenario=payload.drainage_scenario,
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
    drainage_scenario: HydroDrainageScenario = Query(
        default="base", description="obstruido | base | canaletas_nuevas"
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
            drainage_scenario=drainage_scenario,
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
    send_whatsapp: bool = False
    offline: bool = False


class ValidateAlertRequest(BaseModel):
    validated_by_role: Literal["directivo", "operador_riesgos"] = "directivo"
    send_whatsapp: bool = False
    offline: bool = False


class SendWhatsAppAlertRequest(BaseModel):
    offline: bool = False
    use_template_fallback: bool = False
    recipients: list[str] | None = None


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


def _map_wa_dispatch_status(dispatch_status: str) -> str:
    if dispatch_status == "sent":
        return "enviado"
    if dispatch_status == "simulated":
        return "simulado"
    return "error"


@app.post("/api/alerts", status_code=201)
async def post_alert(payload: CreateAlertRequest) -> dict:
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
    if payload.send_whatsapp and created.get("status") == "emitida":
        dispatch = await send_cap_alert_whatsapp(created, offline=payload.offline)
        updated = update_alert_whatsapp_status(
            created["id"],
            _map_wa_dispatch_status(dispatch["status"]),
            dispatch.get("first_message_id"),
        )
        if updated:
            created = updated
        created["whatsapp_dispatch"] = dispatch
    return created


@app.patch("/api/alerts/{alert_id}/validate")
async def patch_validate_alert(alert_id: int, payload: ValidateAlertRequest) -> dict:
    """Validación humana obligatoria: convierte borrador en alerta emitida."""
    validated = validate_alert(alert_id, validated_by_role=payload.validated_by_role)
    if validated is None:
        raise HTTPException(status_code=404, detail=f"Alerta #{alert_id} no encontrada.")
    if payload.send_whatsapp:
        dispatch = await send_cap_alert_whatsapp(validated, offline=payload.offline)
        updated = update_alert_whatsapp_status(
            validated["id"],
            _map_wa_dispatch_status(dispatch["status"]),
            dispatch.get("first_message_id"),
        )
        if updated:
            validated = updated
        validated["whatsapp_dispatch"] = dispatch
    return validated


@app.get("/api/whatsapp/status")
def get_whatsapp_status() -> dict:
    """Estado del canal WhatsApp Cloud API (sin exponer tokens ni números completos)."""
    return get_whatsapp_channel_status()


@app.post("/api/alerts/{alert_id}/send-whatsapp")
async def post_send_alert_whatsapp(
    alert_id: int,
    payload: SendWhatsAppAlertRequest | None = None,
) -> dict:
    """Envía una alerta CAP 1.2 por WhatsApp Cloud API (Sandbox) y guarda wamid en SQLite."""
    alert = get_alert_by_id(alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alerta #{alert_id} no encontrada.")
    req = payload or SendWhatsAppAlertRequest()
    dispatch = await send_cap_alert_whatsapp(
        alert,
        recipients=req.recipients,
        offline=req.offline,
        use_template_fallback=req.use_template_fallback,
    )
    db_status = _map_wa_dispatch_status(dispatch["status"])
    updated = update_alert_whatsapp_status(
        alert_id,
        db_status,
        dispatch.get("first_message_id"),
    )
    return {
        "alert": updated or alert,
        "whatsapp": dispatch,
    }


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


# ---------------------------------------------------------------------------
# Simulación en vivo (Gestión UNT -> Comunidad UNT) + Alerta CAP automática (10 s)
# + Recomendaciones dinámicas por edificio y por rol (Bloques 1 y 2)
# ---------------------------------------------------------------------------
_live_auto_alert_task: asyncio.Task | None = None


class ActivateLiveSimulationRequest(BaseModel):
    scenario_id: str = Field(default="evento_2023_03_10", max_length=80)
    scenario_label: str | None = Field(default=None, max_length=160)
    drainage_scenario: HydroDrainageScenario = "base"
    drainage_state: HydroDrainageState = "normal"
    rainfall_mm_h: list[float] | None = Field(default=None, max_length=48)
    duration_hours: int | None = Field(default=None, ge=1, le=48)
    inflow_p4: HydroInflowLevel | None = None
    secondary_inflow: bool | None = None
    use_reported_sinks: bool = False
    auto_alert_delay_sec: int = Field(default=10, ge=0, le=300)
    send_whatsapp: bool = True
    activated_by_role: Literal["directivo", "operador_riesgos"] = "operador_riesgos"
    offline: bool = False


def _compute_simulation_confidence(
    hydro_run: HydroRunResponse,
    rainfall_series: list[float],
    inflow_p4: str,
) -> tuple[int, list[dict[str, Any]]]:
    """Calcula certeza modelada explicable y determinista (base 55 %, tope 95 %)."""
    factors: list[dict[str, Any]] = [
        {
            "factor": "Base determinista DEM 10 m + reglas R-HID",
            "points": 55,
            "met": True,
            "detail": "Autómata celular 10 m sobre relieve Copernicus DEM + catálogo UNT.",
        }
    ]
    score = 55

    max_rain = max(rainfall_series) if rainfall_series else 0.0
    total_rain = sum(rainfall_series) if rainfall_series else 0.0
    rain_over = max_rain >= 5.0 or total_rain >= 15.0
    if rain_over:
        score += 12
    factors.append({
        "factor": "Lluvia sobre umbral preventivo",
        "points": 12 if rain_over else 0,
        "met": rain_over,
        "detail": f"Máximo {max_rain:.1f} mm/h · acumulado {total_rain:.1f} mm.",
    })

    max_depth_cm = float(hydro_run.summary.get("max_depth_cm") or 0.0)
    depth_over = max_depth_cm > 5.0
    if depth_over:
        score += 12
    factors.append({
        "factor": "Lámina máxima modelada > 5 cm",
        "points": 12 if depth_over else 0,
        "met": depth_over,
        "detail": f"Lámina pico registrada: {max_depth_cm:.1f} cm.",
    })

    max_persistence = max(
        (int(el.hours_with_water_above_threshold) for el in hydro_run.elements),
        default=0,
    )
    persistence_over = max_persistence >= 2
    if persistence_over:
        score += 8
    factors.append({
        "factor": "Persistencia hídrica ≥ 2 h",
        "points": 8 if persistence_over else 0,
        "met": persistence_over,
        "detail": f"Persistencia máxima modelada: {max_persistence} h.",
    })

    inflow_active = inflow_p4 != "ninguno"
    if inflow_active:
        score += 8
    factors.append({
        "factor": "Ingreso externo P4 activo",
        "points": 8 if inflow_active else 0,
        "met": inflow_active,
        "detail": f"Nivel de ingreso Puerta 4: {inflow_p4}.",
    })

    return min(95, score), factors


def _derive_cap_severity_from_hydro(
    hydro_summary: dict[str, Any],
    affected_gates: list[str],
    building_status: list[dict[str, Any]],
) -> tuple[str, str]:
    """Deriva severidad CAP (AMARILLO | NARANJA | ROJO) y nivel preventivo desde hydro.py."""
    max_depth = float(hydro_summary.get("max_depth_cm") or 0.0)
    crit_buildings = sum(1 for b in building_status if b.get("risk_level") == "critico")
    high_buildings = sum(1 for b in building_status if b.get("risk_level") == "alto")

    if max_depth >= 15.0 or crit_buildings >= 2 or (len(affected_gates) >= 2 and max_depth >= 10.0):
        return "ROJO", "PREPARACION_CRITICA"
    if max_depth >= 5.0 or crit_buildings >= 1 or high_buildings >= 2 or len(affected_gates) >= 1:
        return "NARANJA", "ATENCION_PREVENTIVA"
    return "AMARILLO", "VIGILANCIA_PREVENTIVA"


async def _dispatch_live_simulation_alert_if_ready() -> dict[str, Any] | None:
    """Emite de forma idempotente (bloqueo atómico SQLite) la alerta CAP 1.2 de la simulación en vivo."""
    claimed = claim_active_simulation_alert_dispatch()
    if claimed is None:
        return None

    result = claimed.get("result") or {}
    summary = result.get("summary") or {}
    building_status = result.get("building_status") or []
    affected_gates = result.get("affected_gates") or []
    top_buildings = result.get("top_affected_buildings") or [
        b["name"] for b in building_status if b.get("risk_level") in ("critico", "alto", "moderado")
    ][:3]

    max_depth_cm = float(summary.get("max_depth_cm") or 0.0)
    peak_hour = int(summary.get("peak_hour") or 1)
    hours_sim = int(summary.get("hours_simulated") or 12)
    confidence_pct = int(claimed.get("confidence_pct") or 70)
    scenario_label = claimed.get("scenario_label") or claimed.get("scenario_id") or "Simulación UNT"
    activated_by = claimed.get("activated_by_role") or "operador_riesgos"

    severity, level = _derive_cap_severity_from_hydro(summary, affected_gates, building_status)

    where_parts: list[str] = []
    if affected_gates:
        where_parts.append(f"Accesos comprometidos: {', '.join(affected_gates)}")
    if top_buildings:
        where_parts.append(f"Edificios/facultades críticas: {', '.join(top_buildings[:3])}")
    where_zone = " · ".join(where_parts) if where_parts else "Ciudad Universitaria UNT (zonas bajas)"

    win_end = min(hours_sim, peak_hour + 2)
    when_window = f"Ventana pico modelada: h+{peak_hour} a h+{win_end} (simulacro activo)"

    # Punto de encuentro seguro sugerido desde el edificio más afectado
    primary_mp = "el punto de encuentro seguro en cota alta más cercano"
    if building_status:
        mp_info = building_status[0].get("nearest_safe_meeting_point")
        if mp_info and mp_info.get("name"):
            primary_mp = f"{mp_info['name']} (~{mp_info.get('distance_m', 0)} m)"

    avoid_str = (
        f"Evita {', '.join(affected_gates)}"
        if affected_gates
        else "Evita vías y depresiones con agua acumulada"
    )
    what_happens = (
        f"Simulación en vivo ({scenario_label}): lámina máxima modelada de {max_depth_cm:.1f} cm "
        f"en campus UNT. Certeza modelada: {confidence_pct}%."
    )
    what_to_do = (
        f"{avoid_str}. Dirígete ordenadamente hacia {primary_mp} o aplica refugio vertical "
        f"en piso superior si el acceso de tu facultad presenta aniego."
    )

    alert = create_alert(
        level=level,
        severity=severity,
        target_profile="all",
        target_roles=["estudiante", "docente", "administrativo"],
        channel="campus_banner",
        title=f"[{severity}] {scenario_label} · Certeza {confidence_pct}%",
        message=what_to_do,
        what_happens=what_happens,
        where_zone=where_zone,
        when_window=when_window,
        what_to_do=what_to_do,
        issuer=f"Yaku Alert UNT — Validación Humana ({activated_by} · Simulacro en vivo)",
        affected_zones=[*affected_gates, *top_buildings[:3]] or ["Ciudad Universitaria UNT"],
        status="emitida",
        validated_by_role=activated_by,
    )
    mark_active_simulation_alert_dispatched(alert["id"])

    # Intento seguro de difusión WhatsApp Cloud API (con fallback silencioso si falla o está offline)
    if bool(result.get("send_whatsapp", True)):
        try:
            wa_cfg = get_whatsapp_channel_status()
            if wa_cfg.get("enabled"):
                dispatch = await send_cap_alert_whatsapp(
                    alert,
                    offline=bool(result.get("offline", False)),
                )
                updated = update_alert_whatsapp_status(
                    alert["id"],
                    _map_wa_dispatch_status(dispatch["status"]),
                    dispatch.get("first_message_id"),
                )
                if updated:
                    alert = updated
        except Exception:
            pass

    return alert


async def _delayed_auto_alert_dispatch(delay_sec: int, expected_started_at: str) -> None:
    """Tarea en segundo plano que espera delay_sec y dispara la alerta CAP automática."""
    try:
        if delay_sec > 0:
            await asyncio.sleep(delay_sec)
        current = get_active_simulation()
        if (
            current
            and current.get("active")
            and current.get("started_at") == expected_started_at
            and not current.get("alert_dispatched")
        ):
            await _dispatch_live_simulation_alert_if_ready()
    except asyncio.CancelledError:
        return
    except Exception:
        return


def _format_live_simulation_response(state: dict[str, Any] | None) -> dict[str, Any]:
    if not state or not state.get("active"):
        return {
            "active": False,
            "scenario_id": "",
            "scenario_label": "",
            "drainage_scenario": "base",
            "started_at": None,
            "elapsed_seconds": 0.0,
            "auto_alert_delay_sec": 10,
            "remaining_alert_seconds": 0,
            "alert_dispatched": False,
            "dispatched_alert_id": None,
            "dispatched_alert": None,
            "confidence_pct": 0,
            "confidence_factors": [],
            "activated_by_role": None,
            "current_sim_hour": 1,
            "summary": None,
            "parameters": None,
            "frames": [],
            "elements": [],
            "evaluation": None,
            "drainage_impact": None,
            "building_status": [],
            "affected_gates": [],
            "top_affected_buildings": [],
        }

    now = datetime.now(timezone.utc)
    started_at_raw = state.get("started_at")
    elapsed = 0.0
    if started_at_raw:
        try:
            started_dt = datetime.fromisoformat(str(started_at_raw).replace("Z", "+00:00"))
            if started_dt.tzinfo is None:
                started_dt = started_dt.replace(tzinfo=timezone.utc)
            elapsed = max(0.0, (now - started_dt).total_seconds())
        except ValueError:
            elapsed = 0.0

    delay_sec = int(state.get("auto_alert_delay_sec") or 10)
    remaining = max(0, int(round(delay_sec - elapsed))) if not state.get("alert_dispatched") else 0

    result = state.get("result") or {}
    summary = result.get("summary") or {}
    hours_sim = max(1, int(summary.get("hours_simulated") or len(result.get("frames") or []) or 1))
    peak_hour = int(summary.get("peak_hour") or 1)
    # Hora simulada acelerada: avanza 1 hora cada 2 segundos hasta llegar al horizonte (o pico si ya pasó)
    accel_hour = min(hours_sim, max(1, int(elapsed // 2) + 1))
    current_sim_hour = peak_hour if elapsed >= hours_sim * 2 else accel_hour

    dispatched_alert = None
    if state.get("dispatched_alert_id"):
        dispatched_alert = get_alert_by_id(int(state["dispatched_alert_id"]))

    return {
        "active": True,
        "scenario_id": state["scenario_id"],
        "scenario_label": state["scenario_label"],
        "drainage_scenario": state["drainage_scenario"],
        "started_at": state["started_at"],
        "elapsed_seconds": round(elapsed, 2),
        "auto_alert_delay_sec": delay_sec,
        "remaining_alert_seconds": remaining,
        "alert_dispatched": bool(state["alert_dispatched"]),
        "dispatched_alert_id": state.get("dispatched_alert_id"),
        "dispatched_alert": dispatched_alert,
        "confidence_pct": int(state.get("confidence_pct") or 0),
        "confidence_factors": state.get("confidence_factors") or [],
        "activated_by_role": state.get("activated_by_role"),
        "current_sim_hour": current_sim_hour,
        "summary": summary,
        "parameters": result.get("parameters"),
        "frames": result.get("frames") or [],
        "elements": result.get("elements") or [],
        "evaluation": result.get("evaluation"),
        "drainage_impact": result.get("drainage_impact"),
        "building_status": result.get("building_status") or [],
        "affected_gates": result.get("affected_gates") or [],
        "top_affected_buildings": result.get("top_affected_buildings") or [],
    }


@app.post("/api/simulation/live/activate")
async def activate_live_simulation(payload: ActivateLiveSimulationRequest) -> dict:
    """Activa una simulación en vivo desde Gestión UNT visible para Comunidad UNT con alerta CAP automática."""
    global _live_auto_alert_task

    presets_resp = list_presets()
    preset = next((p for p in presets_resp.presets if p.id == payload.scenario_id), None)
    defaults = preset.defaults if preset else {}

    if payload.rainfall_mm_h and len(payload.rainfall_mm_h) > 0:
        rainfall_series = [max(0.0, min(200.0, float(v))) for v in payload.rainfall_mm_h]
    elif preset is not None:
        rainfall_series = list(preset.rainfall_mm_h)
    else:
        fallback = presets_resp.presets[0]
        rainfall_series = list(fallback.rainfall_mm_h)

    if payload.duration_hours is not None:
        if len(rainfall_series) > payload.duration_hours:
            rainfall_series = rainfall_series[: payload.duration_hours]
        elif len(rainfall_series) < payload.duration_hours:
            rainfall_series = rainfall_series + [0.0] * (payload.duration_hours - len(rainfall_series))

    inflow_p4 = payload.inflow_p4 or defaults.get("inflow_p4", "medio")
    secondary_inflow = (
        payload.secondary_inflow
        if payload.secondary_inflow is not None
        else bool(defaults.get("secondary_inflow", False))
    )
    drainage_state = payload.drainage_state or defaults.get("drainage_state", "normal")
    scenario_label = payload.scenario_label or (preset.label if preset else payload.scenario_id)

    try:
        hydro_run = _with_hydro_evaluation(
            run_hydro_simulation(
                rainfall_series,
                drainage_state=drainage_state,
                inflow_p4=inflow_p4,
                secondary_inflow=secondary_inflow,
                use_reported_sinks=payload.use_reported_sinks,
                drainage_scenario=payload.drainage_scenario,
                data_nature="SIMULACION_EN_VIVO_GESTION_UNT",
                source=f"Simulación en vivo: {scenario_label}",
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    campus_geojson = load_campus_geojson()
    evacuation_geojson = load_evacuation_geojson()
    building_status = build_building_recommendations(hydro_run, campus_geojson, evacuation_geojson)

    confidence_pct, confidence_factors = _compute_simulation_confidence(
        hydro_run, rainfall_series, inflow_p4
    )

    import re as _re

    affected_gates: list[str] = []
    for el in hydro_run.elements:
        if el.category == "acceso" and el.max_depth_cm >= 2.0:
            m = _re.search(r"\bPuerta\s*([1-4])\b", el.name, _re.IGNORECASE)
            if m:
                gname = f"Puerta {m.group(1)}"
                if gname not in affected_gates:
                    affected_gates.append(gname)

    top_affected_buildings = [
        b["name"]
        for b in building_status
        if b["risk_level"] in ("critico", "alto", "moderado")
    ][:3]

    hydro_dump = hydro_run.model_dump()
    compact_result = {
        "run_id": hydro_dump["run_id"],
        "summary": hydro_dump["summary"],
        "parameters": hydro_dump["parameters"],
        "frames": hydro_dump["frames"],
        "elements": hydro_dump["elements"],
        "evaluation": hydro_dump["evaluation"],
        "drainage_impact": hydro_dump.get("drainage_impact"),
        "building_status": building_status,
        "affected_gates": affected_gates,
        "top_affected_buildings": top_affected_buildings,
        "send_whatsapp": payload.send_whatsapp,
        "offline": payload.offline,
    }

    started_at = datetime.now(timezone.utc).isoformat()
    state = save_active_simulation(
        scenario_id=payload.scenario_id,
        scenario_label=scenario_label,
        drainage_scenario=payload.drainage_scenario,
        params={
            "rainfall_mm_h": rainfall_series,
            "duration_hours": len(rainfall_series),
            "inflow_p4": inflow_p4,
            "drainage_state": drainage_state,
            "drainage_scenario": payload.drainage_scenario,
            "secondary_inflow": secondary_inflow,
            "use_reported_sinks": payload.use_reported_sinks,
            "send_whatsapp": payload.send_whatsapp,
        },
        started_at=started_at,
        auto_alert_delay_sec=payload.auto_alert_delay_sec,
        confidence_pct=confidence_pct,
        confidence_factors=confidence_factors,
        activated_by_role=payload.activated_by_role,
        result=compact_result,
    )

    record_simulation_run(
        scenario_name=f"[EN VIVO] {scenario_label}",
        params=state["params"],
        peak_hour=int(hydro_run.summary.get("peak_hour") or 1),
        max_depth_cm=float(hydro_run.summary.get("max_depth_cm") or 0.0),
        affected_gates=affected_gates,
        affected_buildings_count=sum(
            1 for b in building_status if b["risk_level"] in ("critico", "alto")
        ),
        executed_by_role=payload.activated_by_role,
    )

    if _live_auto_alert_task is not None and not _live_auto_alert_task.done():
        _live_auto_alert_task.cancel()

    if payload.auto_alert_delay_sec == 0:
        await _dispatch_live_simulation_alert_if_ready()
        state = get_active_simulation()
    else:
        try:
            _live_auto_alert_task = asyncio.create_task(
                _delayed_auto_alert_dispatch(payload.auto_alert_delay_sec, started_at)
            )
        except RuntimeError:
            pass

    return _format_live_simulation_response(state)


@app.get("/api/simulation/live")
async def get_live_simulation() -> dict:
    """Devuelve el estado de la simulación en vivo y garantiza disparo idempotente de alerta CAP."""
    state = get_active_simulation()
    if state and state.get("active") and not state.get("alert_dispatched"):
        started_raw = state.get("started_at")
        delay_sec = int(state.get("auto_alert_delay_sec") or 10)
        elapsed = 0.0
        if started_raw:
            try:
                started_dt = datetime.fromisoformat(str(started_raw).replace("Z", "+00:00"))
                if started_dt.tzinfo is None:
                    started_dt = started_dt.replace(tzinfo=timezone.utc)
                elapsed = max(0.0, (datetime.now(timezone.utc) - started_dt).total_seconds())
            except ValueError:
                elapsed = 0.0
        if elapsed >= delay_sec:
            await _dispatch_live_simulation_alert_if_ready()
            state = get_active_simulation()

    return _format_live_simulation_response(state)


@app.post("/api/simulation/live/stop")
def stop_live_simulation() -> dict:
    """Desactiva la simulación en vivo y devuelve a Comunidad UNT al pronóstico normal."""
    global _live_auto_alert_task
    if _live_auto_alert_task is not None and not _live_auto_alert_task.done():
        _live_auto_alert_task.cancel()
        _live_auto_alert_task = None
    state = stop_active_simulation()
    resp = _format_live_simulation_response(state)
    resp["stopped"] = True
    return resp


@app.get("/api/campus/building-status")
async def get_campus_building_status(
    offline: bool = Query(default=False, description="Forzar caché local si usa pronóstico"),
) -> dict:
    """Estado dinámico y recomendaciones por edificio y rol (usa simulación en vivo o pronóstico actual)."""
    state = get_active_simulation()
    if state and state.get("active"):
        result = state.get("result") or {}
        buildings = result.get("building_status") or []
        summary = result.get("summary") or {}
        return {
            "source": "live_simulation",
            "active_simulation": True,
            "scenario_id": state.get("scenario_id"),
            "scenario_label": state.get("scenario_label"),
            "peak_hour": summary.get("peak_hour"),
            "max_depth_cm": summary.get("max_depth_cm"),
            "affected_gates": result.get("affected_gates") or [],
            "buildings": buildings,
            "total_buildings": len(buildings),
        }

    weather = await fetch_weather_for_unt(force_offline=offline)
    series = [0.0] * 48
    for idx, point in enumerate(weather.hourly[:48]):
        series[idx] = max(0.0, round(float(point.precipitation_mm), 4))

    hydro_run = _with_hydro_evaluation(
        run_hydro_simulation(
            series,
            drainage_state="normal",
            inflow_p4="ninguno",
            secondary_inflow=False,
            use_reported_sinks=False,
            drainage_scenario="base",
            data_nature=f"SIMULACION_CON_PRONOSTICO_HORARIO_{weather.data_status}",
            source=f"pronóstico horario de {weather.source_name}",
            weather=weather.model_dump(),
        )
    )
    buildings = build_building_recommendations(
        hydro_run, load_campus_geojson(), load_evacuation_geojson()
    )
    return {
        "source": "forecast",
        "active_simulation": False,
        "scenario_id": "forecast_48h",
        "scenario_label": f"Pronóstico 48 h ({weather.data_status})",
        "peak_hour": hydro_run.summary.get("peak_hour"),
        "max_depth_cm": hydro_run.summary.get("max_depth_cm"),
        "affected_gates": [],
        "buildings": buildings,
        "total_buildings": len(buildings),
    }
