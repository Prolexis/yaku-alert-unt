"""Pruebas del motor de agua (capa nueva, Fase 1).

Cubre lo exigido: conservación de masa, ausencia de agua sin lluvia ni ingreso,
monotonicidad del flujo desde la Puerta 4 hacia el suroeste, ausencia de agua
sobre edificios, determinismo, validación 422 y frases prohibidas en las
respuestas de los tres endpoints nuevos.
"""
import math
import re

import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.models import HydroElementImpact, HydroRunResponse
from app.services.hydro import (
    _triangular_hydrograph,
    load_hydro_params,
    load_terrain_grid,
    simulate_core,
)
from app.services.preventive_engine import evaluate_hydro_rules

client = TestClient(app)

AZIMUT_P4_DEG = 203.0  # descenso principal del campus (derivado del DEM)


def _p4_projection(depth: np.ndarray) -> np.ndarray:
    """Desplazamiento de las celdas mojadas respecto a P4 en el azimut 203° (m)."""
    grid = load_terrain_grid()
    p4_cells = grid.inlets["p4"]
    rows_idx, cols_idx = np.divmod(p4_cells, grid.nx)
    pr, pc = float(rows_idx.mean()), float(cols_idx.mean())
    rows, cols = np.nonzero(depth >= 0.02)
    dx = (cols - pc) * grid.cell_size_m          # este positivo
    dy = -(rows - pr) * grid.cell_size_m         # norte positivo
    az = math.radians(AZIMUT_P4_DEG)
    return dx * math.sin(az) + dy * math.cos(az)


def _p4_only_run(inflow_p4: str = "alto"):
    """Corrida de 48 h SIN lluvia: todo el agua viene de la Puerta 4."""
    return simulate_core([0.0] * 48, drainage_state="normal", inflow_p4=inflow_p4)


def test_p4_hydrograph_is_triangular_and_starts_at_rainfall_peak():
    hydrograph = _triangular_hydrograph(
        total_volume_m3=2800.0,
        duration_h=4,
        start_hour_index=2,
        hours=8,
    )
    assert np.allclose(hydrograph, [0.0, 0.0, 350.0, 1050.0, 1050.0, 350.0, 0.0, 0.0])
    assert float(hydrograph.sum()) == 2800.0

    rainfall = [0.0, 5.0, 20.0, 5.0] + [0.0] * 44
    response, _ = simulate_core(
        rainfall,
        drainage_state="normal",
        inflow_p4="alto",
    )
    no_inflow, _ = simulate_core(
        rainfall,
        drainage_state="normal",
        inflow_p4="ninguno",
    )
    assert response.frames[0].wet_area_m2 == no_inflow.frames[0].wet_area_m2
    assert response.frames[1].wet_area_m2 == no_inflow.frames[1].wet_area_m2
    assert response.frames[2].wet_area_m2 > no_inflow.frames[2].wet_area_m2
    assert response.parameters["inflow_p4_m3_h_total"] == 1050.0
    assert response.summary["mass_balance_m3"]["entrada_ingreso"] == 2800.0


def _hydro_rule_run(elements, inflow_p4="ninguno"):
    return HydroRunResponse(
        run_id="HYDRO-TEST",
        data_nature="SIMULACION_EXPLORATORIA_SIMPLIFICADA",
        parameters={"inflow_p4": inflow_p4},
        frames=[],
        elements=elements,
        summary={},
        metadata={"source": "escenario de prueba"},
        assumptions=[],
        limitations=[],
        avisos=[],
    )


def _impact(
    name="Puerta 1 (Av. UNT)",
    category="acceso",
    max_depth_cm=0.0,
    first_hour_affected=None,
    first_hour_depth_cm=None,
    hours_with_water_above_threshold=0,
):
    return HydroElementImpact(
        id=name,
        name=name,
        category=category,
        scope="huella",
        max_depth_cm=max_depth_cm,
        first_hour_affected=first_hour_affected,
        first_hour_depth_cm=first_hour_depth_cm,
        hours_with_water_above_threshold=hours_with_water_above_threshold,
    )


def test_r_hid_01_activates_at_access_depth_threshold_only():
    threshold = load_hydro_params()["reglas_preventivas_hidro"]["R-HID-01"]["depth_cm"]["value"]
    at_threshold = evaluate_hydro_rules(
        _hydro_rule_run([_impact(max_depth_cm=threshold)])
    )
    below_threshold = evaluate_hydro_rules(
        _hydro_rule_run([_impact(max_depth_cm=threshold - 0.1)])
    )
    assert "R-HID-01" in {rule.rule_id for rule in at_threshold}
    assert "R-HID-01" not in {rule.rule_id for rule in below_threshold}


def test_r_hid_02_activates_when_first_affected_hour_is_recorded():
    threshold = load_hydro_params()["reglas_preventivas_hidro"]["R-HID-02"]["first_hour"]["value"]
    triggered = evaluate_hydro_rules(
        _hydro_rule_run([
            _impact(first_hour_affected=threshold, first_hour_depth_cm=1.0)
        ])
    )
    not_triggered = evaluate_hydro_rules(_hydro_rule_run([_impact()]))
    assert "R-HID-02" in {rule.rule_id for rule in triggered}
    assert "R-HID-02" not in {rule.rule_id for rule in not_triggered}


def test_r_hid_03_activates_at_persistence_hours_threshold():
    threshold = load_hydro_params()["reglas_preventivas_hidro"]["R-HID-03"]["hours"]["value"]
    at_threshold = evaluate_hydro_rules(
        _hydro_rule_run([
            _impact(
                category="edificio",
                hours_with_water_above_threshold=threshold,
            )
        ])
    )
    below_threshold = evaluate_hydro_rules(
        _hydro_rule_run([
            _impact(
                category="edificio",
                hours_with_water_above_threshold=threshold - 1,
            )
        ])
    )
    assert "R-HID-03" in {rule.rule_id for rule in at_threshold}
    assert "R-HID-03" not in {rule.rule_id for rule in below_threshold}


def test_r_hid_04_activates_only_for_nonzero_p4_scenario():
    active = evaluate_hydro_rules(_hydro_rule_run([], inflow_p4="medio"))
    inactive = evaluate_hydro_rules(_hydro_rule_run([], inflow_p4="ninguno"))
    assert "R-HID-04" in {rule.rule_id for rule in active}
    assert "R-HID-04" not in {rule.rule_id for rule in inactive}


def test_hydro_evaluate_returns_complete_sheet_for_2023_event_and_medium_p4():
    preset = next(
        item for item in client.get("/api/hydro/presets").json()["presets"]
        if item["id"] == "evento_2023_03_10"
    )
    response = client.post("/api/hydro/evaluate", json={
        "rainfall_mm_h": preset["rainfall_mm_h"],
        "drainage_state": preset["defaults"]["drainage_state"],
        "inflow_p4": "medio",
        "secondary_inflow": False,
    })
    assert response.status_code == 200, response.text
    data = response.json()
    sheet = data["evaluation"]
    assert set(sheet) == {
        "what", "where", "when", "what_to_do", "who_informs", "rules_triggered",
        "action_windows", "sources", "updated_at_utc", "uncertainty", "notice",
    }
    assert sheet["sources"] and sheet["updated_at_utc"] and sheet["uncertainty"]
    assert "orientación experimental" in sheet["notice"]
    assert "R-HID-04" in {rule["rule_id"] for rule in sheet["rules_triggered"]}
    assert all(
        window["affected_elements"] and window["recommendation"]
        for window in sheet["action_windows"]
    )
    assert all(
        "umbral no validado" in rule["threshold_note"]
        for rule in sheet["rules_triggered"]
    )


# --- 1. conservación de masa ---------------------------------------------------
def test_hydro_mass_balance_conserves_water():
    series = [0.0, 0.0, 4.0, 9.0, 7.0, 3.0] + [0.0] * 42
    resp, _ = simulate_core(series, drainage_state="obstruido",
                            inflow_p4="medio", secondary_inflow=True)
    mb = resp.summary["mass_balance_m3"]
    entrada = mb["entrada_lluvia"] + mb["entrada_ingreso"]
    salida = (
        mb["perdida_almacenamiento_inicial"]
        + mb["salida_infiltracion"]
        + mb["salida_drenaje"]
        + mb["salida_borde"]
        + mb["perdida_tejados_sin_vecino"]
    )
    assert abs(entrada - salida - mb["almacenada"]) < 0.01
    assert abs(mb["residual"]) < 0.01
    assert entrada > 0.0  # la prueba tiene sentido solo si entró agua


def test_hydro_surface_losses_are_reported_and_conserve_mass():
    response, _ = simulate_core(
        [0.0, 10.0, 20.0, 5.0] + [0.0] * 44,
        drainage_state="normal",
        inflow_p4="ninguno",
    )
    balance = response.summary["mass_balance_m3"]
    assert balance["perdida_almacenamiento_inicial"] > 0.0
    assert balance["salida_infiltracion"] > 0.0
    assert balance["salida_drenaje"] > 0.0
    assert abs(balance["residual"]) < 0.01


# --- 2. sin lluvia ni ingreso -> sin agua --------------------------------------
def test_hydro_no_rain_and_no_inflow_means_no_water():
    resp, depth = simulate_core([0.0] * 48, drainage_state="normal",
                                inflow_p4="ninguno")
    assert float(depth.max()) == 0.0
    assert resp.summary["final_wet_area_m2"] == 0.0
    assert resp.summary["max_depth_cm"] == 0.0
    mb = resp.summary["mass_balance_m3"]
    assert mb["entrada_lluvia"] == 0.0 and mb["entrada_ingreso"] == 0.0


def test_hydro_never_retains_water_outside_campus_perimeter():
    grid = load_terrain_grid()
    hourly = []
    _, depth = simulate_core(
        [0.0, 0.0, 8.0, 15.0, 4.0] + [0.0] * 43,
        drainage_state="pendiente_deficiente",
        inflow_p4="alto",
        secondary_inflow=True,
        grid=grid,
        hourly_out=hourly,
    )
    from app.services.hydro import load_hydro_params
    outside = ~grid.campus_mask
    radius = int(load_hydro_params()["radio_exclusion_salida_p4_celdas"]["value"])
    near_p4 = np.zeros_like(outside)
    for cell in grid.inlets["p4"]:
        r, c = divmod(int(cell), grid.nx)
        near_p4[max(0, r - radius):r + radius + 1, max(0, c - radius):c + radius + 1] = True
    assert not np.any(depth[outside & ~near_p4] > 0.0)
    assert all(not np.any(frame[outside & ~near_p4] > 0.0) for frame in hourly)


# --- 3. monotonicidad: el agua de P4 baja hacia el suroeste --------------------
def test_hydro_flow_moves_downslope_from_p4_to_southwest():
    _, depth = _p4_only_run()
    proj = _p4_projection(depth)
    assert proj.size > 0, "el ingreso de P4 no generó agua"
    # el agua se desplaza cuesta abajo en el azimut 203° (sur-suroeste)
    assert float(proj.mean()) > 0.0
    assert float(proj.max()) >= 50.0


# --- 4. P4 -> SU sin cruzar edificios -----------------------------------------
def test_hydro_p4_reaches_southwest_without_crossing_buildings():
    _, depth = _p4_only_run()
    grid = load_terrain_grid()

    # las celdas de edificio (bloqueadas) nunca reciben agua
    assert float(depth[grid.blocked].max()) == 0.0

    # hay agua en el cuadrante sur-oeste respecto a P4 (más filas, menos columnas)
    p4_cells = grid.inlets["p4"]
    rows_idx, cols_idx = np.divmod(p4_cells, grid.nx)
    pr, pc = int(rows_idx.mean()), int(cols_idx.mean())
    rows, cols = np.nonzero(depth >= 0.02)
    southwest = (rows > pr) & (cols < pc)
    assert int(southwest.sum()) >= 10, "el agua no avanzó hacia el sur-oeste de P4"
    # y salió de las propias celdas de ingreso
    assert int((depth >= 0.02).sum()) > p4_cells.size


# --- 5. determinismo -----------------------------------------------------------
def test_hydro_run_is_deterministic():
    series = [0.0, 5.0, 12.0, 6.0] + [0.0] * 44
    first, depth_a = simulate_core(series, drainage_state="normal",
                                   inflow_p4="medio", secondary_inflow=True)
    second, depth_b = simulate_core(series, drainage_state="normal",
                                    inflow_p4="medio", secondary_inflow=True)
    assert first.run_id == second.run_id
    assert first.model_dump() == second.model_dump()
    assert np.array_equal(depth_a, depth_b)


# --- 422 con entradas inválidas ------------------------------------------------
def test_hydro_run_rejects_invalid_payloads_with_422():
    bad_payloads = [
        {"rainfall_mm_h": []},                       # sin serie
        {"rainfall_mm_h": [-1.0]},                   # lluvia negativa
        {"rainfall_mm_h": [0.0] * 49},               # más de 48 h
        {"rainfall_mm_h": [250.0]},                  # fuera del rango (le=200)
        {"rainfall_mm_h": [0.0], "drainage_state": "inventado"},
        {"rainfall_mm_h": [0.0], "inflow_p4": "gigante"},
    ]
    for payload in bad_payloads:
        resp = client.post("/api/hydro/run", json=payload)
        assert resp.status_code == 422, payload


# --- tope de relleno de microdepresiones --------------------------------------
def test_priority_flood_fill_respects_max_rise():
    import sys
    from pathlib import Path

    scripts = Path(__file__).resolve().parents[2] / "scripts"
    sys.path.insert(0, str(scripts))
    from build_terrain_grid import _priority_flood_fill

    elevation = np.array([
        [10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0],
        [10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0],
        [10.0, 10.0, 9.0, 9.0, 9.0, 10.0, 10.0],
        [10.0, 10.0, 9.0, 7.0, 9.0, 10.0, 10.0],
        [10.0, 10.0, 9.0, 9.0, 9.0, 10.0, 10.0],
        [10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0],
        [10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0],
    ])
    blocked = np.zeros_like(elevation, dtype=bool)

    full = _priority_flood_fill(elevation, blocked, None)
    capped = _priority_flood_fill(elevation, blocked, 0.5)

    # solo se suben celdas, nunca se baja el relieve
    assert (full >= elevation).all()
    assert (capped >= elevation).all()
    # el tope se respeta celda por celda
    assert float((capped - elevation).max()) <= 0.5 + 1e-9
    # sin tope el pozo central se rellena más que con tope
    assert float((full - elevation).max()) > 0.5


# --- sumideros locales reportados (opcionales) --------------------------------
def test_reported_sinks_add_local_storage_and_conserve_mass():
    grid = load_terrain_grid()
    sink_zone_ids = ("rep_estac_cidunt", "rep_estac_derecho", "rep_puerta4",
                     "rep_av_juan_pablo")
    sink_cells = np.concatenate([
        grid.reported_zones[zid]["cells"] for zid in sink_zone_ids
        if zid in grid.reported_zones and grid.reported_zones[zid]["cells"].size
    ])
    assert sink_cells.size > 0

    off, depth_off = simulate_core([0.0] * 48, inflow_p4="alto",
                                   use_reported_sinks=False)
    on, depth_on = simulate_core([0.0] * 48, inflow_p4="alto",
                                 use_reported_sinks=True)

    # el agua se queda almacenada en las celdas reportadas
    assert float(depth_on.ravel()[sink_cells].sum()) > float(depth_off.ravel()[sink_cells].sum())

    # la masa se conserva en ambos casos
    for resp in (off, on):
        mb = resp.summary["mass_balance_m3"]
        assert abs(mb["residual"]) < 0.01
        assert abs(mb["residual_pct"]) < 1e-4

    # el estado de los sumideros queda declarado en supuestos y parámetros
    assert any("ACTIVOS" in text for text in on.assumptions)
    assert any("DESACTIVADOS" in text for text in off.assumptions)
    assert on.parameters["use_reported_sinks"] is True
    assert off.parameters["use_reported_sinks"] is False
    assert on.parameters["reported_sinks"]


# --- escenarios paramétricos de alcantarillado y canaletas nuevas UNT ---------
def test_drainage_scenarios_physical_monotonicity_on_yaku_2023():
    """Para un mismo evento (evento_2023_03_10), obstruido >= base >= canaletas_nuevas."""
    from app.services.hydro import list_presets

    presets = {p.id: p for p in list_presets().presets}
    yaku = presets["evento_2023_03_10"]

    res_obs = client.post(
        "/api/hydro/run",
        json={
            "rainfall_mm_h": yaku.rainfall_mm_h,
            "drainage_state": "normal",
            "drainage_scenario": "obstruido",
            "inflow_p4": "alto",
        },
    )
    res_base = client.post(
        "/api/hydro/run",
        json={
            "rainfall_mm_h": yaku.rainfall_mm_h,
            "drainage_state": "normal",
            "drainage_scenario": "base",
            "inflow_p4": "alto",
        },
    )
    res_new = client.post(
        "/api/hydro/run",
        json={
            "rainfall_mm_h": yaku.rainfall_mm_h,
            "drainage_state": "normal",
            "drainage_scenario": "canaletas_nuevas",
            "inflow_p4": "alto",
        },
    )

    assert res_obs.status_code == 200
    assert res_base.status_code == 200
    assert res_new.status_code == 200

    d_obs = res_obs.json()
    d_base = res_base.json()
    d_new = res_new.json()

    # Monotonicidad física en profundidad máxima y área húmeda pico
    assert d_obs["summary"]["max_depth_cm"] >= d_base["summary"]["max_depth_cm"]
    assert d_base["summary"]["max_depth_cm"] >= d_new["summary"]["max_depth_cm"]
    assert d_obs["summary"]["peak_wet_area_m2"] >= d_base["summary"]["peak_wet_area_m2"]
    assert d_base["summary"]["peak_wet_area_m2"] >= d_new["summary"]["peak_wet_area_m2"]

    # Metadatos y deltas transparentes en drainage_impact
    for payload in (d_obs, d_base, d_new):
        imp = payload["drainage_impact"]
        assert imp["is_hypothetical"] is True
        assert "as-built" in imp["assumption_note"]

    assert d_obs["drainage_impact"]["delta_max_depth_cm"] >= 0.0
    assert d_new["drainage_impact"]["delta_max_depth_cm"] <= 0.0
    assert d_new["drainage_impact"]["delta_affected_area_pct"] <= 0.0


# --- frases prohibidas + campos obligatorios en las 3 respuestas ---------------
def test_hydro_responses_never_use_prohibited_phrases():

    payload = {
        "rainfall_mm_h": [0.0, 3.0, 8.0, 4.0] + [0.0] * 44,
        "drainage_state": "normal",
        "inflow_p4": "medio",
        "secondary_inflow": False,
    }
    run = client.post("/api/hydro/run", json=payload)
    evaluated = client.post("/api/hydro/evaluate", json=payload)
    presets = client.get("/api/hydro/presets")
    forecast = client.get("/api/hydro/forecast?offline=true")
    assert run.status_code == 200, run.text
    assert evaluated.status_code == 200, evaluated.text
    assert presets.status_code == 200, presets.text
    assert forecast.status_code == 200, forecast.text

    prohibited = (
        "probabilidad de huaico",
        "predicción",
        "prediccion",
        "hidrodinámico validado",
        "hidrodinamico validado",
    )
    word_prohibited = re.compile(r"\b(segur[oa]s?|peligros[oa]s?)\b", re.IGNORECASE)

    for resp in (run, evaluated, presets, forecast):
        text = resp.text.lower()
        for phrase in prohibited:
            assert phrase not in text, f"frase prohibida '{phrase}' en {resp.request.url}"
        assert not word_prohibited.search(text), f"término prohibido en {resp.request.url}"

        data = resp.json()
        assert data["is_simulation"] is True
        assert data["data_nature"]
        assert data["assumptions"]
        assert data["limitations"]
    for resp in (run, evaluated, forecast):
        sheet = resp.json()["evaluation"]
        assert sheet["sources"]
        assert sheet["updated_at_utc"]
        assert sheet["uncertainty"]
