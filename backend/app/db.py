"""Persistencia embebida SQLite (7 tablas) alineada a EW4All / SAT 5 etapas / CAP 1.2.

Tablas:
1. users: 5 cuentas sintéticas de demostración (PBKDF2-SHA256, 0 PII — Ley N.° 29733).
2. issued_alerts: alertas con Anatomía CAP 1.2 y validación humana obligatoria.
3. alert_confirmations: confirmación anónima de recepción (Etapa 5 SAT).
4. campus_reports: reportes comunitarios anónimos (0 PII).
5. simulation_runs: registro de simulacros y corridas (Pilar 4).
6. continuity_decisions: decisiones de continuidad académica y administrativa.
7. weather_time_series: series de tiempo Open-Meteo para trazabilidad y modo offline.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import xml.sax.saxutils as xmlutils
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_DB_PATH = Path(__file__).resolve().parent / "data" / "yaku_alert.db"

LEVEL_TO_CAP_SEVERITY = {
    "INFORMATIVO": "VERDE",
    "VIGILANCIA_PREVENTIVA": "AMARILLO",
    "ATENCION_PREVENTIVA": "NARANJA",
    "PREPARACION_CRITICA": "ROJO",
}

CAP_SEVERITY_TO_LEVEL = {v: k for k, v in LEVEL_TO_CAP_SEVERITY.items()}

DEMO_ACCOUNTS = [
    ("estudiante@unt.demo", "Estudiante UNT (Demo)", "estudiante", "51902455346"),
    ("docente@unt.demo", "Docente UNT (Demo)", "docente", None),
    ("admin.oficina@unt.demo", "Personal Administrativo UNT (Demo)", "administrativo", None),
    ("directivo@unt.demo", "Directivo / Decanato UNT (Demo)", "directivo", None),
    ("operador@unt.demo", "Operador de Gestión de Riesgos (Demo)", "operador_riesgos", None),
]
DEMO_DEFAULT_PASSWORD = "YakuDemo2026!"


def get_db_path() -> Path:
    env_path = os.getenv("YAKU_DB_PATH", "").strip()
    if env_path:
        return Path(env_path)
    return DEFAULT_DB_PATH


def _connect() -> sqlite3.Connection:
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _hash_password(password: str, salt: str) -> str:
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 60_000)
    return dk.hex()


def _ensure_columns(conn: sqlite3.Connection, table: str, columns: dict[str, str]) -> None:
    existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    for col, col_def in columns.items():
        if col not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")


def init_db() -> Path:
    db_path = get_db_path()
    with _connect() as conn:
        conn.execute("PRAGMA journal_mode=WAL;")

        # 1. users (5 cuentas sintéticas demo, PBKDF2-SHA256)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                display_name TEXT NOT NULL,
                role TEXT NOT NULL,
                whatsapp_phone TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        _ensure_columns(conn, "users", {"whatsapp_phone": "TEXT"})

        # 2. issued_alerts (Anatomía CAP 1.2 + Validación Humana)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS issued_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cap_identifier TEXT NOT NULL DEFAULT '',
                level TEXT NOT NULL DEFAULT 'VIGILANCIA_PREVENTIVA',
                severity TEXT NOT NULL DEFAULT 'AMARILLO',
                what_happens TEXT NOT NULL DEFAULT '',
                where_zone TEXT NOT NULL DEFAULT 'Ciudad Universitaria UNT',
                when_window TEXT NOT NULL DEFAULT 'Próximas 24 h',
                what_to_do TEXT NOT NULL DEFAULT '',
                issuer TEXT NOT NULL DEFAULT 'Yaku Alert UNT — Validación Humana (Ejemplo no oficial)',
                target_roles_json TEXT NOT NULL DEFAULT '["estudiante","docente","administrativo"]',
                target_profile TEXT NOT NULL DEFAULT 'all',
                channel TEXT NOT NULL DEFAULT 'campus_banner',
                title TEXT NOT NULL DEFAULT '',
                message TEXT NOT NULL DEFAULT '',
                affected_zones_json TEXT NOT NULL DEFAULT '[]',
                status TEXT NOT NULL DEFAULT 'emitida',
                active INTEGER NOT NULL DEFAULT 1,
                validated_by_role TEXT,
                validated_at TEXT,
                whatsapp_status TEXT NOT NULL DEFAULT 'no_enviado',
                whatsapp_message_id TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        _ensure_columns(
            conn,
            "issued_alerts",
            {
                "cap_identifier": "TEXT NOT NULL DEFAULT ''",
                "severity": "TEXT NOT NULL DEFAULT 'AMARILLO'",
                "what_happens": "TEXT NOT NULL DEFAULT ''",
                "where_zone": "TEXT NOT NULL DEFAULT 'Ciudad Universitaria UNT'",
                "when_window": "TEXT NOT NULL DEFAULT 'Próximas 24 h'",
                "what_to_do": "TEXT NOT NULL DEFAULT ''",
                "issuer": "TEXT NOT NULL DEFAULT 'Yaku Alert UNT — Validación Humana (Ejemplo no oficial)'",
                "target_roles_json": "TEXT NOT NULL DEFAULT '[\"estudiante\",\"docente\",\"administrativo\"]'",
                "status": "TEXT NOT NULL DEFAULT 'emitida'",
                "validated_by_role": "TEXT",
                "validated_at": "TEXT",
                "whatsapp_status": "TEXT NOT NULL DEFAULT 'no_enviado'",
                "whatsapp_message_id": "TEXT",
            },
        )

        # 3. alert_confirmations (Confirmación de recepción — Etapa 5 SAT)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS alert_confirmations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alert_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                status TEXT NOT NULL,
                confirmed_at TEXT NOT NULL,
                FOREIGN KEY (alert_id) REFERENCES issued_alerts(id)
            )
            """
        )

        # 4. campus_reports (Reportes comunitarios anónimos)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS campus_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                zone_name TEXT NOT NULL,
                lat REAL,
                lon REAL,
                severity TEXT NOT NULL DEFAULT 'media',
                note TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pendiente',
                verified_by_role TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        _ensure_columns(conn, "campus_reports", {"verified_by_role": "TEXT"})

        # 5. simulation_runs (Registro de simulacros y corridas — Pilar 4)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS simulation_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scenario_name TEXT NOT NULL,
                params_json TEXT NOT NULL DEFAULT '{}',
                peak_hour INTEGER NOT NULL DEFAULT 1,
                max_depth_cm REAL NOT NULL DEFAULT 0.0,
                affected_gates_json TEXT NOT NULL DEFAULT '[]',
                affected_buildings_count INTEGER NOT NULL DEFAULT 0,
                executed_by_role TEXT NOT NULL DEFAULT 'operador_riesgos',
                created_at TEXT NOT NULL
            )
            """
        )

        # 6. continuity_decisions (Decisiones de continuidad académica y administrativa)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS continuity_decisions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scope TEXT NOT NULL,
                target_area TEXT NOT NULL,
                measure TEXT NOT NULL,
                valid_until TEXT NOT NULL,
                decided_by_role TEXT NOT NULL DEFAULT 'directivo',
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            )
            """
        )

        # 7. weather_time_series (Base de datos de series de tiempo — Etapa 3 SAT)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS weather_time_series (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                max_precip_mm_h REAL,
                max_prob_24h_pct INTEGER,
                pressure_hpa REAL,
                wind_speed_kmh REAL,
                fetched_at_utc TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )

        # 8. active_simulation_state (Estado único de simulación en vivo Gestión -> Comunidad)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS active_simulation_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                active INTEGER NOT NULL DEFAULT 0,
                scenario_id TEXT NOT NULL DEFAULT '',
                scenario_label TEXT NOT NULL DEFAULT '',
                drainage_scenario TEXT NOT NULL DEFAULT 'base',
                params_json TEXT NOT NULL DEFAULT '{}',
                started_at TEXT,
                auto_alert_delay_sec INTEGER NOT NULL DEFAULT 10,
                alert_dispatched INTEGER NOT NULL DEFAULT 0,
                dispatched_alert_id INTEGER,
                confidence_pct INTEGER NOT NULL DEFAULT 0,
                confidence_factors_json TEXT NOT NULL DEFAULT '[]',
                activated_by_role TEXT NOT NULL DEFAULT 'operador_riesgos',
                result_json TEXT NOT NULL DEFAULT '{}',
                updated_at TEXT NOT NULL DEFAULT ''
            )
            """
        )

        # 9. mobile_devices (Registro consentido de dispositivos APK Android — 0 PII)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS mobile_devices (
                device_id TEXT PRIMARY KEY,
                fcm_token TEXT,
                platform TEXT NOT NULL DEFAULT 'android',
                notifications_enabled INTEGER NOT NULL DEFAULT 1,
                app_version TEXT NOT NULL DEFAULT '1.0.0',
                updated_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )

        # 10. Suscripciones consentidas de Web Push para el navegador móvil.
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS web_push_subscriptions (
                endpoint TEXT PRIMARY KEY,
                subscription_json TEXT NOT NULL,
                device_id TEXT NOT NULL DEFAULT '',
                notifications_enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        # Sembrar las 5 cuentas demo sintéticas (idempotente)
        now = _now_iso()
        for email, display_name, role, wa_phone in DEMO_ACCOUNTS:
            row = conn.execute(
                "SELECT id, whatsapp_phone FROM users WHERE email = ?", (email,)
            ).fetchone()
            if not row:
                salt = secrets.token_hex(16)
                pw_hash = _hash_password(DEMO_DEFAULT_PASSWORD, salt)
                conn.execute(
                    """
                    INSERT INTO users (email, password_hash, salt, display_name, role, whatsapp_phone, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (email, pw_hash, salt, display_name, role, wa_phone, now),
                )
            elif wa_phone and row["whatsapp_phone"] != wa_phone:
                conn.execute(
                    "UPDATE users SET whatsapp_phone = ? WHERE id = ?",
                    (wa_phone, row["id"]),
                )

        conn.commit()
    return db_path


# ---------------------------------------------------------------------------
# 1. Autenticación Demo (5 roles sintéticos — sin PII)
# ---------------------------------------------------------------------------
def _mask_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    digits = "".join(ch for ch in str(phone) if ch.isdigit())
    if len(digits) <= 6:
        return "***" if not digits else f"{digits[:2]}***"
    return f"{digits[:3]}****{digits[-3:]}"


def list_demo_users() -> list[dict[str, Any]]:
    init_db()
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, email, display_name, role, whatsapp_phone, created_at FROM users ORDER BY id ASC"
        ).fetchall()
    return [
        {
            "id": int(r["id"]),
            "email": str(r["email"]),
            "display_name": str(r["display_name"]),
            "role": str(r["role"]),
            "whatsapp_phone_masked": _mask_phone(r["whatsapp_phone"]),
            "created_at": str(r["created_at"]),
        }
        for r in rows
    ]


def get_demo_whatsapp_recipients(target_roles: list[str] | None = None) -> list[str]:
    """Devuelve teléfonos registrados en la tabla users para difusión sandbox."""
    init_db()
    with _connect() as conn:
        if target_roles:
            placeholders = ",".join("?" for _ in target_roles)
            rows = conn.execute(
                f"SELECT whatsapp_phone FROM users WHERE whatsapp_phone IS NOT NULL AND whatsapp_phone != '' AND role IN ({placeholders})",
                tuple(target_roles),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT whatsapp_phone FROM users WHERE whatsapp_phone IS NOT NULL AND whatsapp_phone != ''"
            ).fetchall()
    return [str(r["whatsapp_phone"]).strip() for r in rows if str(r["whatsapp_phone"]).strip()]


_ADMIN_TOKEN_SECRET = os.getenv(
    "YAKU_ADMIN_SECRET", "yaku-alert-unt-admin-hmac-secret-2026"
)
ADMIN_ROLES = ("directivo", "operador_riesgos")


def sign_demo_token(role: str) -> str:
    nonce = secrets.token_hex(8)
    payload = f"yaku-demo-{role}-{nonce}"
    sig = hmac.new(
        _ADMIN_TOKEN_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:24]
    return f"{payload}.{sig}"


def verify_admin_token(token: str | None) -> str | None:
    """Valida criptográficamente (HMAC-SHA256) que el token pertenezca a un rol administrativo."""
    if not token:
        return None
    clean = token.strip()
    if clean.lower().startswith("bearer "):
        clean = clean[7:].strip()
    if "." not in clean or not clean.startswith("yaku-demo-"):
        return None
    payload, sig = clean.rsplit(".", 1)
    expected_sig = hmac.new(
        _ADMIN_TOKEN_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:24]
    if not hmac.compare_digest(sig, expected_sig):
        return None
    parts = payload.split("-")
    if len(parts) < 4:
        return None
    role = "-".join(parts[2:-1])
    if role not in ADMIN_ROLES:
        return None
    return role


def authenticate_demo_user(
    *,
    email: str | None = None,
    password: str | None = None,
    quick_role: str | None = None,
) -> dict[str, Any] | None:
    init_db()
    with _connect() as conn:
        if quick_role:
            row = conn.execute(
                "SELECT * FROM users WHERE role = ? LIMIT 1", (quick_role.strip(),)
            ).fetchone()
            if row is None:
                return None
        elif email:
            row = conn.execute(
                "SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1", (email.strip(),)
            ).fetchone()
            if row is None:
                return None
            if not password:
                return None
            expected = _hash_password(password, str(row["salt"]))
            if not hmac.compare_digest(expected, str(row["password_hash"])):
                return None
        else:
            return None

    role_str = str(row["role"])
    token = sign_demo_token(role_str)
    return {
        "token": token,
        "user": {
            "email": str(row["email"]),
            "display_name": str(row["display_name"]),
            "role": role_str,
        },
        "demo_notice": "Cuenta sintética de demostración (0 PII — Ley N.° 29733).",
    }


# ---------------------------------------------------------------------------
# 2 & 3. Alertas CAP 1.2 + Validación Humana + Confirmación de Recepción
# ---------------------------------------------------------------------------
def _get_confirmations_summary(conn: sqlite3.Connection, alert_id: int) -> dict[str, Any]:
    rows = conn.execute(
        "SELECT role, status FROM alert_confirmations WHERE alert_id = ?", (alert_id,)
    ).fetchall()
    by_role: dict[str, dict[str, int]] = {}
    recibido = 0
    en_zona_segura = 0
    for r in rows:
        role = str(r["role"])
        st = str(r["status"])
        if role not in by_role:
            by_role[role] = {"recibido": 0, "en_zona_segura": 0, "total": 0}
        if st == "en_zona_segura":
            en_zona_segura += 1
            by_role[role]["en_zona_segura"] += 1
        else:
            recibido += 1
            by_role[role]["recibido"] += 1
        by_role[role]["total"] += 1
    return {
        "total": len(rows),
        "recibido": recibido,
        "en_zona_segura": en_zona_segura,
        "by_role": by_role,
    }


def _row_to_alert(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    try:
        zones = json.loads(row["affected_zones_json"] or "[]")
        if not isinstance(zones, list):
            zones = []
    except json.JSONDecodeError:
        zones = []
    try:
        target_roles = json.loads(row["target_roles_json"] or "[]")
        if not isinstance(target_roles, list):
            target_roles = ["estudiante", "docente", "administrativo"]
    except json.JSONDecodeError:
        target_roles = ["estudiante", "docente", "administrativo"]

    alert_id = int(row["id"])
    return {
        "id": alert_id,
        "cap_identifier": str(row["cap_identifier"] or f"YAKU-UNT-CAP-{alert_id:04d}"),
        "level": str(row["level"]),
        "severity": str(row["severity"] or LEVEL_TO_CAP_SEVERITY.get(str(row["level"]), "AMARILLO")),
        "what_happens": str(row["what_happens"] or row["title"] or ""),
        "where_zone": str(row["where_zone"] or (", ".join(zones) if zones else "Ciudad Universitaria UNT")),
        "when_window": str(row["when_window"] or "Próximas 24 horas"),
        "what_to_do": str(row["what_to_do"] or row["message"] or ""),
        "issuer": str(row["issuer"] or "Yaku Alert UNT — Validación Humana (Ejemplo no oficial)"),
        "target_roles": target_roles,
        "target_profile": str(row["target_profile"]),
        "channel": str(row["channel"]),
        "title": str(row["title"] or row["what_happens"]),
        "message": str(row["message"] or row["what_to_do"]),
        "affected_zones": zones,
        "status": str(row["status"] or ("emitida" if row["active"] else "resuelta")),
        "active": bool(row["active"]),
        "validated_by_role": str(row["validated_by_role"]) if row["validated_by_role"] else None,
        "validated_at": str(row["validated_at"]) if row["validated_at"] else None,
        "whatsapp_status": str(row["whatsapp_status"] or "no_enviado"),
        "whatsapp_message_id": str(row["whatsapp_message_id"]) if row["whatsapp_message_id"] else None,
        "created_at": str(row["created_at"]),
        "confirmations": _get_confirmations_summary(conn, alert_id),
    }


def update_alert_whatsapp_status(
    alert_id: int,
    whatsapp_status: str,
    whatsapp_message_id: str | None = None,
) -> dict[str, Any] | None:
    """Actualiza el estado de difusión WhatsApp y el wamid en SQLite."""
    init_db()
    with _connect() as conn:
        row = conn.execute("SELECT id FROM issued_alerts WHERE id = ?", (alert_id,)).fetchone()
        if row is None:
            return None
        conn.execute(
            """
            UPDATE issued_alerts
            SET whatsapp_status = ?, whatsapp_message_id = COALESCE(?, whatsapp_message_id)
            WHERE id = ?
            """,
            (whatsapp_status, whatsapp_message_id, alert_id),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM issued_alerts WHERE id = ?", (alert_id,)).fetchone()
        return _row_to_alert(conn, updated)


def create_alert(
    *,
    level: str = "VIGILANCIA_PREVENTIVA",
    severity: str | None = None,
    target_profile: str = "all",
    target_roles: list[str] | None = None,
    channel: str = "campus_banner",
    title: str = "",
    message: str = "",
    what_happens: str | None = None,
    where_zone: str | None = None,
    when_window: str | None = None,
    what_to_do: str | None = None,
    issuer: str | None = None,
    affected_zones: list[str] | None = None,
    status: str | None = None,
    validated_by_role: str | None = None,
) -> dict[str, Any]:
    init_db()
    now = _now_iso()

    resolved_severity = (severity or LEVEL_TO_CAP_SEVERITY.get(level, "AMARILLO")).upper()
    resolved_level = level or CAP_SEVERITY_TO_LEVEL.get(resolved_severity, "VIGILANCIA_PREVENTIVA")
    zones = affected_zones or ([where_zone] if where_zone else ["Ciudad Universitaria UNT"])
    roles = target_roles or ["estudiante", "docente", "administrativo"]

    # Validación humana: si viene validada por directivo/operador_riesgos o si no se especifica borrador
    resolved_status = status or (
        "emitida"
        if validated_by_role in ("directivo", "operador_riesgos")
        else "emitida"
    )
    is_active = 1 if resolved_status == "emitida" else 0
    val_at = now if (resolved_status == "emitida" and validated_by_role) else None

    clean_title = (title or what_happens or "Aviso preventivo UNT").strip()
    clean_message = (message or what_to_do or clean_title).strip()
    clean_what = (what_happens or clean_title).strip()
    clean_where = (where_zone or ", ".join(zones)).strip()
    clean_when = (when_window or "Próximas 24 horas").strip()
    clean_action = (what_to_do or clean_message).strip()
    clean_issuer = (
        issuer or "Yaku Alert UNT — Validación Humana (Mensaje de ejemplo, no oficial)"
    ).strip()

    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO issued_alerts (
                cap_identifier, level, severity, what_happens, where_zone, when_window,
                what_to_do, issuer, target_roles_json, target_profile, channel,
                title, message, affected_zones_json, status, active,
                validated_by_role, validated_at, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "",
                resolved_level,
                resolved_severity,
                clean_what,
                clean_where,
                clean_when,
                clean_action,
                clean_issuer,
                json.dumps(roles, ensure_ascii=False),
                target_profile,
                channel,
                clean_title,
                clean_message,
                json.dumps(zones, ensure_ascii=False),
                resolved_status,
                is_active,
                validated_by_role,
                val_at,
                now,
            ),
        )
        alert_id = int(cur.lastrowid)
        cap_id = f"YAKU-UNT-CAP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{alert_id:04d}"
        conn.execute(
            "UPDATE issued_alerts SET cap_identifier = ? WHERE id = ?", (cap_id, alert_id)
        )
        row = conn.execute("SELECT * FROM issued_alerts WHERE id = ?", (alert_id,)).fetchone()
        conn.commit()
        return _row_to_alert(conn, row)


def get_alert_by_id(alert_id: int) -> dict[str, Any] | None:
    init_db()
    with _connect() as conn:
        row = conn.execute("SELECT * FROM issued_alerts WHERE id = ?", (alert_id,)).fetchone()
        if row is None:
            return None
        return _row_to_alert(conn, row)


def list_alerts(active_only: bool = False, limit: int = 25) -> list[dict[str, Any]]:
    init_db()
    sql = "SELECT * FROM issued_alerts"
    params: list[Any] = []
    if active_only:
        sql += " WHERE active = 1 AND status = 'emitida'"
    sql += " ORDER BY id DESC LIMIT ?"
    params.append(max(1, min(limit, 100)))
    with _connect() as conn:
        rows = conn.execute(sql, params).fetchall()
        return [_row_to_alert(conn, r) for r in rows]


def validate_alert(alert_id: int, validated_by_role: str = "directivo") -> dict[str, Any] | None:
    init_db()
    now = _now_iso()
    with _connect() as conn:
        row = conn.execute("SELECT * FROM issued_alerts WHERE id = ?", (alert_id,)).fetchone()
        if row is None:
            return None
        conn.execute(
            """
            UPDATE issued_alerts
            SET status = 'emitida', active = 1, validated_by_role = ?, validated_at = ?
            WHERE id = ?
            """,
            (validated_by_role, now, alert_id),
        )
        updated = conn.execute("SELECT * FROM issued_alerts WHERE id = ?", (alert_id,)).fetchone()
        conn.commit()
        return _row_to_alert(conn, updated)


def resolve_alert(alert_id: int) -> dict[str, Any] | None:
    init_db()
    with _connect() as conn:
        row = conn.execute("SELECT * FROM issued_alerts WHERE id = ?", (alert_id,)).fetchone()
        if row is None:
            return None
        conn.execute(
            "UPDATE issued_alerts SET active = 0, status = 'resuelta' WHERE id = ?",
            (alert_id,),
        )
        updated = conn.execute("SELECT * FROM issued_alerts WHERE id = ?", (alert_id,)).fetchone()
        conn.commit()
        return _row_to_alert(conn, updated)


def confirm_alert_receipt(alert_id: int, role: str, status: str) -> dict[str, Any] | None:
    init_db()
    now = _now_iso()
    with _connect() as conn:
        row = conn.execute("SELECT id FROM issued_alerts WHERE id = ?", (alert_id,)).fetchone()
        if row is None:
            return None
        cur = conn.execute(
            """
            INSERT INTO alert_confirmations (alert_id, role, status, confirmed_at)
            VALUES (?, ?, ?, ?)
            """,
            (alert_id, role, status, now),
        )
        conf_id = int(cur.lastrowid)
        conn.commit()
        summary = _get_confirmations_summary(conn, alert_id)
    return {
        "confirmation": {
            "id": conf_id,
            "alert_id": alert_id,
            "role": role,
            "status": status,
            "confirmed_at": now,
        },
        "confirmations": summary,
    }


def build_cap_12_payload(alert: dict[str, Any]) -> dict[str, Any]:
    """Construye la representación estándar CAP 1.2 (JSON y XML) con nota no oficial."""
    cap_severity_map = {
        "VERDE": "Minor",
        "AMARILLO": "Moderate",
        "NARANJA": "Severe",
        "ROJO": "Extreme",
    }
    cap_sev = cap_severity_map.get(alert["severity"], "Moderate")
    note = "Datos sintéticos / Ejemplo no oficial — Prototipo TRL 3–4 (no sustituye alertas SENAMHI/COER/INDECI)."

    cap_json = {
        "standard": "CAP 1.2 (OASIS Common Alerting Protocol)",
        "identifier": alert["cap_identifier"],
        "sender": alert["issuer"],
        "sent": alert["validated_at"] or alert["created_at"],
        "status": "Exercise",
        "msgType": "Alert",
        "scope": "Public",
        "note": note,
        "info": {
            "language": "es-PE",
            "category": "Met",
            "event": f"Alerta Preventiva Universitaria ({alert['severity']})",
            "urgency": "Expected" if alert["severity"] in ("NARANJA", "ROJO") else "Future",
            "severity": cap_sev,
            "certainty": "Observed" if alert["validated_by_role"] else "Possible",
            "headline": alert["what_happens"],
            "description": alert["what_happens"],
            "instruction": alert["what_to_do"],
            "effective": alert["when_window"],
            "senderName": alert["issuer"],
            "area": {
                "areaDesc": alert["where_zone"],
                "affectedZones": alert["affected_zones"],
            },
            "parameter": [
                {"valueName": "validacion_humana", "value": alert["validated_by_role"] or "pendiente"},
                {"valueName": "perfiles_destino", "value": ", ".join(alert["target_roles"])},
                {"valueName": "confirmaciones_totales", "value": str(alert["confirmations"]["total"])},
            ],
        },
    }

    esc = xmlutils.escape
    cap_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">\n'
        f"  <identifier>{esc(cap_json['identifier'])}</identifier>\n"
        f"  <sender>{esc(cap_json['sender'])}</sender>\n"
        f"  <sent>{esc(cap_json['sent'])}</sent>\n"
        "  <status>Exercise</status>\n"
        "  <msgType>Alert</msgType>\n"
        "  <scope>Public</scope>\n"
        f"  <note>{esc(note)}</note>\n"
        "  <info>\n"
        "    <language>es-PE</language>\n"
        "    <category>Met</category>\n"
        f"    <event>{esc(cap_json['info']['event'])}</event>\n"
        f"    <urgency>{esc(cap_json['info']['urgency'])}</urgency>\n"
        f"    <severity>{esc(cap_sev)}</severity>\n"
        f"    <certainty>{esc(cap_json['info']['certainty'])}</certainty>\n"
        f"    <senderName>{esc(alert['issuer'])}</senderName>\n"
        f"    <headline>{esc(alert['what_happens'])}</headline>\n"
        f"    <description>{esc(alert['what_happens'])}</description>\n"
        f"    <instruction>{esc(alert['what_to_do'])}</instruction>\n"
        "    <area>\n"
        f"      <areaDesc>{esc(alert['where_zone'])}</areaDesc>\n"
        "    </area>\n"
        "  </info>\n"
        "</alert>\n"
    )
    return {"cap_json": cap_json, "cap_xml": cap_xml}


# ---------------------------------------------------------------------------
# 4. Reportes anónimos de la comunidad UNT (0 PII — Ley N.° 29733)
# ---------------------------------------------------------------------------
def _row_to_report(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "category": str(row["category"]),
        "zone_name": str(row["zone_name"]),
        "lat": float(row["lat"]) if row["lat"] is not None else None,
        "lon": float(row["lon"]) if row["lon"] is not None else None,
        "severity": str(row["severity"]),
        "note": str(row["note"] or ""),
        "status": str(row["status"]),
        "verified_by_role": str(row["verified_by_role"]) if row["verified_by_role"] else None,
        "created_at": str(row["created_at"]),
    }


def create_report(
    *,
    category: str,
    zone_name: str,
    lat: float | None,
    lon: float | None,
    severity: str,
    note: str = "",
) -> dict[str, Any]:
    init_db()
    now = _now_iso()
    clean_note = (note or "").strip()[:180]
    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO campus_reports
                (category, zone_name, lat, lon, severity, note, status, verified_by_role, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pendiente', NULL, ?)
            """,
            (category, zone_name.strip(), lat, lon, severity, clean_note, now),
        )
        rep_id = int(cur.lastrowid)
        row = conn.execute("SELECT * FROM campus_reports WHERE id = ?", (rep_id,)).fetchone()
        conn.commit()
    return _row_to_report(row)


def list_reports(limit: int = 50) -> list[dict[str, Any]]:
    init_db()
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM campus_reports ORDER BY id DESC LIMIT ?",
            (max(1, min(limit, 200)),),
        ).fetchall()
    return [_row_to_report(r) for r in rows]


def update_report_status(
    report_id: int, status: str, verified_by_role: str | None = None
) -> dict[str, Any] | None:
    init_db()
    with _connect() as conn:
        row = conn.execute("SELECT * FROM campus_reports WHERE id = ?", (report_id,)).fetchone()
        if row is None:
            return None
        conn.execute(
            "UPDATE campus_reports SET status = ?, verified_by_role = COALESCE(?, verified_by_role) WHERE id = ?",
            (status, verified_by_role, report_id),
        )
        updated = conn.execute("SELECT * FROM campus_reports WHERE id = ?", (report_id,)).fetchone()
        conn.commit()
    return _row_to_report(updated)


# ---------------------------------------------------------------------------
# 5. Registro de simulacros y corridas (Pilar 4)
# ---------------------------------------------------------------------------
def record_simulation_run(
    *,
    scenario_name: str,
    params: dict[str, Any] | None = None,
    peak_hour: int = 1,
    max_depth_cm: float = 0.0,
    affected_gates: list[str] | None = None,
    affected_buildings_count: int = 0,
    executed_by_role: str = "operador_riesgos",
) -> dict[str, Any]:
    init_db()
    now = _now_iso()
    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO simulation_runs (
                scenario_name, params_json, peak_hour, max_depth_cm,
                affected_gates_json, affected_buildings_count, executed_by_role, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                scenario_name.strip(),
                json.dumps(params or {}, ensure_ascii=False),
                int(peak_hour),
                round(float(max_depth_cm), 2),
                json.dumps(affected_gates or [], ensure_ascii=False),
                int(affected_buildings_count),
                executed_by_role,
                now,
            ),
        )
        run_id = int(cur.lastrowid)
        row = conn.execute("SELECT * FROM simulation_runs WHERE id = ?", (run_id,)).fetchone()
        conn.commit()
    return _row_to_sim_run(row)


def _row_to_sim_run(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "scenario_name": str(row["scenario_name"]),
        "params": json.loads(row["params_json"] or "{}"),
        "peak_hour": int(row["peak_hour"]),
        "max_depth_cm": float(row["max_depth_cm"]),
        "affected_gates": json.loads(row["affected_gates_json"] or "[]"),
        "affected_buildings_count": int(row["affected_buildings_count"]),
        "executed_by_role": str(row["executed_by_role"]),
        "created_at": str(row["created_at"]),
    }


def list_simulation_runs(limit: int = 30) -> list[dict[str, Any]]:
    init_db()
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM simulation_runs ORDER BY id DESC LIMIT ?",
            (max(1, min(limit, 100)),),
        ).fetchall()
    return [_row_to_sim_run(r) for r in rows]


# ---------------------------------------------------------------------------
# 6. Decisiones de continuidad académica y administrativa
# ---------------------------------------------------------------------------
def _row_to_decision(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "scope": str(row["scope"]),
        "target_area": str(row["target_area"]),
        "measure": str(row["measure"]),
        "valid_until": str(row["valid_until"]),
        "decided_by_role": str(row["decided_by_role"]),
        "active": bool(row["active"]),
        "created_at": str(row["created_at"]),
    }


def create_continuity_decision(
    *,
    scope: str,
    target_area: str,
    measure: str,
    valid_until: str,
    decided_by_role: str = "directivo",
) -> dict[str, Any]:
    init_db()
    now = _now_iso()
    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO continuity_decisions
                (scope, target_area, measure, valid_until, decided_by_role, active, created_at)
            VALUES (?, ?, ?, ?, ?, 1, ?)
            """,
            (scope, target_area.strip(), measure.strip(), valid_until.strip(), decided_by_role, now),
        )
        dec_id = int(cur.lastrowid)
        row = conn.execute("SELECT * FROM continuity_decisions WHERE id = ?", (dec_id,)).fetchone()
        conn.commit()
    return _row_to_decision(row)


def list_continuity_decisions(active_only: bool = False, limit: int = 30) -> list[dict[str, Any]]:
    init_db()
    sql = "SELECT * FROM continuity_decisions"
    if active_only:
        sql += " WHERE active = 1"
    sql += " ORDER BY id DESC LIMIT ?"
    with _connect() as conn:
        rows = conn.execute(sql, (max(1, min(limit, 100)),)).fetchall()
    return [_row_to_decision(r) for r in rows]


def resolve_continuity_decision(decision_id: int) -> dict[str, Any] | None:
    init_db()
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM continuity_decisions WHERE id = ?", (decision_id,)
        ).fetchone()
        if row is None:
            return None
        conn.execute("UPDATE continuity_decisions SET active = 0 WHERE id = ?", (decision_id,))
        updated = conn.execute(
            "SELECT * FROM continuity_decisions WHERE id = ?", (decision_id,)
        ).fetchone()
        conn.commit()
    return _row_to_decision(updated)


# ---------------------------------------------------------------------------
# 7. Series de tiempo meteorológicas (Etapa 3 SAT)
# ---------------------------------------------------------------------------
def save_weather_snapshot(
    raw_payload: dict[str, Any],
    fetched_at_utc: str,
    source: str = "Open-Meteo",
) -> int:
    init_db()
    now = _now_iso()
    hourly = raw_payload.get("hourly") or {}
    precips = [float(x) for x in (hourly.get("precipitation") or [])[:24] if x is not None]
    probs = [int(round(float(x))) for x in (hourly.get("precipitation_probability") or [])[:24] if x is not None]
    pressures = [float(x) for x in (hourly.get("surface_pressure") or [])[:1] if x is not None]
    winds = [float(x) for x in (hourly.get("wind_speed_10m") or [])[:1] if x is not None]

    max_p = max(precips) if precips else None
    max_prob = max(probs) if probs else None
    pres = pressures[0] if pressures else None
    wind = winds[0] if winds else None

    with _connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO weather_time_series (
                source, payload_json, max_precip_mm_h, max_prob_24h_pct,
                pressure_hpa, wind_speed_kmh, fetched_at_utc, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                source,
                json.dumps(raw_payload, ensure_ascii=False),
                max_p,
                max_prob,
                pres,
                wind,
                fetched_at_utc,
                now,
            ),
        )
        snap_id = int(cur.lastrowid)
        conn.execute(
            """
            DELETE FROM weather_time_series
            WHERE id NOT IN (
                SELECT id FROM weather_time_series ORDER BY id DESC LIMIT 48
            )
            """
        )
        conn.commit()
    return snap_id


def get_latest_weather_snapshot() -> dict[str, Any] | None:
    init_db()
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM weather_time_series ORDER BY id DESC LIMIT 1"
        ).fetchone()
    if row is None:
        return None
    try:
        payload = json.loads(row["payload_json"])
    except json.JSONDecodeError:
        return None
    return {
        "id": int(row["id"]),
        "source": str(row["source"]),
        "payload": payload,
        "fetched_at_utc": str(row["fetched_at_utc"]),
        "created_at": str(row["created_at"]),
    }


def get_db_stats() -> dict[str, Any]:
    db_path = init_db()
    with _connect() as conn:
        users_count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        active_alerts = conn.execute(
            "SELECT COUNT(*) FROM issued_alerts WHERE active = 1 AND status = 'emitida'"
        ).fetchone()[0]
        draft_alerts = conn.execute(
            "SELECT COUNT(*) FROM issued_alerts WHERE status = 'borrador_pendiente_validacion'"
        ).fetchone()[0]
        total_alerts = conn.execute("SELECT COUNT(*) FROM issued_alerts").fetchone()[0]
        total_confirmations = conn.execute("SELECT COUNT(*) FROM alert_confirmations").fetchone()[0]
        pending_reports = conn.execute(
            "SELECT COUNT(*) FROM campus_reports WHERE status = 'pendiente'"
        ).fetchone()[0]
        total_reports = conn.execute("SELECT COUNT(*) FROM campus_reports").fetchone()[0]
        sim_runs = conn.execute("SELECT COUNT(*) FROM simulation_runs").fetchone()[0]
        active_decisions = conn.execute(
            "SELECT COUNT(*) FROM continuity_decisions WHERE active = 1"
        ).fetchone()[0]
        snapshots_count = conn.execute("SELECT COUNT(*) FROM weather_time_series").fetchone()[0]
        last_snap = conn.execute(
            "SELECT fetched_at_utc FROM weather_time_series ORDER BY id DESC LIMIT 1"
        ).fetchone()
    return {
        "engine": "SQLite 3 (embebido · 7 tablas SAT/CAP 1.2)",
        "db_file": db_path.name,
        "demo_users": int(users_count),
        "active_alerts": int(active_alerts),
        "draft_alerts": int(draft_alerts),
        "total_alerts": int(total_alerts),
        "total_confirmations": int(total_confirmations),
        "pending_reports": int(pending_reports),
        "total_reports": int(total_reports),
        "simulation_runs": int(sim_runs),
        "active_continuity_decisions": int(active_decisions),
        "weather_snapshots": int(snapshots_count),
        "latest_snapshot_utc": str(last_snap["fetched_at_utc"]) if last_snap else None,
    }


# ---------------------------------------------------------------------------
# 8. Estado de simulación en vivo (fila única id = 1)
# ---------------------------------------------------------------------------
def _row_to_active_simulation(row: sqlite3.Row) -> dict[str, Any]:
    def _safe_json(raw: str | None, fallback: Any) -> Any:
        if not raw:
            return fallback
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return fallback

    return {
        "id": int(row["id"]),
        "active": bool(row["active"]),
        "scenario_id": str(row["scenario_id"] or ""),
        "scenario_label": str(row["scenario_label"] or ""),
        "drainage_scenario": str(row["drainage_scenario"] or "base"),
        "params": _safe_json(row["params_json"], {}),
        "started_at": str(row["started_at"]) if row["started_at"] else None,
        "auto_alert_delay_sec": int(row["auto_alert_delay_sec"] if row["auto_alert_delay_sec"] is not None else 10),
        "alert_dispatched": bool(row["alert_dispatched"]),
        "dispatched_alert_id": int(row["dispatched_alert_id"]) if row["dispatched_alert_id"] is not None else None,
        "confidence_pct": int(row["confidence_pct"] or 0),
        "confidence_factors": _safe_json(row["confidence_factors_json"], []),
        "activated_by_role": str(row["activated_by_role"] or "operador_riesgos"),
        "result": _safe_json(row["result_json"], {}),
        "updated_at": str(row["updated_at"] or ""),
    }


def save_active_simulation(
    *,
    scenario_id: str,
    scenario_label: str,
    drainage_scenario: str = "base",
    params: dict[str, Any] | None = None,
    started_at: str | None = None,
    auto_alert_delay_sec: int = 10,
    confidence_pct: int = 0,
    confidence_factors: list[dict[str, Any]] | None = None,
    activated_by_role: str = "operador_riesgos",
    result: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Guarda o reemplaza la simulación en vivo activa (fila única id = 1)."""
    init_db()
    now = _now_iso()
    start_iso = started_at or now
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO active_simulation_state (
                id, active, scenario_id, scenario_label, drainage_scenario,
                params_json, started_at, auto_alert_delay_sec,
                alert_dispatched, dispatched_alert_id,
                confidence_pct, confidence_factors_json,
                activated_by_role, result_json, updated_at
            )
            VALUES (1, 1, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                active = 1,
                scenario_id = excluded.scenario_id,
                scenario_label = excluded.scenario_label,
                drainage_scenario = excluded.drainage_scenario,
                params_json = excluded.params_json,
                started_at = excluded.started_at,
                auto_alert_delay_sec = excluded.auto_alert_delay_sec,
                alert_dispatched = 0,
                dispatched_alert_id = NULL,
                confidence_pct = excluded.confidence_pct,
                confidence_factors_json = excluded.confidence_factors_json,
                activated_by_role = excluded.activated_by_role,
                result_json = excluded.result_json,
                updated_at = excluded.updated_at
            """,
            (
                scenario_id.strip(),
                scenario_label.strip(),
                drainage_scenario.strip(),
                json.dumps(params or {}, ensure_ascii=False),
                start_iso,
                max(0, int(auto_alert_delay_sec)),
                max(0, min(100, int(confidence_pct))),
                json.dumps(confidence_factors or [], ensure_ascii=False),
                activated_by_role.strip() or "operador_riesgos",
                json.dumps(result or {}, ensure_ascii=False),
                now,
            ),
        )
        row = conn.execute("SELECT * FROM active_simulation_state WHERE id = 1").fetchone()
        conn.commit()
    return _row_to_active_simulation(row)


def get_active_simulation() -> dict[str, Any] | None:
    """Devuelve el estado persistido de la simulación en vivo, o None si nunca se activó."""
    init_db()
    with _connect() as conn:
        row = conn.execute("SELECT * FROM active_simulation_state WHERE id = 1").fetchone()
    if row is None:
        return None
    return _row_to_active_simulation(row)


def claim_active_simulation_alert_dispatch() -> dict[str, Any] | None:
    """Reclama de forma atómica el disparo único de alerta CAP en SQLite (BEGIN IMMEDIATE)."""
    init_db()
    now = _now_iso()
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), timeout=10.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT * FROM active_simulation_state WHERE id = 1 AND active = 1 AND alert_dispatched = 0"
        ).fetchone()
        if row is None:
            conn.execute("ROLLBACK")
            return None
        cur = conn.execute(
            """
            UPDATE active_simulation_state
            SET alert_dispatched = 1, updated_at = ?
            WHERE id = 1 AND active = 1 AND alert_dispatched = 0
            """,
            (now,),
        )
        if cur.rowcount != 1:
            conn.execute("ROLLBACK")
            return None
        conn.execute("COMMIT")
        claimed = _row_to_active_simulation(row)
        claimed["alert_dispatched"] = True
        return claimed
    except Exception:
        try:
            conn.execute("ROLLBACK")
        except sqlite3.Error:
            pass
        raise
    finally:
        conn.close()


def mark_active_simulation_alert_dispatched(alert_id: int) -> dict[str, Any] | None:
    """Marca la alerta automática como emitida y asocia el ID de issued_alerts."""
    init_db()
    now = _now_iso()
    with _connect() as conn:
        row = conn.execute("SELECT id FROM active_simulation_state WHERE id = 1").fetchone()
        if row is None:
            return None
        conn.execute(
            """
            UPDATE active_simulation_state
            SET alert_dispatched = 1, dispatched_alert_id = ?, updated_at = ?
            WHERE id = 1
            """,
            (int(alert_id), now),
        )
        updated = conn.execute("SELECT * FROM active_simulation_state WHERE id = 1").fetchone()
        conn.commit()
    return _row_to_active_simulation(updated)


def stop_active_simulation() -> dict[str, Any]:
    """Desactiva la simulación en vivo devolviendo Comunidad UNT al pronóstico normal."""
    init_db()
    now = _now_iso()
    with _connect() as conn:
        row = conn.execute("SELECT id FROM active_simulation_state WHERE id = 1").fetchone()
        if row is None:
            return {
                "id": 1,
                "active": False,
                "scenario_id": "",
                "scenario_label": "",
                "drainage_scenario": "base",
                "params": {},
                "started_at": None,
                "auto_alert_delay_sec": 10,
                "alert_dispatched": False,
                "dispatched_alert_id": None,
                "confidence_pct": 0,
                "confidence_factors": [],
                "activated_by_role": "operador_riesgos",
                "result": {},
                "updated_at": now,
            }
        conn.execute(
            "UPDATE active_simulation_state SET active = 0, updated_at = ? WHERE id = 1",
            (now,),
        )
        updated = conn.execute("SELECT * FROM active_simulation_state WHERE id = 1").fetchone()
        conn.commit()
    return _row_to_active_simulation(updated)


# ---------------------------------------------------------------------------
# 9. Dispositivos móviles registrados (Consentimiento Android 13+ / FCM)
# ---------------------------------------------------------------------------
def upsert_mobile_device(
    *,
    device_id: str,
    fcm_token: str | None = None,
    platform: str = "android",
    notifications_enabled: bool = True,
    app_version: str = "1.0.0",
) -> dict[str, Any]:
    init_db()
    now = _now_iso()
    clean_id = device_id.strip()[:120]
    clean_token = (fcm_token or "").strip()[:512] or None
    enabled_int = 1 if notifications_enabled else 0
    with _connect() as conn:
        existing = conn.execute(
            "SELECT * FROM mobile_devices WHERE device_id = ?", (clean_id,)
        ).fetchone()
        if existing is None:
            conn.execute(
                """
                INSERT INTO mobile_devices (
                    device_id, fcm_token, platform, notifications_enabled,
                    app_version, updated_at, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (clean_id, clean_token, platform, enabled_int, app_version, now, now),
            )
        else:
            token_to_save = clean_token if clean_token is not None else existing["fcm_token"]
            conn.execute(
                """
                UPDATE mobile_devices
                SET fcm_token = ?, platform = ?, notifications_enabled = ?,
                    app_version = ?, updated_at = ?
                WHERE device_id = ?
                """,
                (token_to_save, platform, enabled_int, app_version, now, clean_id),
            )
        row = conn.execute(
            "SELECT * FROM mobile_devices WHERE device_id = ?", (clean_id,)
        ).fetchone()
        conn.commit()
    return {
        "device_id": str(row["device_id"]),
        "has_fcm_token": bool(row["fcm_token"]),
        "platform": str(row["platform"]),
        "notifications_enabled": bool(row["notifications_enabled"]),
        "app_version": str(row["app_version"]),
        "updated_at": str(row["updated_at"]),
    }


def list_active_mobile_devices() -> list[dict[str, Any]]:
    init_db()
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM mobile_devices WHERE notifications_enabled = 1"
        ).fetchall()
    return [dict(r) for r in rows]


def upsert_web_push_subscription(*, endpoint: str, subscription_json: str, device_id: str) -> None:
    init_db()
    now = _now_iso()
    clean_endpoint = endpoint.strip()[:4096]
    clean_device_id = device_id.strip()[:120]
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO web_push_subscriptions
                (endpoint, subscription_json, device_id, notifications_enabled, created_at, updated_at)
            VALUES (?, ?, ?, 1, ?, ?)
            ON CONFLICT(endpoint) DO UPDATE SET
                subscription_json = excluded.subscription_json,
                device_id = excluded.device_id,
                notifications_enabled = 1,
                updated_at = excluded.updated_at
            """,
            (clean_endpoint, subscription_json, clean_device_id, now, now),
        )
        conn.commit()


def list_active_web_push_subscriptions() -> list[dict[str, Any]]:
    init_db()
    with _connect() as conn:
        rows = conn.execute(
            "SELECT endpoint, subscription_json FROM web_push_subscriptions WHERE notifications_enabled = 1"
        ).fetchall()
    return [dict(row) for row in rows]


def delete_web_push_subscription(endpoint: str) -> None:
    init_db()
    with _connect() as conn:
        conn.execute("DELETE FROM web_push_subscriptions WHERE endpoint = ?", (endpoint.strip()[:4096],))
        conn.commit()
