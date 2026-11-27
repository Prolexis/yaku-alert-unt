import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR.parent
DATA_DIR = BASE_DIR / "data"


def _load_dotenv_files() -> None:
    """Carga variables desde backend/.env o .env sin sobrescribir variables ya definidas."""
    for env_path in (BACKEND_DIR / ".env", BACKEND_DIR.parent / ".env"):
        if not env_path.is_file():
            continue
        try:
            for raw_line in env_path.read_text(encoding="utf-8").splitlines():
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                    value = value[1:-1]
                if key:
                    os.environ.setdefault(key, value)
        except OSError:
            continue


_load_dotenv_files()

UNT_CAMPUS_LAT = -8.114656
UNT_CAMPUS_LON = -79.038595
UNT_TIMEZONE = "America/Lima"

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

CAMPUS_GEOJSON_PATH = DATA_DIR / "campus_unt.geojson"
HAZARDS_GEOJSON_PATH = DATA_DIR / "hazard_scenarios.geojson"
EVACUATION_GEOJSON_PATH = DATA_DIR / "evacuation_reference.geojson"
TRUJILLO_CONTEXT_GEOJSON_PATH = DATA_DIR / "trujillo_context_reference.geojson"
PROTOCOLS_JSON_PATH = DATA_DIR / "protocols.json"
WEATHER_FALLBACK_PATH = DATA_DIR / "open_meteo_fallback.json"


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on", "si", "sí")


# WhatsApp Cloud API (Meta for Developers / Graph API) — valores por defecto seguros (sin secretos)
WHATSAPP_ENABLED: bool = _env_bool("WHATSAPP_ENABLED", False)
WHATSAPP_API_VERSION: str = os.getenv("WHATSAPP_API_VERSION", "v22.0").strip() or "v22.0"
WHATSAPP_PHONE_NUMBER_ID: str = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "").strip()
WHATSAPP_ACCESS_TOKEN: str = os.getenv("WHATSAPP_ACCESS_TOKEN", "").strip()
WHATSAPP_TEST_RECIPIENTS: str = os.getenv("WHATSAPP_TEST_RECIPIENTS", "").strip()
WHATSAPP_TEMPLATE_NAME: str = os.getenv("WHATSAPP_TEMPLATE_NAME", "hello_world").strip() or "hello_world"


def get_whatsapp_settings() -> dict:
    """Lee la configuración vigente de WhatsApp Cloud API desde variables de entorno."""
    return {
        "enabled": _env_bool("WHATSAPP_ENABLED", WHATSAPP_ENABLED),
        "api_version": os.getenv("WHATSAPP_API_VERSION", WHATSAPP_API_VERSION).strip() or "v22.0",
        "phone_number_id": os.getenv("WHATSAPP_PHONE_NUMBER_ID", WHATSAPP_PHONE_NUMBER_ID).strip(),
        "access_token": os.getenv("WHATSAPP_ACCESS_TOKEN", WHATSAPP_ACCESS_TOKEN).strip(),
        "test_recipients": os.getenv("WHATSAPP_TEST_RECIPIENTS", WHATSAPP_TEST_RECIPIENTS).strip(),
        "template_name": os.getenv("WHATSAPP_TEMPLATE_NAME", WHATSAPP_TEMPLATE_NAME).strip() or "hello_world",
    }
