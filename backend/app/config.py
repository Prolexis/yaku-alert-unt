from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

UNT_CAMPUS_LAT = -8.114656
UNT_CAMPUS_LON = -79.038595
UNT_TIMEZONE = "America/Lima"

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

CAMPUS_GEOJSON_PATH = DATA_DIR / "campus_unt.geojson"
HAZARDS_GEOJSON_PATH = DATA_DIR / "hazard_scenarios.geojson"
EVACUATION_GEOJSON_PATH = DATA_DIR / "evacuation_reference.geojson"
PROTOCOLS_JSON_PATH = DATA_DIR / "protocols.json"
WEATHER_FALLBACK_PATH = DATA_DIR / "open_meteo_fallback.json"
