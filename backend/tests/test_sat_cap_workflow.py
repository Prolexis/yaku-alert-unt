from fastapi.testclient import TestClient

from app.db import DEMO_DEFAULT_PASSWORD, init_db
from app.main import app

client = TestClient(app)


def test_five_demo_roles_authentication(tmp_path, monkeypatch):
    monkeypatch.setenv("YAKU_DB_PATH", str(tmp_path / "sat_auth.db"))
    init_db()

    # Verificar que se sembraron exactamente las 5 cuentas demo sin PII
    res_users = client.get("/api/auth/demo-users")
    assert res_users.status_code == 200
    users = res_users.json()["users"]
    roles = {u["role"] for u in users}
    assert roles == {"estudiante", "docente", "administrativo", "directivo", "operador_riesgos"}

    # Login por email + password con PBKDF2-SHA256
    res_login = client.post(
        "/api/auth/demo-login",
        json={"email": "directivo@unt.demo", "password": DEMO_DEFAULT_PASSWORD},
    )
    assert res_login.status_code == 200
    assert res_login.json()["user"]["role"] == "directivo"
    assert res_login.json()["token"].startswith("yaku-demo-directivo-")

    # Contraseña incorrecta -> 401
    res_bad = client.post(
        "/api/auth/demo-login",
        json={"email": "directivo@unt.demo", "password": "wrong"},
    )
    assert res_bad.status_code == 401

    # Login rápido en 1 clic por quick_role para los 5 roles
    for role in ("estudiante", "docente", "administrativo", "directivo", "operador_riesgos"):
        r = client.post("/api/auth/demo-login", json={"quick_role": role})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == role


def test_cap_12_human_validation_and_receipt_confirmations(tmp_path, monkeypatch):
    monkeypatch.setenv("YAKU_DB_PATH", str(tmp_path / "sat_cap.db"))
    init_db()

    # 1. Crear alerta en borrador pendiente de validación humana
    res_draft = client.post(
        "/api/alerts",
        json={
            "severity": "NARANJA",
            "what_happens": "Lluvia intensa prevista (>15 mm/h) con acumulación en Puerta 4",
            "where_zone": "Puerta 4 (Av. Jesús de Nazareth) y CIDUNT",
            "when_window": "Hoy 16:00 – 20:00 (Lima)",
            "what_to_do": "Migrar clases teóricas a aula virtual UNT y evacuar hacia Explanada Sociales.",
            "issuer": "Yaku Alert UNT — Validación Humana (Ejemplo no oficial)",
            "target_roles": ["estudiante", "docente", "administrativo"],
            "status": "borrador_pendiente_validacion",
        },
    )
    assert res_draft.status_code == 201
    draft = res_draft.json()
    assert draft["status"] == "borrador_pendiente_validacion"
    assert draft["active"] is False
    assert draft["cap_identifier"].startswith("YAKU-UNT-CAP-")

    # Un borrador no aparece en active_only=true
    assert client.get("/api/alerts?active_only=true").json()["total_active"] == 0

    # 2. Validación humana obligatoria por Directivo
    res_val = client.patch(
        f"/api/alerts/{draft['id']}/validate",
        json={"validated_by_role": "directivo"},
    )
    assert res_val.status_code == 200
    validated = res_val.json()
    assert validated["status"] == "emitida"
    assert validated["active"] is True
    assert validated["validated_by_role"] == "directivo"
    assert validated["validated_at"] is not None

    # 3. Exportación CAP 1.2 (JSON y XML)
    res_cap_json = client.get(f"/api/alerts/{draft['id']}/cap?format=json")
    assert res_cap_json.status_code == 200
    cap_body = res_cap_json.json()
    assert cap_body["cap_json"]["standard"].startswith("CAP 1.2")
    assert "no oficial" in cap_body["cap_json"]["note"].lower()
    assert cap_body["cap_json"]["info"]["instruction"] == validated["what_to_do"]

    res_cap_xml = client.get(f"/api/alerts/{draft['id']}/cap?format=xml")
    assert res_cap_xml.status_code == 200
    assert "urn:oasis:names:tc:emergency:cap:1.2" in res_cap_xml.text
    assert "<instruction>" in res_cap_xml.text

    # 4. Confirmación de recepción (Etapa 5 SAT) por Estudiante y Docente
    c1 = client.post(
        f"/api/alerts/{draft['id']}/confirm",
        json={"role": "estudiante", "status": "en_zona_segura"},
    )
    assert c1.status_code == 201
    assert c1.json()["confirmations"]["en_zona_segura"] == 1

    c2 = client.post(
        f"/api/alerts/{draft['id']}/confirm",
        json={"role": "docente", "status": "recibido"},
    )
    assert c2.status_code == 201
    summary = c2.json()["confirmations"]
    assert summary["total"] == 2
    assert summary["recibido"] == 1
    assert summary["en_zona_segura"] == 1
    assert summary["by_role"]["estudiante"]["en_zona_segura"] == 1
    assert summary["by_role"]["docente"]["recibido"] == 1


def test_simulations_history_and_continuity_decisions(tmp_path, monkeypatch):
    monkeypatch.setenv("YAKU_DB_PATH", str(tmp_path / "sat_sim_cont.db"))
    init_db()

    # Registro de simulacro (Pilar 4)
    res_sim = client.post(
        "/api/simulations/history",
        json={
            "scenario_name": "Simulacro Ciclón Yaku 2023 (35 mm)",
            "params": {"drainage_state": "obstruido", "inflow_p4": "alto"},
            "peak_hour": 6,
            "max_depth_cm": 18.5,
            "affected_gates": ["P4", "P3"],
            "affected_buildings_count": 14,
            "executed_by_role": "operador_riesgos",
        },
    )
    assert res_sim.status_code == 201
    assert res_sim.json()["max_depth_cm"] == 18.5

    res_hist = client.get("/api/simulations/history")
    assert res_hist.status_code == 200
    assert res_hist.json()["total"] == 1

    # Decisiones de continuidad académica y administrativa
    res_dec = client.post(
        "/api/continuity/decisions",
        json={
            "scope": "academica",
            "target_area": "Facultad de Ingeniería",
            "measure": "Clases teóricas en aula virtual UNT; laboratorios reprogramados sin penalización.",
            "valid_until": "Hoy 22:00 (Lima)",
            "decided_by_role": "directivo",
        },
    )
    assert res_dec.status_code == 201
    dec = res_dec.json()
    assert dec["active"] is True

    res_list = client.get("/api/continuity/decisions?active_only=true")
    assert res_list.status_code == 200
    assert res_list.json()["total_active"] == 1

    res_res = client.patch(f"/api/continuity/decisions/{dec['id']}/resolve")
    assert res_res.status_code == 200
    assert res_res.json()["active"] is False
