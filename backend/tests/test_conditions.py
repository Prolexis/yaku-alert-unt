"""Pruebas de las condiciones externas declaradas (escenario D)."""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from shapely.geometry import shape

from app.main import app
from app.models import SimulationRequest
from app.services.conditions import (
    load_conditions_catalog,
    load_evidence,
    resolve_conditions,
    validate_condition_ids,
)
from app.services.spatial import analyze_conditions_exposure, load_campus_geojson

client = TestClient(app)
JDN, JPII, QUEBRADA = "av_jesus_nazareth", "av_juan_pablo_ii", "quebrada_san_ildefonso"


def _simulate(conditions, intensity=0.0, duration=1, **extra):
    payload = {
        "scenario_id": "personalizado",
        "hazard_zone_id": "condiciones_externas",
        "intensity_mm_h": intensity,
        "duration_hours": duration,
        "external_conditions": conditions,
        **extra,
    }
    return client.post("/api/simulate", json=payload)


# ---------- integridad del catálogo ----------

def test_catalog_references_are_consistent():
    catalog = load_conditions_catalog()
    condition_ids = {c["id"] for c in catalog["conditions"]}
    assert len(condition_ids) == len(catalog["conditions"]), "ids de condición duplicados"
    campus = load_campus_geojson()["features"]
    report_ids = {f["properties"]["id"] for f in campus if f["properties"]["category"] == "zona_reportada"}
    building_ids = {f["properties"]["id"] for f in campus if f["properties"]["category"] == "edificio"}
    evidence = load_evidence()
    rule_ids = [r["id"] for r in catalog["rules"]]
    assert len(rule_ids) == len(set(rule_ids))
    for rule in catalog["rules"]:
        assert rule["si"] and set(rule["si"]) <= condition_ids, rule["id"]
        assert set(rule["zonas"]) <= report_ids, rule["id"]
        assert 0 <= rule["reach_m"] <= 150, rule["id"]
        assert isinstance(rule["puntaje"], int) and rule["puntaje"] >= 0, rule["id"]
        for event_id in rule["vigilar"]:
            assert event_id in evidence, (rule["id"], event_id)
            assert set(evidence[event_id]["ref_ids"]) <= building_ids | {
                f["properties"]["id"] for f in campus if f["properties"]["category"] == "acceso"
            }, event_id
    for condition in catalog["conditions"]:
        assert condition["evidence"], f"la condición {condition['id']} no declara evidencia"


def test_unknown_condition_is_rejected():
    with pytest.raises(ValueError):
        validate_condition_ids(["no_existe"])
    assert _simulate(["no_existe"]).status_code == 400


def test_duplicates_and_order_do_not_change_result():
    a = _simulate([JDN, QUEBRADA, JDN]).json()
    b = _simulate([QUEBRADA, JDN]).json()
    assert a["simulation_id"] == b["simulation_id"]
    assert a["preventive_evaluation"]["preventive_level"] == b["preventive_evaluation"]["preventive_level"]


# ---------- comportamiento de las reglas ----------

def test_no_conditions_means_empty_zone_and_no_rules():
    data = _simulate([]).json()
    assert data["hazard_geojson"]["properties"]["rules_fired"] == []
    assert data["spatial_analysis"]["total_restricted_accesses"] == 0
    assert data["spatial_analysis"]["watch_buildings"] == []
    assert data["synthetic_geojson"] is None
    assert data["preventive_evaluation"]["preventive_level"] == "INFORMATIVO"
    assert not any(r["rule_id"].startswith("R-EXT") for r in data["preventive_evaluation"]["rules_triggered"])


def test_jesus_de_nazareth_alone_marks_front_and_puerta4():
    data = _simulate([JDN]).json()
    accesses = {a["id"]: a for a in data["spatial_analysis"]["restricted_accesses"]}
    assert accesses["acc_osm_5052281066"]["inside_hazard_zone"] is True  # Puerta 4
    assert data["synthetic_geojson"] is None  # solo la combinación con la quebrada define alcance
    assert data["preventive_evaluation"]["preventive_level"] == "VIGILANCIA_PREVENTIVA"


@pytest.mark.parametrize("condition", [JDN, JPII, QUEBRADA])
def test_each_single_condition_raises_at_least_surveillance(condition):
    level = _simulate([condition]).json()["preventive_evaluation"]["preventive_level"]
    assert level in ("VIGILANCIA_PREVENTIVA", "ATENCION_PREVENTIVA")


def test_avenue_plus_quebrada_is_critical_and_lists_watch_buildings():
    data = _simulate([JDN, QUEBRADA]).json()
    evaluation = data["preventive_evaluation"]
    assert evaluation["preventive_level"] == "PREPARACION_CRITICA"
    assert "R-EXT-jdn_quebrada" in {r["rule_id"] for r in evaluation["rules_triggered"]}
    watched = {w["id"] for w in data["spatial_analysis"]["watch_buildings"]}
    assert {"bld_osm_376912913", "bld_osm_376912901", "bld_osm_376912922"} <= watched
    assert data["synthetic_reach_m_effective"] == 120
    assert any("declara el usuario" in note for note in evaluation["uncertainty_and_limits"])


def test_severity_never_exceeds_what_conditions_justify():
    """Más condiciones activas nunca bajan el nivel."""
    order = ["INFORMATIVO", "VIGILANCIA_PREVENTIVA", "ATENCION_PREVENTIVA", "PREPARACION_CRITICA"]
    levels = [
        order.index(_simulate(conds).json()["preventive_evaluation"]["preventive_level"])
        for conds in ([], [JDN], [JDN, QUEBRADA], [JDN, JPII, QUEBRADA])
    ]
    assert levels == sorted(levels)


def test_watch_buildings_do_not_enlarge_the_polygon():
    result, hazard, _ = analyze_conditions_exposure([JDN, QUEBRADA])
    campus = {f["properties"]["id"]: f for f in load_campus_geojson()["features"]}
    expected_zones = resolve_conditions([JDN, QUEBRADA]).zone_ids
    polygon = shape(hazard["geometry"])
    for zone_id in expected_zones:
        assert polygon.buffer(1e-9).covers(shape(campus[zone_id]["geometry"]))
    assert result.watch_buildings
    # el conteo principal sale solo de la geometría, no de la lista de vigilancia
    expected = sum(
        1 for f in campus.values()
        if f["properties"]["category"] == "edificio"
        and shape(f["geometry"]).area > 0
        and polygon.intersection(shape(f["geometry"])).area / shape(f["geometry"]).area * 100 >= 5.0
    )
    assert result.total_exposed_buildings == expected


def test_simulation_with_conditions_is_reproducible():
    assert _simulate([JDN, QUEBRADA], 10, 3).json() == _simulate([JDN, QUEBRADA], 10, 3).json()


def test_conditions_with_other_scenario_are_rejected():
    resp = client.post("/api/simulate", json={
        "scenario_id": "personalizado",
        "hazard_zone_id": "lluvia_moderada",
        "external_conditions": [JDN],
    })
    assert resp.status_code == 400


def test_default_request_is_unchanged_without_conditions():
    assert SimulationRequest().external_conditions == []
    resp = client.post("/api/simulate", json={"scenario_id": "lluvia_intensa_fen", "hazard_zone_id": "lluvia_intensa_fen"})
    assert resp.status_code == 200
    assert resp.json()["spatial_analysis"]["watch_buildings"] == []


# ---------- API ----------

def test_conditions_catalog_endpoint():
    data = client.get("/api/conditions").json()
    assert {c["id"] for c in data["conditions"]} == {JDN, JPII, QUEBRADA}
    assert data["rules"]
    assert "no provienen de sensores" in data["metadata"]["disclaimer"]


def test_live_evaluation_accepts_conditions():
    base = client.get("/api/preventive/evaluate?offline=true").json()
    with_cond = client.get(f"/api/preventive/evaluate?offline=true&conditions={JDN}&conditions={QUEBRADA}").json()
    assert with_cond["is_synthetic"] is False
    assert any(r["rule_id"].startswith("R-EXT") for r in with_cond["rules_triggered"])
    assert not any(r["rule_id"].startswith("R-EXT") for r in base["rules_triggered"])
    assert client.get("/api/preventive/evaluate?offline=true&conditions=zzz").status_code == 400


# ---------- regresión con evidencia real ----------

def test_all_independent_evidence_is_covered_when_all_conditions_active():
    """Cada edificio con agua reportada (evidencia independiente y ubicable) debe quedar cubierto por
    el polígono, la influencia sintética o la lista de vigilancia. Es CALIBRACIÓN con pocos puntos,
    no validación: sirve para que ningún cambio futuro empeore la cobertura sin avisar."""
    result, hazard, synthetic = analyze_conditions_exposure([JDN, JPII, QUEBRADA])
    campus = {f["properties"]["id"]: f for f in load_campus_geojson()["features"]}
    covered_by_watch = {w.id for w in result.watch_buildings}
    synthetic_ids = {
        b.id for b in result.synthetic_exposure.buildings if b.overlap_pct >= 5.0
    } if result.synthetic_exposure else set()
    polygon = shape(hazard["geometry"])
    checked = 0
    for event in load_evidence().values():
        if not event["independiente"]:
            continue
        for ref_id in event["ref_ids"]:
            if campus[ref_id]["properties"]["category"] != "edificio":
                continue
            geom = shape(campus[ref_id]["geometry"])
            in_polygon = geom.area > 0 and polygon.intersection(geom).area / geom.area >= 0.05
            assert in_polygon or ref_id in synthetic_ids or ref_id in covered_by_watch, event["id"]
            checked += 1
    assert checked >= 4  # Educación, Economía (2 edificios) y Farmacia
