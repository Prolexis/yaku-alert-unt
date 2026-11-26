"""Pruebas automatizadas para YAKU SENSE (Red de sensores IoT virtuales)."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.services.hydro import load_terrain_grid, run_hydro_simulation
from app.services.virtual_sensors import get_virtual_sensors_catalog

client = TestClient(app)


def test_six_virtual_sensors_with_unique_ids_and_valid_metadata():
    catalog = get_virtual_sensors_catalog(load_terrain_grid())
    features = catalog["features"]
    assert len(features) == 6

    ids = [f["properties"]["id"] for f in features]
    assert ids == ["S01", "S02", "S03", "S04", "S05", "S06"]
    assert len(set(ids)) == 6

    for feat in features:
        props = feat["properties"]
        assert props["sensor_type"]
        assert props["unit"]
        assert props["variable"]
        assert props["location_status"] == "Ubicación propuesta — pendiente de verificación de campo"
        assert "no operativa" in props["connectivity_protocol"].lower()
        assert props["iot_architecture"]["operational_status"] == "PROPUESTA_FUTURA_NO_OPERATIVA"


def test_virtual_sensors_coordinates_inside_model_domain_and_open_cells():
    grid = load_terrain_grid()
    catalog = get_virtual_sensors_catalog(grid)
    min_lon, min_lat, max_lon, max_lat = grid.bounds

    for feat in catalog["features"]:
        lon, lat = feat["geometry"]["coordinates"]
        props = feat["properties"]
        assert min_lon <= lon <= max_lon
        assert min_lat <= lat <= max_lat
        assert props["in_model_domain"] is True
        assert props["is_open_cell"] is True, f"Sensor {props['id']} cayó sobre celda bloqueada"


def test_hydro_run_populates_deterministic_sensor_series():
    rain = [5.0, 18.0, 28.0, 12.0, 4.0, 0.0]
    res1 = run_hydro_simulation(rain, drainage_state="obstruido", inflow_p4="alto")
    res2 = run_hydro_simulation(rain, drainage_state="obstruido", inflow_p4="alto")

    assert res1.virtual_sensors is not None
    assert len(res1.virtual_sensors) == 6
    # Reproducibilidad exacta (sin números aleatorios)
    assert res1.virtual_sensors == res2.virtual_sensors

    by_id = {s["id"]: s for s in res1.virtual_sensors}

    # S01 reutiliza exactamente la serie de lluvia de entrada
    s01_vals = [p["value"] for p in by_id["S01"]["series"]]
    assert s01_vals == rain
    assert len(by_id["S01"]["series"]) == len(res1.frames)

    # S02, S03, S04 derivan de hydro.py y coinciden en cantidad de horas
    for sid in ("S02", "S03", "S04"):
        sensor = by_id[sid]
        assert sensor["virtual_status"] == "active_virtual"
        assert len(sensor["series"]) == len(res1.frames)
        assert [p["hour"] for p in sensor["series"]] == [f.hour for f in res1.frames]
        assert sensor["reading_label"] == "Lámina modelada en el punto virtual"
        assert "medición real" not in sensor["reading_label"].lower()

    # S02 en Puerta 4 con ingreso alto debe registrar agua > 0
    assert by_id["S02"]["peak_value"] is not None
    assert by_id["S02"]["peak_value"] > 0.0

    # S05 y S06 no inventan lecturas
    for sid in ("S05", "S06"):
        assert by_id[sid]["virtual_status"] == "no_reading"
        assert by_id[sid]["last_value"] is None
        assert by_id[sid]["series"] == []


def test_virtual_sensors_endpoint_returns_catalog_offline():
    resp = client.get("/api/sensors/virtual")
    assert resp.status_code == 200
    body = resp.json()
    assert body["type"] == "FeatureCollection"
    assert body["metadata"]["installed_physically"] is False
    assert len(body["features"]) == 6


def test_hydro_api_endpoint_includes_virtual_sensors():
    resp = client.post(
        "/api/hydro/run",
        json={
            "rainfall_mm_h": [10.0, 25.0, 15.0, 5.0],
            "drainage_state": "obstruido",
            "inflow_p4": "medio",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["virtual_sensors"]) == 6
    assert data["is_simulation"] is True
