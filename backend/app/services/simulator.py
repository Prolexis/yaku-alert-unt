import json

from app.config import DATA_DIR
from app.models import SimulationRequest, SimulationResponse
from app.services.preventive_engine import evaluate_preventive_rules
from app.services.spatial import SYNTH_REACH_M, analyze_spatial_exposure

EVENTS_REFERENCE_PATH = DATA_DIR / "eventos_referencia.json"
RAINFALL_SOURCE = (
    "Open-Meteo Historical Weather API, reanálisis; aproxima pero no reemplaza "
    "estaciones SENAMHI"
)

PRESET_SCENARIOS: dict[str, dict] = {
    "lluvia_moderada": {
        "intensity_mm_h": 12.0,
        "duration_hours": 3,
        "drainage_obstructed": False,
        "antecedent_soil_saturated": False,
        "hazard_zone_id": "lluvia_moderada",
    },
    "lluvia_intensa_fen": {
        "intensity_mm_h": 28.0,
        "duration_hours": 4,
        "drainage_obstructed": True,
        "antecedent_soil_saturated": False,
        "hazard_zone_id": "lluvia_intensa_fen",
    },
    "escenario_extremo_fen": {
        "intensity_mm_h": 45.0,
        "duration_hours": 6,
        "drainage_obstructed": True,
        "antecedent_soil_saturated": True,
        "hazard_zone_id": "escenario_extremo_fen",
    },
}


def _historical_presets() -> tuple[dict[str, dict], dict[str, dict]] | None:
    if not EVENTS_REFERENCE_PATH.exists():
        return None
    data = json.loads(EVENTS_REFERENCE_PATH.read_text(encoding="utf-8"))
    events = data.get("events", [])
    if not data.get("historical_values_available") or len(events) != 3:
        return None
    if any(
        event.get("max_rolling_24h_mm") is None
        or event.get("max_hourly_mm_h") is None
        or event.get("hours_ge_0_1mm") is None
        for event in events
    ):
        return None

    ordered = sorted(events, key=lambda event: event["max_rolling_24h_mm"])
    scenarios = ("lluvia_moderada", "lluvia_intensa_fen", "escenario_extremo_fen")
    presets = {}
    references = {}
    for scenario_id, event in zip(scenarios, ordered):
        baseline = PRESET_SCENARIOS[scenario_id]
        presets[scenario_id] = {
            **baseline,
            "intensity_mm_h": event["max_hourly_mm_h"],
            "duration_hours": max(1, min(24, int(event["hours_ge_0_1mm"]))),
        }
        near_zero = (
            event["max_hourly_mm_h"] <= 0.1
            or event["max_rolling_24h_mm"] <= 0.1
        )
        references[scenario_id] = {
            "source": data.get("source", RAINFALL_SOURCE),
            "event_id": event["id"],
            "label": event["label"],
            "start_date": event["start_date"],
            "end_date": event["end_date"],
            "max_hourly_mm_h": event["max_hourly_mm_h"],
            "max_rolling_24h_mm": event["max_rolling_24h_mm"],
            "hours_ge_0_1mm": event["hours_ge_0_1mm"],
            "is_historical_reanalysis": True,
            "reanalysis_near_zero": near_zero,
            "note": (
                "El reanálisis puede subestimar eventos locales; se muestra el valor tal cual. "
                "Los supuestos antiguos se conservan solo como demostración."
                if near_zero else data.get("limitation")
            ),
            "demo_assumption_mm_h": baseline["intensity_mm_h"],
        }
    return presets, references


def run_offline_simulation(req: SimulationRequest) -> SimulationResponse:
    """
    Ejecuta una simulación determinista 100% offline combinando parámetros
    de lluvia, análisis espacial Shapely y motor preventivo explicable.

    La lluvia y la duración solo alimentan las reglas preventivas: NO modifican
    la geometría de la zona (A: relieve DEM; B: zonas reportadas; C: combinación).
    No se modelan canaletas ni drenaje.
    """
    historical = _historical_presets()
    presets, references = historical if historical else (PRESET_SCENARIOS, {})
    rainfall_reference = None
    if req.scenario_id != "personalizado" and req.scenario_id in presets:
        preset = presets[req.scenario_id]
        default_reach = SYNTH_REACH_M.get(req.hazard_zone_id)
        effective_reach = req.synthetic_reach_m if default_reach is not None else None
        if default_reach is not None and effective_reach is None:
            effective_reach = default_reach
        effective_req = SimulationRequest(
            scenario_id=req.scenario_id,
            intensity_mm_h=preset["intensity_mm_h"],
            duration_hours=preset["duration_hours"],
            drainage_obstructed=preset["drainage_obstructed"],
            antecedent_soil_saturated=preset["antecedent_soil_saturated"],
            hazard_zone_id=preset["hazard_zone_id"],
            synthetic_reach_m=effective_reach,
        )
        rainfall_reference = references.get(req.scenario_id)
        if rainfall_reference is None:
            rainfall_reference = {
                "source": "Supuesto de demostración previo; no es una observación histórica",
                "label": "supuesto de demostración",
                "max_hourly_mm_h": preset["intensity_mm_h"],
                "is_historical_reanalysis": False,
                "note": "Se conservan los valores previos de demostración porque no hay tres "
                        "eventos históricos disponibles para calibrar.",
                "demo_assumption_mm_h": preset["intensity_mm_h"],
            }
    else:
        effective_reach = (
            req.synthetic_reach_m
            if req.synthetic_reach_m is not None
            else SYNTH_REACH_M.get(req.hazard_zone_id)
        )
        effective_req = req.model_copy(update={"synthetic_reach_m": effective_reach})

    if rainfall_reference and rainfall_reference["is_historical_reanalysis"]:
        accumulated = rainfall_reference["max_rolling_24h_mm"]
    else:
        accumulated = round(effective_req.intensity_mm_h * effective_req.duration_hours * 0.75, 2)
    spatial_result, hazard_feature, synthetic_geojson = analyze_spatial_exposure(
        effective_req.hazard_zone_id, effective_req.synthetic_reach_m
    )
    effective_reach = (
        spatial_result.synthetic_exposure.reach_m
        if spatial_result.synthetic_exposure else None
    )

    evaluation = evaluate_preventive_rules(
        max_intensity_mm_h=effective_req.intensity_mm_h,
        accumulated_mm=accumulated,
        duration_hours=effective_req.duration_hours,
        drainage_obstructed=effective_req.drainage_obstructed,
        antecedent_soil_saturated=effective_req.antecedent_soil_saturated,
        spatial=spatial_result,
        is_synthetic=True,
        weather_meta=None,
    )

    sim_id = (
        f"SIM-{effective_req.scenario_id.upper()}-"
        f"{int(effective_req.intensity_mm_h)}MMH-{effective_req.duration_hours}H"
    )

    return SimulationResponse(
        simulation_id=sim_id,
        is_synthetic=True,
        data_nature="ESCENARIO_SIMULADO_SINTETICO",
        parameters=effective_req,
        simulated_accumulated_mm=accumulated,
        synthetic_reach_m_effective=effective_reach,
        rainfall_reference=rainfall_reference,
        spatial_analysis=spatial_result,
        preventive_evaluation=evaluation,
        hazard_geojson=hazard_feature,
        synthetic_geojson=synthetic_geojson,
    )
