"""Servicio de difusión preventiva CAP 1.2 vía WhatsApp Cloud API (Meta Graph API).

Cumple principios de seguridad y privacidad:
- Credenciales exclusivamente vía variables de entorno (sin secretos en el repositorio).
- Respaldo automático limpio en modo offline o sandbox no configurado (no lanza excepciones).
- Enmascaramiento de números telefónicos en respuestas públicas (Ley N.° 29733).
"""
from __future__ import annotations

import re
from typing import Any, Sequence

import httpx

from app.config import get_whatsapp_settings

SANDBOX_ETHICAL_NOTICE = (
    "Envío restringido a números de prueba autorizados del equipo (Sandbox Meta — TRL 3–4)."
)


def mask_phone_number(phone: str) -> str:
    """Enmascara un número telefónico dejando visibles solo los primeros 3 y últimos 3 dígitos."""
    digits = re.sub(r"\D+", "", str(phone or ""))
    if len(digits) <= 6:
        return "***" if not digits else f"{digits[:2]}***"
    return f"{digits[:3]}****{digits[-3:]}"


def parse_recipients(raw: str | Sequence[str] | None) -> list[str]:
    """Normaliza una lista de números internacionales sin '+' ni espacios."""
    if not raw:
        return []
    items = raw.split(",") if isinstance(raw, str) else list(raw)
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in items:
        digits = re.sub(r"\D+", "", str(item or "").strip())
        if len(digits) >= 8 and digits not in seen:
            seen.add(digits)
            cleaned.append(digits)
    return cleaned


SEVERITY_BADGES: dict[str, tuple[str, str]] = {
    "VERDE": ("🟢", "Informativo · Operación normal"),
    "AMARILLO": ("🟡", "Vigilancia Preventiva"),
    "NARANJA": ("🟠", "Atención Preventiva"),
    "ROJO": ("🔴", "Preparación Crítica"),
}


def format_cap_whatsapp_message(alert_dict: dict[str, Any]) -> str:
    """Formatea una alerta con diseño visual limpio siguiendo la Anatomía oficial CAP 1.2."""
    severity = str(alert_dict.get("severity") or "AMARILLO").upper()
    emoji, sev_label = SEVERITY_BADGES.get(severity, ("🟡", "Vigilancia Preventiva"))
    cap_id = str(alert_dict.get("cap_identifier") or "YAKU-UNT-CAP").strip()
    what_happens = str(alert_dict.get("what_happens") or alert_dict.get("title") or "Evento preventivo en monitoreo").strip()
    where_zone = str(alert_dict.get("where_zone") or "Ciudad Universitaria UNT").strip()
    when_window = str(alert_dict.get("when_window") or "Próximas 24 horas").strip()
    what_to_do = str(alert_dict.get("what_to_do") or alert_dict.get("message") or "Seguir rutas seguras hacia cota alta.").strip()
    issuer = str(alert_dict.get("issuer") or "Yaku Alert UNT").strip()

    return (
        f"{emoji} *ALERTA {severity} · YAKU ALERT UNT*\n"
        f"`{cap_id}` · _{sev_label}_\n"
        f"────────────────────\n\n"
        f"🌧️ *Qué pasa:* {what_happens}\n"
        f"📍 *Dónde:* {where_zone}\n"
        f"🕒 *Cuándo:* {when_window}\n\n"
        f"🛡️ *Qué hacer:* {what_to_do}\n\n"
        f"────────────────────\n"
        f"🏛️ *Emite:* {issuer} (Validación humana · Prueba sandbox hackathon)\n"
        f"_Prototipo TRL 3–4 · NexoRisk · No sustituye avisos oficiales de SENAMHI, COEN ni INDECI._"
    )


def _resolve_default_recipients(target_roles: list[str] | None = None) -> list[str]:
    """Usa WHATSAPP_TEST_RECIPIENTS si está definido; si no, lee los números registrados en SQLite (users)."""
    cfg = get_whatsapp_settings()
    env_numbers = parse_recipients(cfg["test_recipients"])
    if env_numbers:
        return env_numbers
    from app.db import get_demo_whatsapp_recipients

    return parse_recipients(get_demo_whatsapp_recipients(target_roles=target_roles))


def get_whatsapp_channel_status() -> dict[str, Any]:
    """Devuelve estado del canal WhatsApp Cloud API sin exponer tokens ni números completos."""
    cfg = get_whatsapp_settings()
    recipients = _resolve_default_recipients()
    configured = bool(
        cfg["enabled"]
        and cfg["phone_number_id"]
        and cfg["access_token"]
        and len(recipients) > 0
    )
    return {
        "enabled": bool(cfg["enabled"]),
        "configured": configured,
        "mode": "sandbox_connected" if configured else "simulated",
        "api_version": cfg["api_version"],
        "recipients_count": len(recipients),
        "masked_recipients": [mask_phone_number(r) for r in recipients],
        "template_fallback_name": cfg["template_name"],
        "sandbox_notice": SANDBOX_ETHICAL_NOTICE,
    }


async def send_cap_alert_whatsapp(
    alert_dict: dict[str, Any],
    recipients: Sequence[str] | None = None,
    *,
    offline: bool = False,
    use_template_fallback: bool = False,
) -> dict[str, Any]:
    """Envía una alerta CAP 1.2 por WhatsApp Cloud API (Meta Graph API) con respaldo seguro."""
    cfg = get_whatsapp_settings()
    formatted_message = format_cap_whatsapp_message(alert_dict)
    target_roles = alert_dict.get("target_roles") if isinstance(alert_dict, dict) else None
    target_numbers = (
        parse_recipients(recipients)
        if recipients is not None
        else _resolve_default_recipients(target_roles=target_roles)
    )

    if (
        offline
        or not cfg["enabled"]
        or not cfg["phone_number_id"]
        or not cfg["access_token"]
        or not target_numbers
    ):
        return {
            "status": "simulated",
            "sent_count": 0,
            "reason": "WhatsApp sandbox no configurado o modo offline",
            "first_message_id": None,
            "formatted_message": formatted_message,
            "results": [],
            "sandbox_notice": SANDBOX_ETHICAL_NOTICE,
        }

    url = f"https://graph.facebook.com/{cfg['api_version']}/{cfg['phone_number_id']}/messages"
    headers = {
        "Authorization": f"Bearer {cfg['access_token']}",
        "Content-Type": "application/json",
    }

    results: list[dict[str, Any]] = []
    sent_count = 0
    first_message_id: str | None = None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            for number in target_numbers:
                masked = mask_phone_number(number)
                payload = {
                    "messaging_product": "whatsapp",
                    "to": number,
                    "type": "text",
                    "text": {
                        "preview_url": False,
                        "body": formatted_message,
                    },
                }
                try:
                    resp = await client.post(url, headers=headers, json=payload)
                    body = resp.json() if resp.content else {}

                    if 200 <= resp.status_code < 300:
                        messages = body.get("messages") or []
                        msg_id = messages[0].get("id") if messages else None
                        sent_count += 1
                        if not first_message_id and msg_id:
                            first_message_id = str(msg_id)
                        results.append({
                            "to_masked": masked,
                            "status": "sent",
                            "message_id": msg_id,
                            "detail": "Enviado vía WhatsApp Cloud API (Sandbox).",
                        })
                        continue

                    err_obj = body.get("error") if isinstance(body, dict) else {}
                    err_code = err_obj.get("code") if isinstance(err_obj, dict) else None
                    err_msg = (
                        err_obj.get("message")
                        if isinstance(err_obj, dict) and err_obj.get("message")
                        else f"HTTP {resp.status_code}"
                    )

                    # Error 131047: Ventana de conversación de 24 horas cerrada en Meta Sandbox
                    if err_code == 131047:
                        if use_template_fallback and cfg["template_name"]:
                            tpl_payload = {
                                "messaging_product": "whatsapp",
                                "to": number,
                                "type": "template",
                                "template": {
                                    "name": cfg["template_name"],
                                    "language": {"code": "en_US"},
                                },
                            }
                            tpl_resp = await client.post(url, headers=headers, json=tpl_payload)
                            tpl_body = tpl_resp.json() if tpl_resp.content else {}
                            if 200 <= tpl_resp.status_code < 300:
                                tpl_msgs = tpl_body.get("messages") or []
                                tpl_id = tpl_msgs[0].get("id") if tpl_msgs else None
                                sent_count += 1
                                if not first_message_id and tpl_id:
                                    first_message_id = str(tpl_id)
                                results.append({
                                    "to_masked": masked,
                                    "status": "sent_template_fallback",
                                    "message_id": tpl_id,
                                    "detail": f"Ventana 24 h cerrada; enviada plantilla '{cfg['template_name']}'.",
                                })
                                continue

                        results.append({
                            "to_masked": masked,
                            "status": "error",
                            "error_code": 131047,
                            "message_id": None,
                            "detail": "Envía un mensaje de prueba al número sandbox para abrir la ventana de 24 h.",
                        })
                    else:
                        results.append({
                            "to_masked": masked,
                            "status": "error",
                            "error_code": err_code,
                            "message_id": None,
                            "detail": f"Error Meta Graph API: {err_msg}",
                        })
                except httpx.TimeoutException:
                    results.append({
                        "to_masked": masked,
                        "status": "error",
                        "message_id": None,
                        "detail": "Tiempo de espera agotado al conectar con WhatsApp Cloud API (timeout 10 s).",
                    })
                except httpx.HTTPError as exc:
                    results.append({
                        "to_masked": masked,
                        "status": "error",
                        "message_id": None,
                        "detail": f"Error de red hacia Meta Graph API: {exc}",
                    })
    except Exception as exc:
        return {
            "status": "error",
            "sent_count": 0,
            "reason": f"Error inesperado en servicio WhatsApp: {exc}",
            "first_message_id": None,
            "formatted_message": formatted_message,
            "results": results,
            "sandbox_notice": SANDBOX_ETHICAL_NOTICE,
        }

    overall_status = "sent" if sent_count > 0 else "error"
    reason = (
        f"Enviado a {sent_count}/{len(target_numbers)} destinatario(s) de prueba."
        if sent_count > 0
        else (results[0]["detail"] if results else "No se pudo completar el envío.")
    )
    return {
        "status": overall_status,
        "sent_count": sent_count,
        "reason": reason,
        "first_message_id": first_message_id,
        "formatted_message": formatted_message,
        "results": results,
        "sandbox_notice": SANDBOX_ETHICAL_NOTICE,
    }
