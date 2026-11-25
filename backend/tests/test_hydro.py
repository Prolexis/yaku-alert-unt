"""Pruebas del motor de agua (capa nueva, Fase 1).

Cubre lo exigido: conservación de masa, ausencia de agua sin lluvia ni ingreso,
monotonicidad del flujo desde la Puerta 4 hacia el suroeste, ausencia de agua
sobre edificios, determinismo, validación 422 y frases prohibidas en las
respuestas de los tres endpoints nuevos.
"""
import math

import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.services.hydro import load_terrain_grid, simulate_core

client = TestClient(app)

AZIMUT_P4_DEG = 203.0  # descenso principal del campus (derivado del DEM)


def _p4_projection(depth: np.ndarray) -> np.ndarray:
    """Desplazamiento de las celdas mojadas respecto a P4 en el azimut 203° (m)."""
    grid = load_terrain_grid()
    p4_cells = grid.inlets["p4"]
    rows_idx, cols_idx = np.divmod(p4_cells, grid.nx)
    pr, pc = float(rows_idx.mean()), float(cols_idx.mean())
    rows, cols = np.nonzero(depth >= 0.01)
    dx = (cols - pc) * grid.cell_size_m          # este positivo
    dy = -(rows - pr) * grid.cell_size_m         # norte positivo
    az = math.radians(AZIMUT_P4_DEG)
    return dx * math.sin(az) + dy * math.cos(az)


def _p4_only_run(inflow_p4: str = "alto"):
    """Corrida de 48 h SIN lluvia: todo el agua viene de la Puerta 4."""
    return simulate_core([0.0] * 48, drainage_state="normal", inflow_p4=inflow_p4)


# --- 1. conservación de masa ---------------------------------------------------
def test_hydro_mass_balance_conserves_water():
    series = [0.0, 0.0, 4.0, 9.0, 7.0, 3.0] + [0.0] * 42
    resp, _ = simulate_core(series, drainage_state="obstruido",
                            inflow_p4="medio", secondary_inflow=True)
    mb = resp.summary["mass_balance_m3"]
    entrada = mb["entrada_lluvia"] + mb["entrada_ingreso"]
    salida = mb["salida_drenaje"] + mb["salida_borde"] + mb["perdida_tejados_sin_vecino"]
    assert abs(entrada - salida - mb["almacenada"]) < 0.01
    assert abs(mb["residual"]) < 0.01
    assert entrada > 0.0  # la prueba tiene sentido solo si entró agua


# --- 2. sin lluvia ni ingreso -> sin agua --------------------------------------
def test_hydro_no_rain_and_no_inflow_means_no_water():
    resp, depth = simulate_core([0.0] * 48, drainage_state="normal",
                                inflow_p4="ninguno")
    assert float(depth.max()) == 0.0
    assert resp.summary["final_wet_area_m2"] == 0.0
    assert resp.summary["max_depth_cm"] == 0.0
    mb = resp.summary["mass_balance_m3"]
    assert mb["entrada_lluvia"] == 0.0 and mb["entrada_ingreso"] == 0.0


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
    rows, cols = np.nonzero(depth >= 0.01)
    southwest = (rows > pr) & (cols < pc)
    assert int(southwest.sum()) >= 10, "el agua no avanzó hacia el sur-oeste de P4"
    # y salió de las propias celdas de ingreso
    assert int((depth >= 0.01).sum()) > p4_cells.size


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


# --- frases prohibidas + campos obligatorios en las 3 respuestas ---------------
def test_hydro_responses_never_use_prohibited_phrases():
    import re

    run = client.post("/api/hydro/run", json={
        "rainfall_mm_h": [0.0, 3.0, 8.0, 4.0] + [0.0] * 44,
        "drainage_state": "normal",
        "inflow_p4": "medio",
        "secondary_inflow": False,
    })
    presets = client.get("/api/hydro/presets")
    forecast = client.get("/api/hydro/forecast?offline=true")
    assert run.status_code == 200, run.text
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

    for resp in (run, presets, forecast):
        text = resp.text.lower()
        for phrase in prohibited:
            assert phrase not in text, f"frase prohibida '{phrase}' en {resp.request.url}"
        assert not word_prohibited.search(text), f"término prohibido en {resp.request.url}"

        data = resp.json()
        assert data["is_simulation"] is True
        assert data["data_nature"]
        assert data["assumptions"]
        assert data["limitations"]
