from app.models import SimulationRequest, SimulationResponse
from app.services.preventive_engine import evaluate_preventive_rules
from app.services.spatial import analyze_spatial_exposure

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


def run_offline_simulation(req: SimulationRequest) -> SimulationResponse:
    """
    Ejecuta una simulación determinista 100% offline combinando parámetros
    de lluvia, análisis espacial Shapely y motor preventivo explicable.

    La lluvia y la duración solo alimentan las reglas preventivas: NO modifican
    la geometría de la zona (A: relieve DEM; B: zonas reportadas; C: combinación).
    No se modelan canaletas ni drenaje.
    """
    if req.scenario_id != "personalizado" and req.scenario_id in PRESET_SCENARIOS:
        preset = PRESET_SCENARIOS[req.scenario_id]
        effective_req = SimulationRequest(
            scenario_id=req.scenario_id,
            intensity_mm_h=preset["intensity_mm_h"],
            duration_hours=preset["duration_hours"],
            drainage_obstructed=preset["drainage_obstructed"],
            antecedent_soil_saturated=preset["antecedent_soil_saturated"],
            hazard_zone_id=preset["hazard_zone_id"],
        )
    else:
        effective_req = req

    accumulated = round(effective_req.intensity_mm_h * effective_req.duration_hours * 0.75, 2)
    spatial_result, hazard_feature = analyze_spatial_exposure(effective_req.hazard_zone_id)

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
        spatial_analysis=spatial_result,
        preventive_evaluation=evaluation,
        hazard_geojson=hazard_feature,
    )
