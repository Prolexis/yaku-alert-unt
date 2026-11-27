"""Pruebas de integración para simulación en vivo (Bloque 1) y recomendaciones dinámicas por edificio/rol (Bloque 2)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.db import init_db, save_active_simulation
from app.main import app
from app.services.hydro import list_presets, run_hydro_simulation
from app.services.spatial import (
    build_building_recommendations,
    load_campus_geojson,
    load_evacuation_geojson,
)


@pytest.fixture()
def isolated_db(tmp_path, monkeypatch):
    db_file = tmp_path / "yaku_live_test.db"
    monkeypatch.setenv("YAKU_DB_PATH", str(db_file))
    monkeypatch.setenv("WHATSAPP_ENABLED", "false")
    init_db()
    return db_file


def test_live_simulation_activate_and_stop(isolated_db):
    client = TestClient(app)

    # Inicialmente inactiva
    r0 = client.get("/api/simulation/live")
    assert r0.status_code == 200
    assert r0.json()["active"] is False

    # Activar simulación en vivo (Ciclón Yaku 2023)
    resp = client.post(
        "/api/simulation/live/activate",
        json={
            "scenario_id": "evento_2023_03_10",
            "drainage_scenario": "obstruido",
            "inflow_p4": "alto",
            "auto_alert_delay_sec": 30,
            "send_whatsapp": False,
            "activated_by_role": "operador_riesgos",
            "offline": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["active"] is True
    assert data["scenario_id"] == "evento_2023_03_10"
    assert data["drainage_scenario"] == "obstruido"
    assert 55 <= data["confidence_pct"] <= 95
    assert len(data["confidence_factors"]) >= 4
    assert len(data["building_status"]) > 0
    assert data["alert_dispatched"] is False

    # GET /api/simulation/live devuelve el estado activo
    r_live = client.get("/api/simulation/live")
    assert r_live.status_code == 200
    live_data = r_live.json()
    assert live_data["active"] is True
    assert live_data["confidence_pct"] == data["confidence_pct"]

    # Detener simulación en vivo
    r_stop = client.post("/api/simulation/live/stop")
    assert r_stop.status_code == 200
    assert r_stop.json()["active"] is False
    assert r_stop.json()["stopped"] is True

    r_after = client.get("/api/simulation/live")
    assert r_after.status_code == 200
    assert r_after.json()["active"] is False


def test_live_simulation_idempotent_cap_alert_dispatch(isolated_db):
    client = TestClient(app)

    # Activar con delay de 10 s y luego retroceder started_at para simular que ya pasaron 12 s
    resp = client.post(
        "/api/simulation/live/activate",
        json={
            "scenario_id": "evento_2023_03_10",
            "drainage_scenario": "base",
            "inflow_p4": "alto",
            "auto_alert_delay_sec": 10,
            "send_whatsapp": False,
            "activated_by_role": "directivo",
            "offline": True,
        },
    )
    assert resp.status_code == 200
    initial = resp.json()
    assert initial["alert_dispatched"] is False

    # Simular que han transcurrido 15 s reescribiendo started_at en SQLite
    past_iso = (datetime.now(timezone.utc) - timedelta(seconds=15)).isoformat()
    save_active_simulation(
        scenario_id=initial["scenario_id"],
        scenario_label=initial["scenario_label"],
        drainage_scenario=initial["drainage_scenario"],
        params=initial.get("parameters") or {},
        started_at=past_iso,
        auto_alert_delay_sec=10,
        confidence_pct=initial["confidence_pct"],
        confidence_factors=initial["confidence_factors"],
        activated_by_role="directivo",
        result={
            "summary": initial["summary"],
            "parameters": initial["parameters"],
            "frames": initial["frames"],
            "elements": initial["elements"],
            "evaluation": initial["evaluation"],
            "drainage_impact": initial["drainage_impact"],
            "building_status": initial["building_status"],
            "affected_gates": initial["affected_gates"],
            "top_affected_buildings": initial["top_affected_buildings"],
            "send_whatsapp": False,
            "offline": True,
        },
    )

    # Múltiples llamadas consecutivas a GET /api/simulation/live NO deben duplicar la alerta
    r1 = client.get("/api/simulation/live").json()
    r2 = client.get("/api/simulation/live").json()
    r3 = client.get("/api/simulation/live").json()

    assert r1["alert_dispatched"] is True
    assert r1["dispatched_alert_id"] is not None
    assert r2["dispatched_alert_id"] == r1["dispatched_alert_id"]
    assert r3["dispatched_alert_id"] == r1["dispatched_alert_id"]

    alerts_resp = client.get("/api/alerts?active_only=true").json()
    assert alerts_resp["total_active"] == 1

    emitted = alerts_resp["active_alerts"][0]
    assert emitted["status"] == "emitida"
    assert emitted["severity"] in ("AMARILLO", "NARANJA", "ROJO")
    assert emitted["validated_by_role"] == "directivo"
    assert f"Certeza modelada: {initial['confidence_pct']}%" in emitted["what_happens"]
    assert emitted["what_to_do"]
    assert emitted["where_zone"]
    assert emitted["when_window"]

    client.post("/api/simulation/live/stop")


def test_dynamic_building_recommendations_differentiate_critical_and_safe(isolated_db):
    presets = {p.id: p for p in list_presets().presets}
    yaku = presets["evento_2023_03_10"]

    hydro_run = run_hydro_simulation(
        yaku.rainfall_mm_h,
        drainage_state="obstruido",
        drainage_scenario="obstruido",
        inflow_p4="alto",
        secondary_inflow=True,
        use_reported_sinks=True,
    )
    campus = load_campus_geojson()
    evacuation = load_evacuation_geojson()

    buildings = build_building_recommendations(hydro_run, campus, evacuation)
    assert len(buildings) >= 10

    critical = [b for b in buildings if b["risk_level"] == "critico"]
    safe = [b for b in buildings if b["risk_level"] == "seguro"]

    assert len(critical) >= 1, "Debe existir al menos un edificio en estado crítico (> 15 cm)"
    assert len(safe) >= 1, "Debe existir al menos un edificio en estado seguro (< 2 cm)"

    b_crit = critical[0]
    b_safe = safe[0]

    assert b_crit["max_depth_cm"] > 15.0
    assert b_safe["max_depth_cm"] < 2.0
    assert b_crit["risk_level"] != b_safe["risk_level"]

    # Recomendaciones distintas entre edificio crítico y edificio seguro
    for role in ("estudiante", "docente", "administrativo"):
        assert b_crit["recommendations_by_role"][role] != b_safe["recommendations_by_role"][role]

    # Recomendaciones distintas entre roles dentro del mismo edificio
    crit_recs = b_crit["recommendations_by_role"]
    assert len({crit_recs["estudiante"], crit_recs["docente"], crit_recs["administrativo"]}) == 3

    # Punto de encuentro seguro (< 2 cm) con distancia y tiempo
    mp = b_crit["nearest_safe_meeting_point"]
    assert mp is not None
    assert mp["name"]
    assert mp["distance_m"] >= 0
    assert mp["walk_time_min"] >= 1
    assert mp["max_depth_cm"] < 2.0

    # Verificar endpoint /api/campus/building-status cuando hay simulación activa
    client = TestClient(app)
    client.post(
        "/api/simulation/live/activate",
        json={
            "scenario_id": "evento_2023_03_10",
            "drainage_scenario": "obstruido",
            "inflow_p4": "alto",
            "secondary_inflow": True,
            "use_reported_sinks": True,
            "auto_alert_delay_sec": 60,
            "send_whatsapp": False,
            "offline": True,
        },
    )
    status_resp = client.get("/api/campus/building-status")
    assert status_resp.status_code == 200
    payload = status_resp.json()
    assert payload["source"] == "live_simulation"
    assert payload["active_simulation"] is True
    assert payload["total_buildings"] == len(buildings)
    client.post("/api/simulation/live/stop")


def test_five_roles_end_to_end_audit_and_confirmations(isolated_db):
    """Verifica el flujo completo de los 5 roles y la trazabilidad de roles reales en SQLite."""
    client = TestClient(app)

    # 1. Login rápido sintético para los 5 roles
    for role in ("estudiante", "docente", "administrativo", "directivo", "operador_riesgos"):
        r = client.post("/api/auth/demo-login", json={"quick_role": role})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == role

    # 2. Operador de Riesgos activa simulación en vivo (delay 0 para prueba inmediata) y verifica reporte
    rep = client.post(
        "/api/reports",
        json={
            "category": "aniego",
            "zone_name": "Puerta 4 (Av. Jesús de Nazareth)",
            "severity": "alta",
            "note": "Agua ingresando por calzada",
        },
    ).json()
    upd_rep = client.patch(
        f"/api/reports/{rep['id']}/status",
        json={"status": "verificado", "verified_by_role": "operador_riesgos"},
    )
    assert upd_rep.status_code == 200
    assert upd_rep.json()["verified_by_role"] == "operador_riesgos"

    sim = client.post(
        "/api/simulation/live/activate",
        json={
            "scenario_id": "evento_2023_03_10",
            "drainage_scenario": "base",
            "inflow_p4": "alto",
            "auto_alert_delay_sec": 0,
            "send_whatsapp": False,
            "activated_by_role": "operador_riesgos",
            "offline": True,
        },
    ).json()
    assert sim["active"] is True
    assert sim["activated_by_role"] == "operador_riesgos"
    assert sim["alert_dispatched"] is True
    alert_id = sim["dispatched_alert_id"]
    assert alert_id is not None

    # 3. Comunidad UNT confirma recepción con sus 3 roles diferenciados
    client.post(f"/api/alerts/{alert_id}/confirm", json={"role": "estudiante", "status": "en_zona_segura"})
    client.post(f"/api/alerts/{alert_id}/confirm", json={"role": "docente", "status": "recibido"})
    client.post(f"/api/alerts/{alert_id}/confirm", json={"role": "administrativo", "status": "recibido"})

    alerts = client.get("/api/alerts?active_only=true").json()["active_alerts"]
    emitted = next(a for a in alerts if a["id"] == alert_id)
    by_role = emitted["confirmations"]["by_role"]
    assert by_role["estudiante"]["en_zona_segura"] == 1
    assert by_role["docente"]["recibido"] == 1
    assert by_role["administrativo"]["recibido"] == 1

    # 4. Directivo valida borrador CAP y registra decisión de continuidad
    draft = client.post(
        "/api/alerts",
        json={
            "level": "ATENCION_PREVENTIVA",
            "severity": "NARANJA",
            "what_happens": "Borrador operativo",
            "what_to_do": "Migrar a aula virtual",
            "status": "borrador_pendiente_validacion",
        },
    ).json()
    validated = client.patch(
        f"/api/alerts/{draft['id']}/validate",
        json={"validated_by_role": "directivo", "send_whatsapp": False, "offline": True},
    )
    assert validated.status_code == 200
    assert validated.json()["validated_by_role"] == "directivo"

    dec = client.post(
        "/api/continuity/decisions",
        json={
            "scope": "academica",
            "target_area": "Todas las facultades UNT",
            "measure": "Migrar clases teóricas a aula virtual UNT",
            "valid_until": "Hoy 22:00",
            "decided_by_role": "directivo",
        },
    )
    assert dec.status_code == 201
    assert dec.json()["decided_by_role"] == "directivo"

    client.post("/api/simulation/live/stop")
