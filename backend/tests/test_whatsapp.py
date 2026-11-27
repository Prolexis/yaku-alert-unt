"""Pruebas unitarias para difusión preventiva CAP 1.2 vía WhatsApp Cloud API (con mock de httpx)."""
from __future__ import annotations

import httpx
from fastapi.testclient import TestClient

from app.db import init_db
from app.main import app
from app.services.whatsapp import (
    format_cap_whatsapp_message,
    mask_phone_number,
    send_cap_alert_whatsapp,
)


def _setup_temp_db(tmp_path, monkeypatch):
    db_file = tmp_path / "test_whatsapp.db"
    monkeypatch.setenv("YAKU_DB_PATH", str(db_file))
    init_db()
    return TestClient(app)


def test_cap_whatsapp_format_and_phone_masking():
    alert = {
        "severity": "NARANJA",
        "what_happens": "Lluvia intensa con aniego en Puerta 4",
        "where_zone": "Ciudad Universitaria UNT — Puerta 4 y CIDUNT",
        "when_window": "Hoy 16:00–22:00 (Hora Lima)",
        "what_to_do": "Evitar Puerta 4 y evacuar hacia PE-1 Explanada Sociales.",
        "issuer": "Yaku Alert UNT — Operador de Riesgos",
    }
    msg = format_cap_whatsapp_message(alert)
    assert "*ALERTA NARANJA · YAKU ALERT UNT*" in msg
    assert "*Qué pasa:* Lluvia intensa con aniego en Puerta 4" in msg
    assert "*Dónde:* Ciudad Universitaria UNT — Puerta 4 y CIDUNT" in msg
    assert "*Cuándo:* Hoy 16:00–22:00 (Hora Lima)" in msg
    assert "*Qué hacer:* Evitar Puerta 4 y evacuar hacia PE-1 Explanada Sociales." in msg
    assert "*Emite:* Yaku Alert UNT — Operador de Riesgos (Validación humana · Prueba sandbox hackathon)" in msg

    # Enmascaramiento Ley N.° 29733
    assert mask_phone_number("51999123456") == "519****456"
    assert mask_phone_number("+51 987 654 321") == "519****321"
    assert "999123456" not in mask_phone_number("51999123456")


def test_whatsapp_status_and_fallback_when_disabled(tmp_path, monkeypatch):
    client = _setup_temp_db(tmp_path, monkeypatch)
    monkeypatch.setenv("WHATSAPP_ENABLED", "false")
    monkeypatch.setenv("WHATSAPP_PHONE_NUMBER_ID", "")
    monkeypatch.setenv("WHATSAPP_ACCESS_TOKEN", "SUPER_SECRET_TOKEN_NEVER_EXPOSED")
    monkeypatch.setenv("WHATSAPP_TEST_RECIPIENTS", "51999888777")

    st = client.get("/api/whatsapp/status")
    assert st.status_code == 200
    body = st.json()
    assert body["configured"] is False
    assert body["recipients_count"] == 1
    assert body["masked_recipients"] == ["519****777"]
    assert "SUPER_SECRET_TOKEN_NEVER_EXPOSED" not in str(body)
    assert "51999888777" not in str(body)

    # Crear alerta y enviar con WHATSAPP_ENABLED=false -> modo simulado sin excepción
    created = client.post(
        "/api/alerts",
        json={
            "level": "ATENCION_PREVENTIVA",
            "title": "Prueba sandbox deshabilitado",
            "what_happens": "Prueba de respaldo offline",
            "what_to_do": "Mantener calma",
            "validated_by_role": "directivo",
        },
    )
    assert created.status_code == 201
    alert_id = created.json()["id"]

    resp = client.post(f"/api/alerts/{alert_id}/send-whatsapp", json={})
    assert resp.status_code == 200
    data = resp.json()
    assert data["whatsapp"]["status"] == "simulated"
    assert data["whatsapp"]["sent_count"] == 0
    assert data["alert"]["whatsapp_status"] == "simulado"


def test_whatsapp_real_send_saves_wamid_and_masks_numbers(tmp_path, monkeypatch):
    client = _setup_temp_db(tmp_path, monkeypatch)
    monkeypatch.setenv("WHATSAPP_ENABLED", "true")
    monkeypatch.setenv("WHATSAPP_API_VERSION", "v22.0")
    monkeypatch.setenv("WHATSAPP_PHONE_NUMBER_ID", "1234567890")
    monkeypatch.setenv("WHATSAPP_ACCESS_TOKEN", "FAKE_SANDBOX_TOKEN")
    monkeypatch.setenv("WHATSAPP_TEST_RECIPIENTS", "51999111222,51988333444")

    captured_calls = []

    class DummyResponse:
        status_code = 200
        content = b'{"messages":[{"id":"wamid.HBgLNTE5OTkxMTEyMjIVAgA"}]}'

        def json(self):
            return {"messages": [{"id": "wamid.HBgLNTE5OTkxMTEyMjIVAgA"}]}

    class DummyAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers=None, json=None):
            captured_calls.append({"url": url, "headers": headers, "json": json})
            return DummyResponse()

    monkeypatch.setattr(httpx, "AsyncClient", DummyAsyncClient)

    created = client.post(
        "/api/alerts",
        json={
            "level": "PREPARACION_CRITICA",
            "title": "Alerta Roja Simulacro",
            "what_happens": "Acumulación crítica en Puerta 4",
            "where_zone": "Puerta 4 y CIDUNT",
            "when_window": "Hora pico h+6",
            "what_to_do": "Cerrar Puerta 4 y evacuar a PE-1 Explanada Sociales",
            "validated_by_role": "operador_riesgos",
        },
    )
    assert created.status_code == 201
    alert_id = created.json()["id"]

    resp = client.post(f"/api/alerts/{alert_id}/send-whatsapp", json={})
    assert resp.status_code == 200
    data = resp.json()

    assert data["whatsapp"]["status"] == "sent"
    assert data["whatsapp"]["sent_count"] == 2
    assert data["whatsapp"]["first_message_id"] == "wamid.HBgLNTE5OTkxMTEyMjIVAgA"
    assert data["alert"]["whatsapp_status"] == "enviado"
    assert data["alert"]["whatsapp_message_id"] == "wamid.HBgLNTE5OTkxMTEyMjIVAgA"

    # Privacidad: ningún número completo ni token en la respuesta
    raw_resp = str(data)
    assert "51999111222" not in raw_resp
    assert "51988333444" not in raw_resp
    assert "FAKE_SANDBOX_TOKEN" not in raw_resp
    assert data["whatsapp"]["results"][0]["to_masked"] == "519****222"
    assert data["whatsapp"]["results"][1]["to_masked"] == "519****444"

    # Verificar llamada a Meta Graph API
    assert len(captured_calls) == 2
    assert captured_calls[0]["url"] == "https://graph.facebook.com/v22.0/1234567890/messages"
    assert captured_calls[0]["headers"]["Authorization"] == "Bearer FAKE_SANDBOX_TOKEN"
    assert captured_calls[0]["json"]["messaging_product"] == "whatsapp"
    assert "*ALERTA ROJO · YAKU ALERT UNT*" in captured_calls[0]["json"]["text"]["body"]


def test_whatsapp_handles_timeout_and_24h_window_cleanly(tmp_path, monkeypatch):
    client = _setup_temp_db(tmp_path, monkeypatch)
    monkeypatch.setenv("WHATSAPP_ENABLED", "true")
    monkeypatch.setenv("WHATSAPP_PHONE_NUMBER_ID", "1234567890")
    monkeypatch.setenv("WHATSAPP_ACCESS_TOKEN", "FAKE_SANDBOX_TOKEN")
    monkeypatch.setenv("WHATSAPP_TEST_RECIPIENTS", "51999111222")

    class TimeoutClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers=None, json=None):
            raise httpx.TimeoutException("timeout simulado")

    monkeypatch.setattr(httpx, "AsyncClient", TimeoutClient)

    created = client.post(
        "/api/alerts",
        json={
            "level": "VIGILANCIA_PREVENTIVA",
            "title": "Prueba timeout",
            "what_happens": "Lluvia moderada",
            "what_to_do": "Llevar paraguas",
            "validated_by_role": "directivo",
        },
    )
    alert_id = created.json()["id"]
    resp = client.post(f"/api/alerts/{alert_id}/send-whatsapp", json={})
    assert resp.status_code == 200
    data = resp.json()
    assert data["whatsapp"]["status"] == "error"
    assert data["alert"]["whatsapp_status"] == "error"
    assert "Tiempo de espera agotado" in data["whatsapp"]["reason"]

    # Error 131047 (ventana 24 h cerrada)
    class WindowClosedClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers=None, json=None):
            class ErrResp:
                status_code = 400
                content = b'{"error":{"code":131047,"message":"Re-engagement message"}}'

                def json(self):
                    return {"error": {"code": 131047, "message": "Re-engagement message"}}

            return ErrResp()

    monkeypatch.setattr(httpx, "AsyncClient", WindowClosedClient)
    resp_24h = client.post(f"/api/alerts/{alert_id}/send-whatsapp", json={})
    assert resp_24h.status_code == 200
    assert "ventana de 24 h" in resp_24h.json()["whatsapp"]["reason"]


def test_demo_student_phone_used_by_default_and_masked(tmp_path, monkeypatch):
    client = _setup_temp_db(tmp_path, monkeypatch)
    monkeypatch.setenv("WHATSAPP_ENABLED", "false")
    monkeypatch.setenv("WHATSAPP_TEST_RECIPIENTS", "")

    users_resp = client.get("/api/auth/demo-users")
    assert users_resp.status_code == 200
    student = next(u for u in users_resp.json()["users"] if u["role"] == "estudiante")
    assert student["whatsapp_phone_masked"] == "519****920"
    assert "997325920" not in str(users_resp.json())

    st = client.get("/api/whatsapp/status")
    assert st.status_code == 200
    assert st.json()["recipients_count"] == 1
    assert st.json()["masked_recipients"] == ["519****920"]
