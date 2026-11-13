import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.spatial import analyze_spatial_exposure
from app.services.weather import parse_open_meteo_payload

client = TestClient(app)


def test_health_and_security_headers():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert resp.headers.get("Referrer-Policy") == "no-referrer"


def test_weather_offline_fallback():
    resp = client.get("/api/weather?offline=true")
    assert resp.status_code == 200
    data = resp.json()
    assert data["data_status"] == "OFFLINE_FALLBACK"
    assert data["data_nature"] == "RESPALDO_LOCAL_CACHE_PRONOSTICO"
    assert len(data["hourly"]) >= 24
    assert "precipitation" in data["units"]
    assert "Open-Meteo" in data["source_name"]


def test_weather_live_api():
    resp = client.get("/api/weather?offline=false")
    assert resp.status_code == 200
    data = resp.json()
    assert data["data_status"] in ("LIVE_API", "OFFLINE_FALLBACK")
    assert len(data["hourly"]) >= 24


def test_invalid_weather_payload_raises():
    with pytest.raises(ValueError):
        parse_open_meteo_payload({"hourly": {}}, "LIVE_API", "2026-11-13T00:00:00Z")


def test_spatial_analysis_inside_and_outside_zones():
    # Zona moderada solo debe afectar sector oeste (Comedor, acceso América Oeste) y NO Derecho
    spatial_mod, _ = analyze_spatial_exposure("lluvia_moderada")
    bld_map = {b.id: b for b in spatial_mod.exposed_buildings}
    assert bld_map["bld_comedor"].inside_hazard_zone is True
    assert bld_map["bld_derecho"].inside_hazard_zone is False

    # Escenario extremo debe ampliar la exposición
    spatial_ext, _ = analyze_spatial_exposure("escenario_extremo_fen")
    assert spatial_ext.total_exposed_buildings > spatial_mod.total_exposed_buildings


def test_simulation_reproducibility_and_synthetic_labeling():
    payload = {
        "scenario_id": "lluvia_intensa_fen",
        "intensity_mm_h": 28.0,
        "duration_hours": 4,
        "drainage_obstructed": True,
        "antecedent_soil_saturated": False,
        "hazard_zone_id": "lluvia_intensa_fen",
    }
    r1 = client.post("/api/simulate", json=payload)
    r2 = client.post("/api/simulate", json=payload)
    assert r1.status_code == 200
    assert r2.status_code == 200
    d1, d2 = r1.json(), r2.json()
    assert d1["is_synthetic"] is True
    assert d1["data_nature"] == "ESCENARIO_SIMULADO_SINTETICO"
    assert d1["simulation_id"] == d2["simulation_id"]
    assert d1["preventive_evaluation"]["preventive_level"] == d2["preventive_evaluation"]["preventive_level"]
    assert len(d1["preventive_evaluation"]["rules_triggered"]) >= 3
    assert len(d1["preventive_evaluation"]["uncertainty_and_limits"]) >= 2


def test_invalid_simulation_input_rejected():
    bad_payload = {
        "scenario_id": "personalizado",
        "intensity_mm_h": -10.0,
        "duration_hours": 0,
        "hazard_zone_id": "lluvia_moderada",
    }
    resp = client.post("/api/simulate", json=bad_payload)
    assert resp.status_code == 422


def test_live_preventive_evaluation_endpoint():
    resp = client.get("/api/preventive/evaluate?offline=true")
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_synthetic"] is False
    assert data["data_nature"] == "EVALUACION_SOBRE_PRONOSTICO_REAL"
    assert "Ley N.° 29664" in data["legal_disclaimer"]


def test_protocols_endpoint():
    resp = client.get("/api/protocols")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["preventive_levels"]) == 4
    assert len(data["trujillo_basins_context"]) == 3
