"""Pruebas automatizadas para la experiencia pública Estudiante / Visitante."""
from __future__ import annotations

import re

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_public_simulation_allows_only_2017_and_2023():
    for preset_id in ("evento_2017_03", "evento_2023_03_10"):
        resp = client.get(f"/api/public/simulation/{preset_id}")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["is_simulation"] is True
        assert data["public_preset"]["id"] == preset_id
        # No expone sensores IoT ni telemetría administrativa
        assert data.get("virtual_sensors") is None
        assert len(data["frames"]) == 48
        assert "tipo 2017" in data["public_preset"]["title"].lower() or "tipo 2023" in data["public_preset"]["title"].lower()

        # Reproducibilidad exacta
        resp2 = client.get(f"/api/public/simulation/{preset_id}")
        assert resp2.status_code == 200
        assert resp2.json()["run_id"] == data["run_id"]


def test_public_simulation_rejects_disallowed_presets():
    for bad in ("extremo_hipotetico", "evento_2025_03_29", "custom", "foo"):
        resp = client.get(f"/api/public/simulation/{bad}")
        assert resp.status_code == 400


def test_public_simulation_never_uses_prohibited_safety_terms():
    word_prohibited = re.compile(r"\b(segur[oa]s?|peligros[oa]s?)\b", re.IGNORECASE)
    for preset_id in ("evento_2017_03", "evento_2023_03_10"):
        resp = client.get(f"/api/public/simulation/{preset_id}")
        assert resp.status_code == 200
        assert not word_prohibited.search(resp.text)
