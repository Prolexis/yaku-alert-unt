"""Web Push subscriptions and alert delivery for browser clients."""

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any

from app.db import delete_web_push_subscription, list_active_web_push_subscriptions

logger = logging.getLogger(__name__)


def _load_local_web_push_env() -> None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.is_file():
        return
    try:
        for line in env_path.read_text(encoding="utf-8").splitlines():
            clean = line.strip()
            if not clean or clean.startswith("#") or "=" not in clean:
                continue
            name, value = clean.split("=", 1)
            name = name.strip()
            value = value.strip().strip('"').strip("'")
            if name.startswith("WEB_PUSH_") and name not in os.environ:
                os.environ[name] = value
    except OSError:
        logger.warning("Could not read local Web Push configuration")


def web_push_config() -> dict[str, Any]:
    _load_local_web_push_env()
    public_key = os.getenv("WEB_PUSH_VAPID_PUBLIC_KEY", "").strip()
    private_key = os.getenv("WEB_PUSH_VAPID_PRIVATE_KEY_PATH", "").strip()
    if private_key and not Path(private_key).is_absolute():
        private_key = str((Path(__file__).resolve().parents[2] / private_key).resolve())
    enabled = bool(public_key and private_key and Path(private_key).is_file())
    return {"enabled": enabled, "public_key": public_key if enabled else ""}


def _send_one(subscription: dict[str, Any], payload: str, private_key: str, subject: str) -> bool:
    from pywebpush import WebPushException, webpush

    try:
        webpush(
            subscription_info=subscription,
            data=payload,
            vapid_private_key=private_key,
            vapid_claims={"sub": subject},
            ttl=3600,
        )
        return True
    except WebPushException as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status in (404, 410):
            delete_web_push_subscription(str(subscription.get("endpoint") or ""))
        logger.warning("Web Push delivery failed (status=%s): %s", status, exc)
    except Exception:
        logger.exception("Web Push delivery failed")
    return False


def _dispatch_sync(alert: dict[str, Any]) -> dict[str, int]:
    if alert.get("status") != "emitida" or alert.get("active") is False:
        return {"sent": 0, "failed": 0, "skipped": 1}
    target_roles = alert.get("target_roles") or []
    if target_roles and "estudiante" not in target_roles and alert.get("target_profile") != "all":
        return {"sent": 0, "failed": 0, "skipped": 1}
    config = web_push_config()
    if not config["enabled"]:
        return {"sent": 0, "failed": 0, "skipped": 1}

    subscriptions = list_active_web_push_subscriptions()
    if not subscriptions:
        return {"sent": 0, "failed": 0, "skipped": 1}

    private_key = os.getenv("WEB_PUSH_VAPID_PRIVATE_KEY_PATH", "").strip()
    if not Path(private_key).is_absolute():
        private_key = str((Path(__file__).resolve().parents[2] / private_key).resolve())
    payload = json.dumps(
        {
            "notification_id": f"cap-alert-{alert.get('id', 'unknown')}",
            "title": alert.get("title") or "YAKU ALERT · Aviso UNT",
            "body": alert.get("message") or alert.get("what_happens") or "Hay un nuevo aviso para la comunidad UNT.",
            "subtitle": "Aviso preventivo de YAKU ALERT. Sigue las indicaciones oficiales de la UNT.",
            "url": "/?mobile=1",
        },
        ensure_ascii=False,
    )
    subject = os.getenv("WEB_PUSH_VAPID_SUBJECT", "mailto:soporte@yaku-alert.unt").strip()
    sent = 0
    for row in subscriptions:
        try:
            subscription = json.loads(row["subscription_json"])
        except (TypeError, json.JSONDecodeError):
            continue
        if _send_one(subscription, payload, private_key, subject):
            sent += 1
    return {"sent": sent, "failed": len(subscriptions) - sent, "skipped": 0}


async def dispatch_alert_web_push(alert: dict[str, Any]) -> dict[str, int]:
    """Send an emitted alert without blocking the API event loop."""
    return await asyncio.to_thread(_dispatch_sync, alert)
