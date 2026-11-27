from fastapi.testclient import TestClient

from app.db import DEMO_DEFAULT_PASSWORD, init_db
from app.main import app
from app.services.drill_sync import drill_sync_manager

client = TestClient(app)


def _get_token(role: str) -> str:
    res = client.post("/api/auth/demo-login", json={"quick_role": role})
    assert res.status_code == 200
    return res.json()["token"]


def test_drill_publish_requires_real_admin_authorization(tmp_path, monkeypatch):
    monkeypatch.setenv("YAKU_DB_PATH", str(tmp_path / "drill_auth.db"))
    init_db()
    drill_sync_manager.reset_for_tests()

    # 1. Sin token -> 401
    r_no_auth = client.post("/api/drill/publish", json={"scenario_id": "evento_2017_03"})
    assert r_no_auth.status_code == 401

    # 2. Con token falsificado -> 401
    r_forged = client.post(
        "/api/drill/publish",
        json={"scenario_id": "evento_2017_03"},
        headers={"Authorization": "Bearer yaku-demo-directivo-deadbeef.forgedsignature123456"},
    )
    assert r_forged.status_code == 401

    # 3. Con token real de estudiante (público) -> 403 Forbidden
    student_token = _get_token("estudiante")
    r_student = client.post(
        "/api/drill/publish",
        json={"scenario_id": "evento_2017_03"},
        headers={"Authorization": f"Bearer {student_token}"},
    )
    assert r_student.status_code == 403

    # 4. Con token real de operador_riesgos -> 200 OK
    admin_token = _get_token("operador_riesgos")
    r_admin = client.post(
        "/api/drill/publish",
        json={"scenario_id": "evento_2017_03", "initial_hour": 1},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r_admin.status_code == 200
    body = r_admin.json()
    assert body["session"]["status"] == "published"
    assert body["session"]["scenario_id"] == "evento_2017_03"
    assert body["session"]["is_public"] is True
    assert body["session"]["revision"] == 1
    assert body["notification"]["title"] == "YAKU ALERT · SIMULACRO"
    assert "no es una emergencia real" in body["notification"]["subtitle"].lower()


def test_drill_lifecycle_revisions_and_deduplication(tmp_path, monkeypatch):
    monkeypatch.setenv("YAKU_DB_PATH", str(tmp_path / "drill_lifecycle.db"))
    init_db()
    drill_sync_manager.reset_for_tests()

    admin_token = _get_token("directivo")
    headers = {"X-Yaku-Admin-Token": admin_token}

    # Estado inicial idle
    s0 = client.get("/api/public/drill/state").json()
    assert s0["session"]["status"] == "idle"
    assert s0["session"]["is_public"] is False
    assert s0["session"]["revision"] == 0

    # Publicar escenario 2023
    s1 = client.post(
        "/api/drill/publish",
        json={"scenario_id": "evento_2023_03_10", "initial_hour": 1},
        headers=headers,
    ).json()
    rev1 = s1["session"]["revision"]
    session_id = s1["session"]["session_id"]
    first_notif_id = s1["notification"]["notification_id"]
    assert rev1 == 1
    assert s1["session"]["status"] == "published"
    assert s1["session"]["result_reference"]["preset_id"] == "evento_2023_03_10"

    # Iniciar reproducción
    s2 = client.post(
        "/api/drill/control",
        json={"action": "play", "simulated_hour": 2},
        headers=headers,
    ).json()
    assert s2["session"]["status"] == "playing"
    assert s2["session"]["simulated_hour"] == 2
    assert s2["session"]["revision"] > rev1

    # Avanzar a hora pico y emitir aviso contextual por acumulación en instalación
    focus_fac = s2["session"]["result_reference"]["focus_facility"]
    target_hour = focus_fac["first_hour_affected"] if focus_fac else 5
    s3 = client.post(
        "/api/drill/control",
        json={"action": "notify_facility", "simulated_hour": target_hour},
        headers=headers,
    ).json()
    assert s3["session"]["simulated_hour"] == target_hour
    fac_notif = s3["notification"]
    assert fac_notif is not None
    assert fac_notif["notification_id"] != first_notif_id
    assert "acumulación de agua cerca de" in fac_notif["body"].lower()

    # Deduplicación: repetir la misma hora no debe volver a emitir la misma notificación en el evento
    s3_dup = client.post(
        "/api/drill/control",
        json={"action": "set_hour", "simulated_hour": target_hour},
        headers=headers,
    ).json()
    assert s3_dup["session"]["revision"] > s3["session"]["revision"]

    # Pausar
    s4 = client.post(
        "/api/drill/control",
        json={"action": "pause"},
        headers=headers,
    ).json()
    assert s4["session"]["status"] == "paused"

    # Finalizar simulacro
    s5 = client.post("/api/drill/finish", headers=headers).json()
    assert s5["session"]["status"] == "finished"
    assert s5["session"]["is_public"] is False
    assert s5["session"]["session_id"] == session_id


def test_websocket_sync_and_late_joiner(tmp_path, monkeypatch):
    monkeypatch.setenv("YAKU_DB_PATH", str(tmp_path / "drill_ws.db"))
    init_db()
    drill_sync_manager.reset_for_tests()

    admin_token = _get_token("operador_riesgos")
    headers = {"Authorization": f"Bearer {admin_token}"}

    with client.websocket_connect("/api/ws/drill") as ws1:
        initial = ws1.receive_json()
        assert initial["type"] == "drill_state"
        assert initial["session"]["status"] == "idle"

        # Publicar simulacro desde el administrador
        client.post(
            "/api/drill/publish",
            json={"scenario_id": "evento_2017_03", "initial_hour": 3},
            headers=headers,
        )
        msg_pub = ws1.receive_json()
        assert msg_pub["type"] == "drill_published"
        assert msg_pub["session"]["status"] == "published"
        assert msg_pub["session"]["simulated_hour"] == 3
        assert msg_pub["notification"]["scenario_id"] == "evento_2017_03"

        # Cliente que se conecta tarde recibe inmediatamente el estado vigente (hora 3, published)
        with client.websocket_connect("/api/ws/drill") as ws_late:
            late_state = ws_late.receive_json()
            assert late_state["session"]["status"] == "published"
            assert late_state["session"]["simulated_hour"] == 3
            assert late_state["session"]["scenario_id"] == "evento_2017_03"

            # Cambiar hora desde el administrador -> ambos clientes WebSocket lo reciben
            client.post(
                "/api/drill/control",
                json={"action": "play", "simulated_hour": 6},
                headers=headers,
            )
            upd1 = ws1.receive_json()
            upd2 = ws_late.receive_json()
            assert upd1["session"]["simulated_hour"] == 6
            assert upd2["session"]["simulated_hour"] == 6
            assert upd1["session"]["status"] == "playing"


def test_mobile_device_registration_and_push_status(tmp_path, monkeypatch):
    monkeypatch.setenv("YAKU_DB_PATH", str(tmp_path / "drill_devices.db"))
    init_db()

    res_reg = client.post(
        "/api/public/devices/register",
        json={
            "device_id": "android-unt-test-001",
            "fcm_token": None,
            "platform": "android",
            "notifications_enabled": True,
            "app_version": "1.0.0",
        },
    )
    assert res_reg.status_code == 200
    data = res_reg.json()
    assert data["device"]["device_id"] == "android-unt-test-001"
    assert data["device"]["notifications_enabled"] is True
    assert "websocket_realtime" in data["push_status"]["active_transports"]

    # Desactivar notificaciones
    res_off = client.post(
        "/api/public/devices/register",
        json={
            "device_id": "android-unt-test-001",
            "platform": "android",
            "notifications_enabled": False,
        },
    )
    assert res_off.status_code == 200
    assert res_off.json()["device"]["notifications_enabled"] is False
