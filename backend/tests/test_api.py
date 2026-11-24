import json
import math
from pathlib import Path

import pytest
import numpy as np
import shapely
from shapely.geometry import shape
from shapely.ops import unary_union
from fastapi.testclient import TestClient

from app.main import app
from app.models import SimulationRequest
from app.services.spatial import analyze_spatial_exposure
from app.services import weather as weather_mod
from app.services.weather import parse_open_meteo_payload

client = TestClient(app)
ROOT = Path(__file__).resolve().parents[2]
LAT0 = -8.114
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574


def _to_local(geometry):
    return shapely.transform(
        geometry,
        lambda coords: np.column_stack((
            (coords[:, 0] + 79.0) * KX,
            (coords[:, 1] - LAT0) * KY,
        )),
    )


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
    """Verifica el resultado contra un cálculo independiente con Shapely (sin depender de IDs fijos)."""
    from shapely.geometry import shape

    from app.services.spatial import load_campus_geojson, load_hazards_geojson

    campus = load_campus_geojson()["features"]
    hazards = {
        f["properties"]["scenario_id"]: shape(f["geometry"])
        for f in load_hazards_geojson()["features"]
        if f["properties"].get("kind") != "influencia_sintetica"
    }
    geoms = {f["properties"]["id"]: shape(f["geometry"]) for f in campus if f["properties"]["category"] == "edificio"}
    assert len(geoms) > 0

    results = {}
    for scenario, hazard in hazards.items():
        spatial, _, _ = analyze_spatial_exposure(scenario)
        results[scenario] = spatial
        for b in spatial.exposed_buildings:
            assert b.inside_hazard_zone == hazard.intersects(geoms[b.id])
        # Cálculo independiente del traslape: expuesto = >= 5 % de la huella dentro de la zona
        expected = sum(1 for g in geoms.values()
                       if g.area > 0 and hazard.intersection(g).area / g.area * 100 >= 5.0)
        assert spatial.total_exposed_buildings == expected

    # Escenario extremo debe cubrir al menos lo del moderado
    assert results["escenario_extremo_fen"].total_exposed_buildings >= results["lluvia_moderada"].total_exposed_buildings


def test_scenarios_distinguish_mechanisms_and_report_zones():
    """Los escenarios se distinguen por mecanismo, no por tamaño ni por lluvia.

    A = relieve (DEM p15); B = zonas reportadas (testimonio/prensa); C = p30 + reportes.
    """
    from shapely.geometry import shape

    from app.services.spatial import load_campus_geojson, load_hazards_geojson

    features = {
        f["properties"]["scenario_id"]: f
        for f in load_hazards_geojson()["features"]
        if f["properties"].get("kind") != "influencia_sintetica"
    }
    assert set(features) == {"lluvia_moderada", "lluvia_intensa_fen", "escenario_extremo_fen"}
    A = shape(features["lluvia_moderada"]["geometry"])
    B = shape(features["lluvia_intensa_fen"]["geometry"])
    C = shape(features["escenario_extremo_fen"]["geometry"])

    natures = {sid: f["properties"]["data_nature"] for sid, f in features.items()}
    assert natures == {
        "lluvia_moderada": "sintetico_experimental_dem",
        "lluvia_intensa_fen": "testimonio_no_verificado",
        "escenario_extremo_fen": "mixto_dem_testimonio",
    }

    # B no es un recorte ni un subconjunto de A: aporta zonas fuera del polígono de relieve.
    assert not A.covers(B)

    # C contiene el polígono de relieve de A (p30 incluye p15) además de las zonas reportadas.
    assert C.buffer(1e-9).covers(A)

    # El reporte del CIDUNT está dentro de B y el edificio aparece en el análisis de exposición.
    campus = load_campus_geojson()["features"]
    cidunt = [f for f in campus if f["properties"].get("name") == "Centro de Idiomas - CIDUNT"]
    assert cidunt, "campus_unt.geojson debe conservar el edificio CIDUNT de OSM"
    assert shape(cidunt[0]["geometry"]).intersects(B)

    spatial, _, _ = analyze_spatial_exposure("lluvia_intensa_fen")
    inside = {b.name for b in spatial.exposed_buildings if b.inside_hazard_zone}
    assert "Centro de Idiomas - CIDUNT" in inside

    # Control de honestidad: ningún nombre de edificio puede ser inventado por el escenario;
    # todos deben existir en la capa del campus derivada de OSM.
    campus_buildings = {
        f["properties"].get("name") for f in campus if f["properties"].get("category") == "edificio"
    }
    assert inside <= campus_buildings


def test_exposure_level_thresholds():
    from app.services.spatial import classify_exposure

    assert classify_exposure(0) == "ninguna"
    assert classify_exposure(0.1) == "marginal"
    assert classify_exposure(4.9) == "marginal"
    assert classify_exposure(5.0) == "parcial"
    assert classify_exposure(25.0) == "parcial"
    assert classify_exposure(25.1) == "alta"
    assert classify_exposure(75.0) == "alta"
    assert classify_exposure(75.1) == "total"
    assert classify_exposure(100.0) == "total"


def test_exposure_levels_consistent_in_scenarios():
    for scenario in ("lluvia_moderada", "lluvia_intensa_fen", "escenario_extremo_fen"):
        spatial, _, _ = analyze_spatial_exposure(scenario)
        c = spatial.exposure_counts
        assert spatial.total_exposed_buildings == c["parcial"] + c["alta"] + c["total"]
        for b in spatial.exposed_buildings:
            assert (b.exposure_level == "ninguna") == (b.overlap_pct == 0)
            if b.exposure_level == "total":
                assert b.overlap_pct > 75


def test_campus_geojson_quality():
    from app.services.spatial import load_campus_geojson

    feats = load_campus_geojson()["features"]
    ids = [f["properties"]["id"] for f in feats]
    assert len(ids) == len(set(ids)), "IDs duplicados"
    cats = {f["properties"]["category"] for f in feats}
    assert "edificio" in cats and "perimetro_campus" in cats
    for f in feats:
        assert f["properties"].get("source"), f["properties"]["id"]
        assert f["properties"].get("verified") in (True, False)


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


def test_offline_fallback_declares_reason_and_cache_period():
    weather_mod.reset_weather_cache()
    data = client.get("/api/weather?offline=true").json()
    assert data["data_status"] == "OFFLINE_FALLBACK"
    assert "forzado" in data["fallback_reason"]
    # el respaldo declara de qué fechas son sus datos: no se presenta como pronóstico actual
    assert " a " in data["cache_period"] and data["cache_period"][:2] == "20"


def test_live_failure_falls_back_and_backs_off(monkeypatch):
    """Sin red: se usa el respaldo, se explica el motivo y no se reintenta en cada recarga."""
    weather_mod.reset_weather_cache()
    calls = {"n": 0}

    class Boom:
        def __init__(self, *a, **k):
            calls["n"] += 1
            raise OSError("sin red simulada")

    monkeypatch.setattr(weather_mod.httpx, "AsyncClient", Boom)
    first = client.get("/api/weather?offline=false").json()
    second = client.get("/api/weather?offline=false").json()
    assert first["data_status"] == second["data_status"] == "OFFLINE_FALLBACK"
    assert "OSError" in first["fallback_reason"]
    assert calls["n"] == 1  # el segundo pedido no vuelve a esperar a la red
    weather_mod.reset_weather_cache()


def test_live_evaluation_works_without_network(monkeypatch):
    weather_mod.reset_weather_cache()

    class Boom:
        def __init__(self, *a, **k):
            raise OSError("sin red simulada")

    monkeypatch.setattr(weather_mod.httpx, "AsyncClient", Boom)
    resp = client.get("/api/preventive/evaluate?offline=false")
    assert resp.status_code == 200
    weather_mod.reset_weather_cache()


def test_reported_road_strips_stop_within_40m_of_campus_frontage():
    from app.services.spatial import load_campus_geojson

    features = load_campus_geojson()["features"]
    perimeter = unary_union([
        _to_local(shape(feature["geometry"]))
        for feature in features
        if feature["properties"].get("category") == "perimetro_campus"
    ])
    roads = [
        feature for feature in features
        if feature["properties"].get("id") in ("rep_av_jesus_nazareth", "rep_av_juan_pablo")
    ]
    assert len(roads) == 2
    for road in roads:
        assert _to_local(shape(road["geometry"])).difference(perimeter.buffer(40.01)).is_empty


def test_synthetic_influence_exists_and_is_downstream_for_both_scenarios():
    from app.services.spatial import load_campus_geojson, load_hazards_geojson

    reports = {
        feature["properties"]["id"]: [
            _to_local(part)
            for part in (
                list(shape(feature["geometry"]).geoms)
                if shape(feature["geometry"]).geom_type == "MultiPolygon"
                else [shape(feature["geometry"])]
            )
        ]
        for feature in load_campus_geojson()["features"]
        if feature["properties"].get("category") == "zona_reportada"
    }
    hazards = load_hazards_geojson()["features"]
    for scenario_id in ("lluvia_intensa_fen", "escenario_extremo_fen"):
        synthetic = [
            feature for feature in hazards
            if feature["properties"].get("scenario_id") == scenario_id
            and feature["properties"].get("kind") == "influencia_sintetica"
        ]
        assert synthetic
        for feature in synthetic:
            props = feature["properties"]
            assert props["data_nature"] == "sintetico_demostrativo"
            original = reports[props["report_id"]][props["report_component_index"]]
            downstream = _to_local(shape(feature["geometry"]))
            dx = downstream.centroid.x - original.centroid.x
            dy = downstream.centroid.y - original.centroid.y
            angle = math.radians(props["azimuth_deg"])
            assert dx * math.sin(angle) + dy * math.cos(angle) > 0


def test_synthetic_exposure_does_not_change_reported_total_exposure():
    spatial_20, _, synthetic_20 = analyze_spatial_exposure("lluvia_intensa_fen", 20)
    spatial_150, _, synthetic_150 = analyze_spatial_exposure("lluvia_intensa_fen", 150)
    assert spatial_20.total_exposed_buildings == spatial_150.total_exposed_buildings
    assert spatial_20.synthetic_exposure.reach_m == 20
    assert spatial_150.synthetic_exposure.reach_m == 150
    assert synthetic_20["features"][0]["properties"]["reach_m"] == 20
    assert synthetic_150["features"][0]["properties"]["reach_m"] == 150


@pytest.mark.parametrize("reach", [19, 151])
def test_synthetic_reach_out_of_range_returns_422(reach):
    response = client.post("/api/simulate", json={
        "scenario_id": "personalizado",
        "hazard_zone_id": "lluvia_intensa_fen",
        "synthetic_reach_m": reach,
    })
    assert response.status_code == 422


def test_rainfall_reference_file_has_three_events_and_declared_source():
    reference_path = ROOT / "backend" / "app" / "data" / "eventos_referencia.json"
    if not reference_path.exists():
        pytest.skip("No se generó eventos_referencia.json")
    data = json.loads(reference_path.read_text(encoding="utf-8"))
    assert len(data["events"]) == 3
    assert data["source"]
    assert all(event["source"] and event["id"] for event in data["events"])
    if data["historical_values_available"]:
        assert all(
            event["max_hourly_mm_h"] is not None
            and event["max_rolling_24h_mm"] is not None
            and event["hours_ge_0_1mm"] is not None
            for event in data["events"]
        )
    else:
        assert all(event["demo_assumption"] for event in data["events"])


@pytest.mark.parametrize(
    ("scenario_id", "intensity", "duration"),
    [
        ("lluvia_moderada", 12.0, 3),
        ("lluvia_intensa_fen", 28.0, 4),
        ("escenario_extremo_fen", 45.0, 6),
    ],
)
def test_missing_historical_data_keeps_old_presets_as_demo(
    monkeypatch, tmp_path, scenario_id, intensity, duration
):
    from app.services import simulator as simulator_mod

    monkeypatch.setattr(
        simulator_mod, "EVENTS_REFERENCE_PATH", tmp_path / "no-historical-data.json"
    )
    result = simulator_mod.run_offline_simulation(SimulationRequest(
        scenario_id=scenario_id,
        hazard_zone_id=scenario_id,
    ))
    assert result.parameters.intensity_mm_h == intensity
    assert result.parameters.duration_hours == duration
    assert result.rainfall_reference.is_historical_reanalysis is False
    assert "demostración" in result.rainfall_reference.note


def test_ui_and_docs_never_claim_rain_changes_hazard_polygons():
    paths = [
        ROOT / "frontend" / "src" / "components" / "CampusMapView.jsx",
        ROOT / "frontend" / "src" / "components" / "SimulatorView.jsx",
        ROOT / "docs" / "DEFENSA_JURADO.md",
        ROOT / "docs" / "ENTREGABLE_3_FICHA_TECNICA.md",
        ROOT / "README.md",
    ]
    forbidden = (
        "la lluvia modifica el polígono",
        "la lluvia modifica los polígonos",
        "la lluvia modifica estas geometrías",
        "el polígono cambia con la lluvia",
    )
    for path in paths:
        text = path.read_text(encoding="utf-8").lower()
        assert not any(claim in text for claim in forbidden), path
