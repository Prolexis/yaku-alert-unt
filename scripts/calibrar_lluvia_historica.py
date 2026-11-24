#!/usr/bin/env python3
"""Consulta lluvia horaria histórica para eventos documentados en Trujillo."""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "backend" / "app" / "data" / "eventos_referencia.json"
API = "https://archive-api.open-meteo.com/v1/archive"
SOURCE = (
    "Open-Meteo Historical Weather API, reanálisis; aproxima pero no reemplaza "
    "estaciones SENAMHI"
)

EVENTS = [
    {
        "id": "evento_marzo_2017",
        "label": "evento de marzo de 2017",
        "start_date": "2017-03-12",
        "end_date": "2017-03-18",
        "press_links": [
            "https://larepublica.pe/sociedad/2020/03/15/trujillo-se-recuerda-huaico-que-afecto-la-ciudad-lrnd",
            "https://diariocorreo.pe/edicion/la-libertad/trujillo-asi-luce-mural-de-la-unt-fotos-y-video-744816/",
        ],
    },
    {
        "id": "evento_marzo_2023",
        "label": "evento de marzo de 2023",
        "start_date": "2023-03-09",
        "end_date": "2023-03-16",
        "press_links": ["https://elbuho.pe/?p=282430"],
    },
    {
        "id": "evento_marzo_2025",
        "label": "evento de marzo de 2025",
        "start_date": "2025-03-26",
        "end_date": "2025-03-31",
        "press_links": [
            "https://trome.com/actualidad/trujillo-azotada-por-fuertes-lluvias-calles-inundadas-y-viviendas-afectadas-tras-activacion-de-quebradas-emergencia-noticia/",
            "https://elbuho.pe/?p=379990",
            "https://www.infobae.com/peru/2025/03/29/trujillo-en-emergencia-por-lluvias-impactantes-imagenes-y-videos-de-las-inundaciones-que-deja-la-activacion-de-quebradas-en-la-libertad/",
            "https://www.unitru.edu.pe/noticia_item.aspx?IDNoticia=1774",
        ],
    },
]

# Solo son los valores previos de demostración, no observaciones históricas.
DEMO_PRESETS = {
    "evento_marzo_2017": {"intensity_mm_h": 12.0, "duration_hours": 3},
    "evento_marzo_2023": {"intensity_mm_h": 28.0, "duration_hours": 4},
    "evento_marzo_2025": {"intensity_mm_h": 45.0, "duration_hours": 6},
}


def fetch_event(event):
    params = urlencode({
        "latitude": -8.1145,
        "longitude": -79.0385,
        "start_date": event["start_date"],
        "end_date": event["end_date"],
        "hourly": "precipitation",
        "timezone": "America/Lima",
    })
    request = Request(f"{API}?{params}", headers={"User-Agent": "yaku-alert-unt/1.0"})
    with urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    hourly = payload["hourly"]
    values = hourly["precipitation"]
    if not values or len(values) != len(hourly["time"]):
        raise ValueError(f"Open-Meteo no devolvió una serie horaria válida para {event['id']}")
    rain = [float(value) for value in values]
    rolling_24h = [
        sum(rain[index:index + 24])
        for index in range(max(1, len(rain) - 23))
    ]
    return {
        **event,
        "max_hourly_mm_h": round(max(rain), 2),
        "max_rolling_24h_mm": round(max(rolling_24h), 2),
        "hours_ge_0_1mm": sum(value >= 0.1 for value in rain),
        "source": SOURCE,
        "is_historical_reanalysis": True,
    }


def demo_payload(error):
    return {
        "source": SOURCE,
        "source_status": "sin_conexion_supuesto_de_demostracion",
        "historical_values_available": False,
        "queried_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "location": {"latitude": -8.1145, "longitude": -79.0385, "timezone": "America/Lima"},
        "limitation": "No se obtuvo la serie histórica; los valores anteriores 12/28/45 mm/h "
                      "se conservan solo como supuestos de demostración y no como lluvia observada.",
        "events": [
            {
                **event,
                "max_hourly_mm_h": None,
                "max_rolling_24h_mm": None,
                "hours_ge_0_1mm": None,
                "source": SOURCE,
                "is_historical_reanalysis": False,
                "demo_assumption": DEMO_PRESETS[event["id"]],
            }
            for event in EVENTS
        ],
        "error": str(error),
    }


def main():
    try:
        measured = [fetch_event(event) for event in EVENTS]
    except (URLError, TimeoutError, OSError, ValueError, KeyError) as exc:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(demo_payload(exc), ensure_ascii=False, indent=2), encoding="utf-8")
        print(
            "[AVISO] No fue posible consultar Open-Meteo Archive. "
            "Se guardaron los valores previos únicamente como supuestos de demostración; "
            f"no son observaciones. Detalle: {exc}",
            file=sys.stderr,
        )
        print("Escrito", OUT)
        return

    payload = {
        "source": SOURCE,
        "source_status": "reanálisis_consultado",
        "historical_values_available": True,
        "queried_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "location": {"latitude": -8.1145, "longitude": -79.0385, "timezone": "America/Lima"},
        "limitation": "El reanálisis aproxima la lluvia regional, puede subestimar eventos locales "
                      "y no reemplaza observaciones de estaciones SENAMHI.",
        "events": measured,
        "demo_assumptions_kept": DEMO_PRESETS,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Escrito", OUT)
    for event in measured:
        print(
            f"{event['label']}: {event['max_hourly_mm_h']} mm/h máx.; "
            f"{event['max_rolling_24h_mm']} mm/24 h; "
            f"{event['hours_ge_0_1mm']} h con lluvia >=0,1 mm"
        )


if __name__ == "__main__":
    main()
