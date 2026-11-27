from fastapi.testclient import TestClient

from app.db import get_latest_weather_snapshot, init_db, save_weather_snapshot
from app.main import app

client = TestClient(app)


def test_alerts_full_workflow(tmp_path, monkeypatch):
    monkeypatch.setenv("YAKU_DB_PATH", str(tmp_path / "alerts_test.db"))
    init_db()

    # Inicialmente sin alertas activas
    res_empty = client.get("/api/alerts")
    assert res_empty.status_code == 200
    assert res_empty.json()["total_active"] == 0

    # Emitir alerta desde Gestión
    payload = {
        "level": "ATENCION_PREVENTIVA",
        "target_profile": "student",
        "channel": "whatsapp",
        "title": "Vigilancia preventiva en Puerta 4",
        "message": "Evitar tránsito por Av. Jesús de Nazareth y usar rutas seguras.",
        "affected_zones": ["Puerta 4 (Av. Jesús de Nazareth)", "CIDUNT"],
    }
    res_post = client.post("/api/alerts", json=payload)
    assert res_post.status_code == 201
    created = res_post.json()
    assert created["id"] >= 1
    assert created["active"] is True
    assert created["level"] == "ATENCION_PREVENTIVA"
    assert created["affected_zones"] == payload["affected_zones"]

    # Consultar alertas activas (Vista Estudiante)
    res_get = client.get("/api/alerts?active_only=true")
    assert res_get.status_code == 200
    body = res_get.json()
    assert body["total_active"] == 1
    assert body["active_alerts"][0]["id"] == created["id"]

    # Resolver / cerrar alerta
    res_patch = client.patch(f"/api/alerts/{created['id']}/resolve")
    assert res_patch.status_code == 200
    assert res_patch.json()["active"] is False

    # Ya no debe figurar en activas
    res_after = client.get("/api/alerts?active_only=true")
    assert res_after.status_code == 200
    assert res_after.json()["total_active"] == 0

    # Alerta inexistente -> 404
    res_404 = client.patch("/api/alerts/99999/resolve")
    assert res_404.status_code == 404


def test_reports_anonymous_workflow(tmp_path, monkeypatch):
    monkeypatch.setenv("YAKU_DB_PATH", str(tmp_path / "reports_test.db"))
    init_db()

    # Reporte anónimo desde Estudiante (sin PII)
    res_post = client.post(
        "/api/reports",
        json={
            "category": "aniego",
            "zone_name": "Puerta 4 (Av. Jesús de Nazareth)",
            "lat": -8.11167,
            "lon": -79.03599,
            "severity": "alta",
            "note": "Acumulación de agua en vereda externa dificulta ingreso.",
        },
    )
    assert res_post.status_code == 201
    rep = res_post.json()
    assert rep["status"] == "pendiente"
    assert rep["severity"] == "alta"
    assert "dni" not in rep and "email" not in rep

    # Listar reportes y validar conteos
    res_get = client.get("/api/reports")
    assert res_get.status_code == 200
    data = res_get.json()
    assert len(data["reports"]) == 1
    assert data["counts"]["pendiente"] == 1

    # Gestión marca como verificado y luego atendido
    res_ver = client.patch(f"/api/reports/{rep['id']}/status", json={"status": "verificado"})
    assert res_ver.status_code == 200
    assert res_ver.json()["status"] == "verificado"

    res_att = client.patch(f"/api/reports/{rep['id']}/status", json={"status": "atendido"})
    assert res_att.status_code == 200
    assert res_att.json()["status"] == "atendido"

    # Reporte inexistente -> 404
    assert client.patch("/api/reports/99999/status", json={"status": "atendido"}).status_code == 404


def test_weather_snapshot_and_sources_status(tmp_path, monkeypatch):
    monkeypatch.setenv("YAKU_DB_PATH", str(tmp_path / "sources_test.db"))
    init_db()

    sample_raw = {
        "latitude": -8.11473,
        "longitude": -79.03923,
        "timezone": "America/Lima",
        "hourly": {
            "time": ["2026-11-26T22:00", "2026-11-26T23:00"],
            "precipitation": [0.0, 1.2],
            "precipitation_probability": [10, 45],
            "relative_humidity_2m": [75, 80],
            "wind_speed_10m": [11.0, 9.5],
            "wind_direction_10m": [210, 200],
            "temperature_2m": [22.0, 21.5],
            "apparent_temperature": [23.0, 22.5],
            "surface_pressure": [1011.2, 1010.8],
        },
    }
    snap_id = save_weather_snapshot(sample_raw, fetched_at_utc="2026-11-26T22:00:00+00:00")
    assert snap_id >= 1

    latest = get_latest_weather_snapshot()
    assert latest is not None
    assert latest["fetched_at_utc"] == "2026-11-26T22:00:00+00:00"

    # Offline weather debe priorizar el snapshot real en SQLite
    res_weather = client.get("/api/weather?offline=true")
    assert res_weather.status_code == 200
    w = res_weather.json()
    assert w["data_status"] == "OFFLINE_FALLBACK"
    assert "SQLite" in w["fetched_at_utc"]

    # Estado de fuentes de datos
    res_src = client.get("/api/sources/status")
    assert res_src.status_code == 200
    body = res_src.json()
    assert body["persistence"]["weather_snapshots"] == 1
    source_ids = {s["id"] for s in body["sources"]}
    assert {
        "open_meteo_forecast",
        "open_meteo_era5",
        "dem_osm_hydro",
        "sqlite_local",
        "sinagerd_official",
    }.issubset(source_ids)
