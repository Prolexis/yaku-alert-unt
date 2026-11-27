"""Sincronización en tiempo real Web → APK Android (WebSockets) y notificaciones push de simulacros.

Fuente de verdad del simulacro público en el servidor:
- session_id
- scenario_id ("evento_2017_03" | "evento_2023_03_10")
- status ("idle" | "published" | "playing" | "paused" | "finished")
- simulated_hour (1..total_hours)
- revision (entero monótono creciente para descartar eventos antiguos)
- published_at
- updated_at
- is_public
- result_reference (referencia ligera a resultados verificables de hydro.py, sin mallas completas)
"""
from __future__ import annotations

import asyncio
import json
import os
import secrets
from datetime import datetime, timezone
from typing import Any, Callable, Literal

import httpx
from fastapi import WebSocket
from shapely.geometry import shape

from app.db import list_active_mobile_devices
from app.services.spatial import load_campus_geojson

DrillStatus = Literal["idle", "published", "playing", "paused", "finished"]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_campus_centroids() -> dict[str, dict[str, Any]]:
    """Mapa id -> {name, lat, lon, category} a partir de campus_unt.geojson real."""
    geo = load_campus_geojson()
    lookup: dict[str, dict[str, Any]] = {}
    for feat in geo.get("features", []):
        props = feat.get("properties") or {}
        fid = str(props.get("id") or "").strip()
        if not fid:
            continue
        geom_raw = feat.get("geometry")
        if not geom_raw:
            continue
        try:
            geom = shape(geom_raw)
            c = geom.centroid
            lat, lon = round(float(c.y), 6), round(float(c.x), 6)
        except Exception:
            continue
        name = str(props.get("name") or "").strip()
        lookup[fid] = {
            "id": fid,
            "name": name or f"Instalación UNT ({fid})",
            "lat": lat,
            "lon": lon,
            "category": str(props.get("category") or "edificio"),
        }
    return lookup


def _is_named_facility(name: str) -> bool:
    clean = (name or "").strip()
    if not clean:
        return False
    return not clean.lower().startswith("edificio sin nombre")


def get_push_config_status() -> dict[str, Any]:
    """Reporta con honestidad el estado de configuración de notificaciones remotas FCM."""
    fcm_project_id = os.getenv("FCM_PROJECT_ID", "").strip()
    fcm_creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    fcm_service_json = os.getenv("FCM_SERVICE_ACCOUNT_JSON", "").strip()
    fcm_server_key = os.getenv("FCM_SERVER_KEY", "").strip()

    has_fcm_v1 = bool(fcm_project_id and (fcm_service_json or (fcm_creds_path and os.path.exists(fcm_creds_path))))
    has_fcm_legacy = bool(fcm_server_key)
    fcm_configured = has_fcm_v1 or has_fcm_legacy

    missing: list[str] = []
    if not fcm_configured:
        if not fcm_project_id:
            missing.append("FCM_PROJECT_ID")
        if not (fcm_service_json or (fcm_creds_path and os.path.exists(fcm_creds_path))):
            missing.append("GOOGLE_APPLICATION_CREDENTIALS (o FCM_SERVICE_ACCOUNT_JSON)")
        missing.append("frontend/android/app/google-services.json")

    active_transports = ["websocket_realtime", "capacitor_native_local_notifications"]
    if fcm_configured:
        active_transports.append("fcm_remote_push")

    return {
        "fcm_configured": fcm_configured,
        "fcm_mode": "http_v1" if has_fcm_v1 else ("legacy_http" if has_fcm_legacy else "unconfigured"),
        "active_transports": active_transports,
        "missing_credentials": missing,
        "honest_status": (
            "FCM remoto configurado y activo."
            if fcm_configured
            else (
                "Sincronización WebSocket en tiempo real y notificaciones nativas Android (Capacitor LocalNotifications) "
                "operativas en red local. Para push remoto FCM con la app completamente cerrada sin WebSocket, "
                "se requieren credenciales de Firebase Cloud Messaging."
            )
        ),
    }


async def _dispatch_fcm_if_configured(notification: dict[str, Any]) -> dict[str, Any]:
    """Envía push remoto FCM solo si existen credenciales reales configuradas."""
    status = get_push_config_status()
    devices = [d for d in list_active_mobile_devices() if d.get("fcm_token")]
    if not status["fcm_configured"]:
        return {
            "fcm_attempted": False,
            "fcm_sent": 0,
            "registered_devices_with_token": len(devices),
            "reason": "fcm_credentials_not_configured",
        }
    if not devices:
        return {
            "fcm_attempted": False,
            "fcm_sent": 0,
            "registered_devices_with_token": 0,
            "reason": "no_registered_fcm_tokens",
        }

    fcm_server_key = os.getenv("FCM_SERVER_KEY", "").strip()
    sent = 0
    if fcm_server_key:
        headers = {
            "Authorization": f"key={fcm_server_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=6.0) as client:
            for dev in devices:
                payload = {
                    "to": dev["fcm_token"],
                    "notification": {
                        "title": notification["title"],
                        "body": notification["body"],
                    },
                    "data": {
                        "notification_id": notification["notification_id"],
                        "session_id": notification["session_id"],
                        "scenario_id": notification["scenario_id"],
                        "simulated_hour": str(notification["simulated_hour"]),
                        "facility_id": str(notification.get("facility_id") or ""),
                        "facility_name": str(notification.get("facility_name") or ""),
                        "lat": str(notification.get("lat") or ""),
                        "lon": str(notification.get("lon") or ""),
                        "subtitle": notification["subtitle"],
                    },
                }
                try:
                    resp = await client.post(
                        "https://fcm.googleapis.com/fcm/send",
                        headers=headers,
                        json=payload,
                    )
                    if resp.status_code == 200:
                        sent += 1
                except Exception:
                    continue

    return {
        "fcm_attempted": True,
        "fcm_sent": sent,
        "registered_devices_with_token": len(devices),
        "reason": "dispatched",
    }


class DrillSyncManager:
    """Gestor autoritativo en servidor para la sesión pública de simulacro y difusión WebSocket."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._connections: set[WebSocket] = set()
        self._centroids: dict[str, dict[str, Any]] | None = None
        self._sent_notification_ids: set[str] = set()
        self._session: dict[str, Any] = self._build_idle_session(revision=0)
        self._last_notification: dict[str, Any] | None = None

    def _get_centroids(self) -> dict[str, dict[str, Any]]:
        if self._centroids is None:
            self._centroids = _build_campus_centroids()
        return self._centroids

    def _build_idle_session(self, revision: int = 0) -> dict[str, Any]:
        return {
            "session_id": "idle",
            "scenario_id": None,
            "scenario_title": None,
            "status": "idle",
            "simulated_hour": 1,
            "total_hours": 24,
            "revision": revision,
            "published_at": None,
            "updated_at": _now_iso(),
            "is_public": False,
            "published_by_role": None,
            "result_reference": None,
        }

    def get_state_snapshot(self) -> dict[str, Any]:
        return {
            "type": "drill_state",
            "session": dict(self._session),
            "notification": dict(self._last_notification) if self._last_notification else None,
            "connected_clients": len(self._connections),
            "push_status": get_push_config_status(),
        }

    def reset_for_tests(self) -> None:
        self._sent_notification_ids.clear()
        self._last_notification = None
        self._session = self._build_idle_session(revision=0)

    def _compute_result_reference(
        self,
        scenario_id: str,
        sim_payload: dict[str, Any],
        simulated_hour: int,
    ) -> dict[str, Any]:
        centroids = self._get_centroids()
        frames = sim_payload.get("frames") or []
        total_hours = len(frames) or 24
        clamped_hour = max(1, min(int(simulated_hour), total_hours))
        frame = frames[clamped_hour - 1] if frames else {}

        elements = sim_payload.get("elements") or []
        affected_all: list[dict[str, Any]] = []
        affected_at_hour: list[dict[str, Any]] = []

        for el in elements:
            first_hr = el.get("first_hour_affected")
            if first_hr is None:
                continue
            fid = str(el.get("id") or "")
            c_info = centroids.get(fid, {})
            raw_name = str(el.get("name") or c_info.get("name") or fid)
            entry = {
                "id": fid,
                "name": raw_name,
                "is_named": _is_named_facility(raw_name),
                "first_hour_affected": int(first_hr),
                "peak_hour": int(el.get("peak_hour") or first_hr),
                "max_depth_cm": round(float(el.get("max_depth_cm") or 0.0), 1),
                "lat": c_info.get("lat", -8.11473),
                "lon": c_info.get("lon", -79.03923),
            }
            affected_all.append(entry)
            if int(first_hr) <= clamped_hour:
                affected_at_hour.append(entry)

        # Priorizar instalaciones con nombre propio (ej. Comedor Universitario, Puerta 4, Biblioteca, etc.)
        affected_all.sort(
            key=lambda x: (1 if x["is_named"] else 0, x["max_depth_cm"]),
            reverse=True,
        )
        affected_at_hour.sort(
            key=lambda x: (1 if x["is_named"] else 0, x["max_depth_cm"]),
            reverse=True,
        )

        focus_facility = (
            affected_at_hour[0]
            if affected_at_hour
            else (affected_all[0] if affected_all else None)
        )

        summary = sim_payload.get("summary") or {}
        preset_meta = sim_payload.get("public_preset") or {}
        evaluation = sim_payload.get("evaluation") or {}

        return {
            "preset_id": scenario_id,
            "endpoint": f"/api/public/simulation/{scenario_id}",
            "title": preset_meta.get("title") or scenario_id,
            "total_mm": preset_meta.get("total_mm") or summary.get("total_rainfall_mm") or 0.0,
            "simulated_hour": clamped_hour,
            "hour_label": frame.get("label") or f"h+{clamped_hour}",
            "rain_at_hour_mm": round(float(frame.get("rain_mm") or 0.0), 2),
            "max_depth_at_hour_cm": round(float(frame.get("max_depth_cm") or 0.0), 1),
            "wet_cells_at_hour": int(frame.get("wet_cells") or 0),
            "peak_depth_cm": round(float(summary.get("max_depth_cm") or 0.0), 1),
            "peak_hour": int(summary.get("peak_hour") or 1),
            "preventive_level": evaluation.get("preventive_level") or "VIGILANCIA_PREVENTIVA",
            "affected_count_total": len(affected_all),
            "affected_count_at_hour": len(affected_at_hour),
            "affected_facilities_at_hour": affected_at_hour[:6],
            "focus_facility": focus_facility,
        }

    async def publish_drill(
        self,
        *,
        scenario_id: str,
        sim_loader: Callable[[str], dict[str, Any]],
        published_by_role: str,
        initial_hour: int = 1,
    ) -> dict[str, Any]:
        sim_payload = sim_loader(scenario_id)
        frames = sim_payload.get("frames") or []
        total_hours = len(frames) or 24
        clamped_hour = max(1, min(int(initial_hour), total_hours))
        preset_meta = sim_payload.get("public_preset") or {}
        scenario_title = preset_meta.get("title") or f"Escenario {scenario_id}"

        async with self._lock:
            next_rev = int(self._session.get("revision", 0)) + 1
            session_id = f"drill-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{secrets.token_hex(3)}"
            now = _now_iso()
            ref = self._compute_result_reference(scenario_id, sim_payload, clamped_hour)
            focus = ref.get("focus_facility")

            self._sent_notification_ids.clear()
            notif_id = f"{session_id}-publish"
            self._sent_notification_ids.add(notif_id)

            notification = {
                "notification_id": notif_id,
                "kind": "drill_published",
                "session_id": session_id,
                "scenario_id": scenario_id,
                "scenario_title": scenario_title,
                "title": "YAKU ALERT · SIMULACRO",
                "body": "Se ha iniciado una simulación educativa en la UNT. Toca para consultar el mapa. No es una emergencia real.",
                "subtitle": "Simulación educativa. No es una emergencia real.",
                "simulated_hour": focus["first_hour_affected"] if focus else clamped_hour,
                "facility_id": focus["id"] if focus else None,
                "facility_name": focus["name"] if focus else "Ciudad Universitaria UNT",
                "lat": focus["lat"] if focus else -8.11473,
                "lon": focus["lon"] if focus else -79.03923,
                "max_depth_cm": focus["max_depth_cm"] if focus else ref["peak_depth_cm"],
                "created_at": now,
            }

            self._session = {
                "session_id": session_id,
                "scenario_id": scenario_id,
                "scenario_title": scenario_title,
                "status": "published",
                "simulated_hour": clamped_hour,
                "total_hours": total_hours,
                "revision": next_rev,
                "published_at": now,
                "updated_at": now,
                "is_public": True,
                "published_by_role": published_by_role,
                "result_reference": ref,
            }
            self._last_notification = notification

        push_delivery = await _dispatch_fcm_if_configured(notification)
        await self.broadcast_state(event_type="drill_published", notification=notification)
        snap = self.get_state_snapshot()
        snap["push_delivery"] = push_delivery
        return snap

    async def control_drill(
        self,
        *,
        action: Literal["play", "pause", "resume", "set_hour", "notify_facility"],
        sim_loader: Callable[[str], dict[str, Any]],
        simulated_hour: int | None = None,
        controlled_by_role: str = "operador_riesgos",
    ) -> dict[str, Any]:
        async with self._lock:
            if not self._session.get("is_public") or not self._session.get("scenario_id"):
                raise ValueError("No existe un simulacro público activo para controlar.")

            scenario_id = str(self._session["scenario_id"])
            sim_payload = sim_loader(scenario_id)
            total_hours = int(self._session.get("total_hours") or 24)
            current_hour = int(self._session.get("simulated_hour") or 1)
            next_hour = (
                max(1, min(int(simulated_hour), total_hours))
                if simulated_hour is not None
                else current_hour
            )

            current_status: DrillStatus = self._session["status"]
            if action in ("play", "resume"):
                next_status: DrillStatus = "playing"
            elif action == "pause":
                next_status = "paused"
            else:
                next_status = current_status

            next_rev = int(self._session.get("revision", 0)) + 1
            now = _now_iso()
            ref = self._compute_result_reference(scenario_id, sim_payload, next_hour)

            self._session.update(
                {
                    "status": next_status,
                    "simulated_hour": next_hour,
                    "revision": next_rev,
                    "updated_at": now,
                    "published_by_role": controlled_by_role,
                    "result_reference": ref,
                }
            )

            # Verificar si corresponde emitir un aviso contextual verificable (sin duplicar por fotograma)
            new_notification: dict[str, Any] | None = None
            focus = ref.get("focus_facility")
            at_hour_list = ref.get("affected_facilities_at_hour") or []
            target_fac = at_hour_list[0] if at_hour_list else (focus if action == "notify_facility" else None)

            if target_fac and float(target_fac.get("max_depth_cm") or 0.0) >= 2.0:
                fac_notif_id = f"{self._session['session_id']}-fac-{target_fac['id']}"
                should_emit = (
                    action == "notify_facility"
                    or int(target_fac.get("first_hour_affected") or 0) == next_hour
                )
                if should_emit and fac_notif_id not in self._sent_notification_ids:
                    self._sent_notification_ids.add(fac_notif_id)
                    target_hr = (
                        next_hour
                        if int(target_fac.get("first_hour_affected") or 1) <= next_hour
                        else int(target_fac.get("first_hour_affected") or next_hour)
                    )
                    new_notification = {
                        "notification_id": fac_notif_id,
                        "kind": "facility_accumulation",
                        "session_id": self._session["session_id"],
                        "scenario_id": scenario_id,
                        "scenario_title": self._session["scenario_title"],
                        "title": "YAKU ALERT · SIMULACRO",
                        "body": (
                            f"El modelo representa acumulación de agua cerca de {target_fac['name']}. "
                            "Consulta el mapa."
                        ),
                        "subtitle": "Simulación educativa. No es una emergencia real.",
                        "simulated_hour": target_hr,
                        "facility_id": target_fac["id"],
                        "facility_name": target_fac["name"],
                        "lat": target_fac["lat"],
                        "lon": target_fac["lon"],
                        "max_depth_cm": target_fac["max_depth_cm"],
                        "created_at": now,
                    }
                    self._last_notification = new_notification

        push_delivery = None
        if new_notification is not None:
            push_delivery = await _dispatch_fcm_if_configured(new_notification)

        await self.broadcast_state(
            event_type="drill_updated",
            notification=new_notification,
        )
        snap = self.get_state_snapshot()
        if push_delivery is not None:
            snap["push_delivery"] = push_delivery
        return snap

    async def finish_drill(self, *, finished_by_role: str) -> dict[str, Any]:
        async with self._lock:
            next_rev = int(self._session.get("revision", 0)) + 1
            now = _now_iso()
            self._session.update(
                {
                    "status": "finished",
                    "revision": next_rev,
                    "updated_at": now,
                    "is_public": False,
                    "published_by_role": finished_by_role,
                }
            )
            self._last_notification = None

        await self.broadcast_state(event_type="drill_finished", notification=None)
        return self.get_state_snapshot()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)
        try:
            await websocket.send_text(
                json.dumps(self.get_state_snapshot(), ensure_ascii=False)
            )
        except Exception:
            self._connections.discard(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def broadcast_state(
        self,
        *,
        event_type: str = "drill_state",
        notification: dict[str, Any] | None = None,
    ) -> None:
        payload = {
            "type": event_type,
            "session": dict(self._session),
            "notification": dict(notification) if notification else None,
            "connected_clients": len(self._connections),
        }
        message = json.dumps(payload, ensure_ascii=False)
        stale: list[WebSocket] = []
        for ws in list(self._connections):
            try:
                await ws.send_text(message)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self._connections.discard(ws)


drill_sync_manager = DrillSyncManager()
