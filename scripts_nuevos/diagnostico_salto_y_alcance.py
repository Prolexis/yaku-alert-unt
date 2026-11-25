#!/usr/bin/env python3
"""Reproduce E1-E4 con el motor hidro, sin escribir en datos del proyecto.

Uso desde la raíz:
    python scripts_nuevos/diagnostico_salto_y_alcance.py

Solo genera datos_nuevos/analisis/DIAGNOSTICO_SALTO_Y_ALCANCE.md.
Los cambios de parámetros y de superficie de enrutamiento se hacen en memoria.
"""
from __future__ import annotations

import copy
import json
import math
import sys
from collections import deque
from pathlib import Path
from unittest.mock import patch

import numpy as np
import shapely
from shapely.geometry import shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "scripts"))

from app.services import hydro  # noqa: E402
from app.services.hydro import TerrainGrid, build_rainfall_series  # noqa: E402
from build_terrain_grid import _priority_flood_fill  # noqa: E402

DATA_DIR = ROOT / "backend" / "app" / "data"
PARAMS_PATH = DATA_DIR / "hydro_params.json"
TERRAIN_PATH = DATA_DIR / "terrain_grid.json"
CAMPUS_PATH = DATA_DIR / "campus_unt.geojson"
OUT_PATH = ROOT / "datos_nuevos" / "analisis" / "DIAGNOSTICO_SALTO_Y_ALCANCE.md"
HOURS = 48
VISIBLE_M = 0.01
P4_LON = -79.035987
P4_LAT = -8.11167
NEAR_P4_M = 100.0


def number(value: float | int, digits: int = 1) -> str:
    rendered = f"{value:,.{digits}f}"
    return rendered.replace(",", "_").replace(".", ",").replace("_", ".")


def markdown_table(headers: list[str], rows: list[list[str]]) -> str:
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    lines.extend("| " + " | ".join(row) + " |" for row in rows)
    return "\n".join(lines)


def load_inputs() -> tuple[dict, dict, TerrainGrid, np.ndarray, np.ndarray, np.ndarray]:
    params = json.loads(PARAMS_PATH.read_text(encoding="utf-8"))
    raw = json.loads(TERRAIN_PATH.read_text(encoding="utf-8"))
    campus_data = json.loads(CAMPUS_PATH.read_text(encoding="utf-8"))

    perimeter_parts = [
        shape(feature["geometry"])
        for feature in campus_data["features"]
        if feature.get("properties", {}).get("category") == "perimetro_campus"
        and feature.get("geometry")
    ]
    if not perimeter_parts:
        raise ValueError("campus_unt.geojson no contiene un perímetro del campus.")
    perimeter = unary_union(perimeter_parts)

    ny, nx = raw["shape"]
    cols = np.arange(nx)
    rows = np.arange(ny)
    lon = raw["origin_lon"] + (cols + 0.5) * raw["dx_deg"]
    lat = raw["origin_lat"] - (rows + 0.5) * raw["dy_deg"]
    x_grid, y_grid = np.meshgrid(lon, lat)
    campus_mask = shapely.contains_xy(perimeter, x_grid, y_grid)

    p4_distance_m = np.hypot(
        (x_grid - P4_LON) * 111320.0 * math.cos(math.radians(P4_LAT)),
        (y_grid - P4_LAT) * 110574.0,
    )
    p4_near_mask = p4_distance_m <= NEAR_P4_M

    base_grid = TerrainGrid(raw)
    return params, raw, base_grid, campus_mask, p4_distance_m, p4_near_mask


def grid_with_fill(raw: dict, params: dict, cap: float | None) -> TerrainGrid:
    copied = copy.deepcopy(raw)
    elevation = np.asarray(copied["elevation_m"], dtype=np.float64).reshape(copied["shape"])
    blocked = (
        np.frombuffer(copied["blocked"].encode("ascii"), dtype=np.uint8) == ord("1")
    ).reshape(copied["shape"])
    routing = _priority_flood_fill(elevation, blocked, cap)
    copied["elevation_routing_m"] = routing.ravel().tolist()
    copied["metadata"]["routing_fill"]["fill_max_rise_m"] = cap
    copied["metadata"]["routing_fill"]["fill_max_obs_m"] = float(
        (routing - elevation).max()
    )
    return TerrainGrid(copied)


def empty_geojson(*_args, **_kwargs) -> dict:
    return {"type": "FeatureCollection", "features": []}


def run_case(
    params: dict,
    grid: TerrainGrid,
    rainfall: list[float],
    drainage: str,
    inflow: str,
    secondary: bool,
) -> dict:
    params_override = copy.deepcopy(params)
    params_override["fill_max_rise_m"] = copy.deepcopy(
        params_override.get("fill_max_rise_m", {"value": None})
    )
    params_override["fill_max_rise_m"]["value"] = grid.metadata.get(
        "routing_fill", {}
    ).get("fill_max_rise_m")
    hourly: list[np.ndarray] = []
    with (
        patch.object(hydro, "load_hydro_params", lambda: params_override),
        patch.object(hydro, "_frame_geojson", empty_geojson),
    ):
        response, final_depth = hydro.simulate_core(
            rainfall,
            drainage_state=drainage,
            inflow_p4=inflow,
            secondary_inflow=secondary,
            use_reported_sinks=False,
            grid=grid,
            hourly_out=hourly,
        )
    return {"response": response, "final": final_depth, "hourly": hourly}


def hourly_statistics(
    run: dict,
    grid: TerrainGrid,
    campus_mask: np.ndarray,
    p4_distance_m: np.ndarray,
    rainfall: list[float],
    drain_capacity: float,
) -> list[dict]:
    rows = []
    for index, depth in enumerate(run["hourly"], start=1):
        wet = depth >= VISIBLE_M
        wet_count = int(wet.sum())
        rows.append({
            "hour": index,
            "rain": rainfall[index - 1],
            "net_rain": max(0.0, rainfall[index - 1] - drain_capacity),
            "area_ha": float(wet_count * grid.area_m2 / 10_000.0),
            "inside_ha": float((wet & campus_mask).sum() * grid.area_m2 / 10_000.0),
            "outside_ha": float((wet & ~campus_mask).sum() * grid.area_m2 / 10_000.0),
            "cells": wet_count,
            "max_cm": float(depth.max() * 100.0),
            "distance_m": float(p4_distance_m[wet].max()) if wet_count else 0.0,
            "min_elevation_m": float(grid.z[wet].min()) if wet_count else math.nan,
        })
    return rows


def rainfall_volume_campus(
    rainfall: list[float], grid: TerrainGrid, campus_mask: np.ndarray
) -> tuple[float, float]:
    gross = sum(rainfall) / 1000.0 * float(campus_mask.sum()) * grid.area_m2
    runoff = sum(
        float(rain_mm) / 1000.0
        * float((grid.runoff_c * campus_mask).sum())
        * grid.area_m2
        for rain_mm in rainfall
    )
    return gross, runoff


def p4_centroid(grid: TerrainGrid) -> tuple[float, float]:
    cells = grid.inlets.get("p4", np.empty(0, dtype=np.int64))
    rows, cols = np.divmod(cells, grid.nx)
    return float(rows.mean()), float(cols.mean())


def nearest_element(grid: TerrainGrid, row: float, col: float) -> dict | None:
    best = None
    for element in grid.elements:
        cells = element["cells"]
        if cells.size == 0:
            continue
        rows, cols = np.divmod(cells, grid.nx)
        er, ec = float(rows.mean()), float(cols.mean())
        distance = math.hypot(er - row, ec - col) * grid.cell_size_m
        if best is None or distance < best["distance_m"]:
            best = {
                "name": element["name"],
                "distance_m": distance,
            }
    return best


def largest_wet_component(grid: TerrainGrid, depth: np.ndarray) -> dict | None:
    wet = depth >= VISIBLE_M
    seen = np.zeros_like(wet, dtype=bool)
    best_cells: list[int] = []
    ny, nx = wet.shape

    for start in np.flatnonzero(wet):
        r0, c0 = divmod(int(start), nx)
        if seen[r0, c0]:
            continue
        queue = deque([(r0, c0)])
        seen[r0, c0] = True
        members: list[int] = []
        while queue:
            row, col = queue.popleft()
            members.append(row * nx + col)
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    if dr == 0 and dc == 0:
                        continue
                    nr, nc = row + dr, col + dc
                    if (
                        0 <= nr < ny and 0 <= nc < nx
                        and wet[nr, nc] and not seen[nr, nc]
                    ):
                        seen[nr, nc] = True
                        queue.append((nr, nc))
        if len(members) > len(best_cells):
            best_cells = members

    if not best_cells:
        return None

    flat = np.asarray(best_cells, dtype=np.int64)
    depth_flat = depth.ravel()
    rows, cols = np.divmod(flat, nx)
    mean_row, mean_col = float(rows.mean()), float(cols.mean())
    lon = grid.origin_lon + (mean_col + 0.5) * grid.dx_deg
    lat = grid.origin_lat - (mean_row + 0.5) * grid.dy_deg
    fill_rise = grid.z_route.ravel()[flat] - grid.z.ravel()[flat]
    max_depth = float(depth_flat[flat].max())
    max_fill_rise = float(fill_rise.max()) if fill_rise.size else 0.0
    return {
        "cells": int(flat.size),
        "volume_m3": float(depth_flat[flat].sum() * grid.area_m2),
        "lat": lat,
        "lon": lon,
        "nearest": nearest_element(grid, mean_row, mean_col),
        "rise_exceeded": bool(max_depth > max_fill_rise + 1e-9),
        "max_depth_m": max_depth,
        "max_fill_rise_m": max_fill_rise,
    }


def e3_mass_split(
    run: dict, grid: TerrainGrid, p4_distance_m: np.ndarray
) -> dict[str, float]:
    final = run["final"]
    mass = run["response"].summary["mass_balance_m3"]
    buckets = {
        "<100 m": p4_distance_m < 100.0,
        "100–300 m": (p4_distance_m >= 100.0) & (p4_distance_m <= 300.0),
        ">300 m": p4_distance_m > 300.0,
    }
    result = {
        label: float(final[mask].sum() * grid.area_m2)
        for label, mask in buckets.items()
    }
    result["drenado"] = float(mass["salida_drenaje"])
    result["salido por borde"] = float(mass["salida_borde"])
    result["residual"] = float(mass["residual"])
    result["entrada P4"] = float(mass["entrada_ingreso"])
    result["almacenado total"] = float(mass["almacenada"])
    return result


def make_hourly_rows(rows: list[dict], section: str) -> str:
    if section == "e1":
        headers = [
            "Hora", "Lluvia mm/h", "Drenaje mm/h", "Lluvia neta mm/h",
            "Área total ha", "Dentro campus ha", "Fuera campus ha",
            "Celdas ≥1 cm", "Prof. máx. cm",
        ]
        table_rows = [[
            f"h+{item['hour']}",
            number(item["rain"], 2),
            number(item["drain"], 1),
            number(item["net_rain"], 2),
            number(item["area_ha"], 3),
            number(item["inside_ha"], 3),
            number(item["outside_ha"], 3),
            str(item["cells"]),
            number(item["max_cm"], 1),
        ] for item in rows]
    else:
        headers = ["Hora", "Área mojada ha", "Dist. máxima P4 m", "Cota mínima m"]
        table_rows = [[
            f"h+{item['hour']}",
            number(item["area_ha"], 3),
            number(item["distance_m"], 1),
            number(item["min_elevation_m"], 2)
            if math.isfinite(item["min_elevation_m"]) else "—",
        ] for item in rows]
    return markdown_table(headers, table_rows)


def main() -> None:
    params, raw, base_grid, campus_mask, p4_distance_m, p4_near_mask = load_inputs()
    current_cap = params.get("fill_max_rise_m", {}).get("value")
    visible_m = float(params["propagacion"]["umbral_profundidad_visible_m"]["value"])
    if abs(visible_m - VISIBLE_M) > 1e-12:
        raise ValueError(
            f"El umbral visible cambió a {visible_m:g} m; actualiza el umbral del diagnóstico."
        )
    drain_values = {
        key: float(value["value"])
        for key, value in params["capacidad_drenaje_mm_h"].items()
        if isinstance(value, dict) and "value" in value
    }
    preset_map = {item["id"]: item for item in params["presets"]}
    extreme = preset_map["extremo_hipotetico"]
    extreme_rain = build_rainfall_series(extreme, HOURS)
    zero_rain = [0.0] * HOURS
    grid_current = grid_with_fill(raw, params, current_cap)
    grid_current.apply_runoff_coefficients(params["coeficientes_escorrentia"])

    report: list[str] = [
        "# Diagnóstico de salto y alcance del agua modelada",
        "",
        "**Alcance:** diagnóstico exploratorio del motor en `backend/app/services/hydro.py`; "
        "no modifica código, datos ni parámetros existentes.",
        "",
        f"- Horizonte: {HOURS} horas; malla {base_grid.ny}×{base_grid.nx}, "
        f"celda {base_grid.cell_size_m:g} m; umbral mojado ≥{visible_m * 100:g} cm.",
        f"- Perímetro: unión de las geometrías `perimetro_campus` de "
        f"`campus_unt.geojson`; clasificación de celdas por centro.",
        f"- Relleno vigente leído: {current_cap if current_cap is not None else 'sin tope'} m; "
        "el tope se recalcula en memoria para cada corrida que lo requiere.",
        f"- El serializador GeoJSON de los marcos horarios se omite temporalmente en memoria "
        "para acelerar el diagnóstico; la propagación y láminas las calcula `simulate_core`.",
        "- “Lluvia neta” se define aquí como max(lluvia − capacidad de drenaje, 0), antes de "
        "aplicar coeficientes de escorrentía; se informan ambos términos aparte.",
        f"- “Cerca de P4” en E4 significa centro de celda dentro de {NEAR_P4_M:.0f} m del "
        "punto P4 (-79,035987; -8,111670).",
        "- En E3, “área mojada” usa celdas ≥1 cm; distancia desde P4 por distancia plana "
        "local; cota mínima es elevación cruda del DEM.",
        "",
        "## E1-E2 — Extremo hipotético y sensibilidad al drenaje",
        "",
        f"Se usa el hietograma del preset `{extreme['id']}` ({extreme['total_mm']:g} mm en "
        f"{extreme['window_hours']} h); P4 alto; drenaje pendiente deficiente, normal y "
        "obstruido. Para conservar el preset completo se mantiene su ingreso secundario "
        f"P1-P3={bool(extreme.get('defaults', {}).get('secondary_inflow', False))}. "
        f"Relleno: {current_cap if current_cap is not None else 'sin tope'} m.",
        "",
    ]

    e1_runs: dict[str, dict] = {}
    e1_rows: dict[str, list[dict]] = {}
    for drainage in ("pendiente_deficiente", "normal", "obstruido"):
        run = run_case(
            params, grid_current, extreme_rain, drainage, "alto",
            bool(extreme.get("defaults", {}).get("secondary_inflow", False)),
        )
        e1_runs[drainage] = run
        stats = hourly_statistics(
            run, grid_current, campus_mask, p4_distance_m, extreme_rain,
            drain_values[drainage],
        )
        for item in stats:
            item["drain"] = drain_values[drainage]
        e1_rows[drainage] = stats
        report.extend([
            f"### E1 — Drenaje `{drainage}` ({drain_values[drainage]:g} mm/h)",
            "",
            make_hourly_rows(stats, "e1"),
            "",
        ])

    report.extend([
        "### Saltos de área >5× y término asociado",
        "",
        "El drenaje es un término de remoción, no una fuente de agua. La atribución "
        "distingue el pulso de lluvia (si lluvia neta >0) del aumento bajo ingreso "
        "externo sostenido cuando lluvia neta=0. El drenaje insuficiente se informa como "
        "condición que permite persistencia, no como aporte de agua.",
        "",
    ])
    jump_rows = []
    for drainage, stats in e1_rows.items():
        jumps = []
        for previous, current in zip(stats, stats[1:]):
            if previous["area_ha"] > 0 and current["area_ha"] > 5.0 * previous["area_ha"]:
                cause = (
                    "pulso de lluvia; el drenaje modula la retención"
                    if current["net_rain"] > 0
                    else "P4 sostenido con remoción limitada"
                )
                jumps.append(
                    f"h+{current['hour']}: {number(previous['area_ha'], 3)}→"
                    f"{number(current['area_ha'], 3)} ha "
                    f"({current['area_ha'] / previous['area_ha']:.1f}×)"
                    f"; lluvia={number(current['rain'], 2)}, "
                    f"drenaje={number(current['drain'], 1)} mm/h; {cause}"
                )
        zero_to_wet = [
            item for previous, item in zip(stats, stats[1:])
            if previous["area_ha"] == 0 and item["area_ha"] > 0
        ]
        if not jumps:
            jump_rows.append([drainage, "No hay salto >5× con área previa >0."])
        else:
            jump_rows.extend([[drainage, jump] for jump in jumps])
        for item in zero_to_wet:
            jump_rows.append([
                drainage,
                f"h+{item['hour']}: emerge de 0 a {number(item['area_ha'], 3)} ha "
                "(no se define razón ×); "
                + ("coincide con lluvia neta >0." if item["net_rain"] > 0
                   else "con lluvia neta=0, bajo P4 sostenido."),
            ])
    report.extend([
        markdown_table(["Drenaje", "Horas con >5× (y emergencias desde cero)"], jump_rows),
        "",
        "### Resumen E1-E2",
        "",
        markdown_table(
            [
                "Drenaje", "Hora área pico", "Área pico ha", "Prof. máx. cm",
                "h+48 área ha", "Pico fuera campus %",
            ],
            [[
                drainage,
                f"h+{run['response'].summary['peak_hour']}",
                number(run["response"].summary["peak_wet_area_m2"] / 10_000, 3),
                number(run["response"].summary["max_depth_cm"], 1),
                number(run["response"].summary["final_wet_area_m2"] / 10_000, 3),
                number(
                    100.0 * (
                        e1_rows[drainage][run["response"].summary["peak_hour"] - 1]["outside_ha"]
                        / max(
                            e1_rows[drainage][run["response"].summary["peak_hour"] - 1]["area_ha"],
                            1e-12,
                        )
                    ),
                    1,
                ),
            ] for drainage, run in e1_runs.items()],
        ),
        "",
        "### Balance de masa E1-E2",
        "",
        markdown_table(
            ["Drenaje", "Lluvia entrada m³", "Ingreso m³", "Drenado m³",
             "Borde m³", "Almacenado h+48 m³", "Residual m³"],
            [[
                drainage,
                number(run["response"].summary["mass_balance_m3"]["entrada_lluvia"], 1),
                number(run["response"].summary["mass_balance_m3"]["entrada_ingreso"], 1),
                number(run["response"].summary["mass_balance_m3"]["salida_drenaje"], 1),
                number(run["response"].summary["mass_balance_m3"]["salida_borde"], 1),
                number(run["response"].summary["mass_balance_m3"]["almacenada"], 1),
                number(run["response"].summary["mass_balance_m3"]["residual"], 3),
            ] for drainage, run in e1_runs.items()],
        ),
        "",
        "**Pérdidas iniciales/infiltración:** no existe.",
        "",
        "## E3 — Alcance de P4 sin lluvia",
        "",
        "Todas las corridas usan lluvia cero, P1-P3 desactivado y sumideros reportados "
        "desactivados; solo entra agua por P4. Las cotas del relleno se recalculan en "
        "memoria para 0,5 m, 1,0 m y sin tope.",
        "",
    ])

    e3_runs: dict[tuple[float | None, str, str], dict] = {}
    e3_stats: dict[tuple[float | None, str, str], list[dict]] = {}
    cap_labels = ((0.5, "0,5 m"), (1.0, "1,0 m"), (None, "sin tope"))
    for cap, cap_label in cap_labels:
        grid = grid_with_fill(raw, params, cap)
        for drainage in ("normal", "pendiente_deficiente"):
            for inflow in ("bajo", "medio", "alto"):
                key = (cap, drainage, inflow)
                run = run_case(params, grid, zero_rain, drainage, inflow, False)
                e3_runs[key] = run
                e3_stats[key] = hourly_statistics(
                    run, grid, campus_mask, p4_distance_m, zero_rain,
                    drain_values[drainage],
                )
                report.extend([
                    f"### Tope {cap_label} · drenaje `{drainage}` · P4 `{inflow}`",
                    "",
                    make_hourly_rows(e3_stats[key], "e3"),
                    "",
                ])

    report.extend([
        "### Distribución del volumen de ingreso al final de h+48",
        "",
        "Los tres anillos almacenados particionan el volumen final en celdas según su "
        "distancia plana a P4. Drenado y salida por borde son acumulados del balance del "
        "motor durante las 48 h; el residual se muestra para comprobar cierre.",
        "",
    ])
    volume_rows = []
    basin_rows = []
    for cap, cap_label in cap_labels:
        grid = grid_with_fill(raw, params, cap)
        for drainage in ("normal", "pendiente_deficiente"):
            for inflow in ("bajo", "medio", "alto"):
                key = (cap, drainage, inflow)
                run = e3_runs[key]
                split = e3_mass_split(run, grid, p4_distance_m)
                volume_rows.append([
                    cap_label, drainage, inflow,
                    number(split["entrada P4"], 1),
                    number(split["<100 m"], 1),
                    number(split["100–300 m"], 1),
                    number(split[">300 m"], 1),
                    number(split["drenado"], 1),
                    number(split["salido por borde"], 1),
                    number(split["residual"], 3),
                ])
                basin = largest_wet_component(grid, run["final"])
                if basin is None:
                    basin_rows.append([
                        cap_label, drainage, inflow, "sin celdas ≥1 cm", "—", "—",
                        "no observable",
                    ])
                else:
                    nearest = basin["nearest"]
                    overflow = (
                        "sí (proxy: profundidad supera desnivel de relleno local)"
                        if basin["rise_exceeded"]
                        else "no según proxy de desnivel de relleno"
                    )
                    basin_rows.append([
                        cap_label, drainage, inflow,
                        f"{basin['lat']:.6f}, {basin['lon']:.6f}",
                        f"{nearest['name']} ({number(nearest['distance_m'], 0)} m)"
                        if nearest else "—",
                        f"{number(basin['volume_m3'], 1)} m³ / {basin['cells']} celdas",
                        overflow,
                    ])
    report.extend([
        markdown_table(
            ["Tope", "Drenaje", "P4", "Ingreso m³", "<100 m almacenado",
             "100–300 m almacenado", ">300 m almacenado", "Drenado m³",
             "Borde m³", "Residual m³"],
            volume_rows,
        ),
        "",
        "### Mayor componente mojada al cierre y proxy de desborde",
        "",
        "El motor no delimita cuencas hidrológicas ni emite un indicador de desborde. "
        "Para responder de forma reproducible, se toma la componente conexa (8 vecinos) "
        "de celdas ≥1 cm con mayor volumen final. El proxy de desborde indica si la "
        "profundidad máxima de esa componente supera el mayor desnivel de relleno "
        "(`z_routing − z`) dentro de ella; no equivale a un desborde observado ni a una "
        "cota de vertido hidrológica validada.",
        "",
        markdown_table(
            ["Tope", "Drenaje", "P4", "Centro lat, lon", "Elemento más cercano",
             "Agua en componente", "¿Desborda? (proxy)"],
            basin_rows,
        ),
        "",
        "## E4 — Magnitudes comparadas",
        "",
    ])

    gross_rain_m3, modeled_runoff_m3 = rainfall_volume_campus(
        extreme_rain, grid_current, campus_mask
    )
    inflow_per_hour = {
        level: float(params["ingreso_p4_m3_h_por_celda"][level]["value"])
        * (1.0 - float(params["intercepcion_buzonetas"]["value"]))
        * int(grid_current.inlets["p4"].size)
        for level in ("bajo", "medio", "alto")
    }
    local_open_cells = int((p4_near_mask & grid_current.open_mask).sum())
    e4_rows = []
    for level, hour_value in inflow_per_hour.items():
        total = hour_value * HOURS
        e4_rows.append([
            level, number(hour_value, 1), number(total, 1),
            number(gross_rain_m3, 1), number(total / gross_rain_m3, 3),
            number(modeled_runoff_m3, 1), number(total / modeled_runoff_m3, 3),
        ])
    report.extend([
        f"En el preset extremo hay {extreme['total_mm']:g} mm de precipitación. "
        f"El perímetro digital cubre {number(campus_mask.sum() * grid_current.area_m2 / 10000, 2)} "
        f"ha según centros de celda; volumen bruto de lluvia en esa huella: "
        f"{number(gross_rain_m3, 1)} m³. El escurrimiento ponderado por coeficientes "
        f"de superficie del motor suma {number(modeled_runoff_m3, 1)} m³.",
        "",
        markdown_table(
            ["P4", "Ingreso/h m³", "Ingreso 48 h m³", "Lluvia bruta campus m³",
             "P4/lluvia bruta", "Escorrentía modelada campus m³", "P4/escorrentía"],
            e4_rows,
        ),
        "",
        f"Para la capacidad teórica cercana a P4 se cuentan {local_open_cells} celdas "
        f"abiertas dentro de {NEAR_P4_M:.0f} m. Es un máximo (capacidad × área × 48 h), "
        "no extracción realizada: el motor solo drena cuando hay agua disponible.",
        "",
        markdown_table(
            ["Estado", "Capacidad mm/h", "Capacidad local teórica 48 h m³",
             "Ingreso P4 bajo", "Ingreso P4 medio", "Ingreso P4 alto"],
            [[
                state, number(capacity, 1),
                number(capacity / 1000 * grid_current.area_m2 * local_open_cells * HOURS, 1),
                number(inflow_per_hour["bajo"] * HOURS, 1),
                number(inflow_per_hour["medio"] * HOURS, 1),
                number(inflow_per_hour["alto"] * HOURS, 1),
            ] for state, capacity in drain_values.items()],
        ),
        "",
        "## Conclusiones (5 líneas)",
        "",
    ])

    baseline_stats = e1_rows["pendiente_deficiente"]
    significant_jumps = []
    for previous, current in zip(baseline_stats, baseline_stats[1:]):
        if previous["area_ha"] > 0 and current["area_ha"] > 5 * previous["area_ha"]:
            significant_jumps.append((current["area_ha"] / previous["area_ha"], previous, current))
    if significant_jumps:
        ratio, previous, current = max(significant_jumps, key=lambda item: item[0])
        cause_a = (
            f"h+{current['hour']} {ratio:.1f}× ({number(previous['area_ha'], 3)}→"
            f"{number(current['area_ha'], 3)} ha), con lluvia neta "
            f"{number(current['net_rain'], 2)} mm/h; pulso de lluvia, "
            f"drenaje={number(current['drain'], 1)} mm/h"
        )
    else:
        cause_a = (
            "ninguna hora con área previa positiva superó 5×; revisar tabla de "
            "emergencias desde cero y pulsos del hietograma"
        )

    deficient_medium = e3_runs[(0.5, "pendiente_deficiente", "medio")]["response"]
    normal_medium = e3_runs[(0.5, "normal", "medio")]["response"]
    mass_def = deficient_medium.summary["mass_balance_m3"]
    mass_norm = normal_medium.summary["mass_balance_m3"]
    cause_b = (
        f"P4 medio aporta {number(mass_def['entrada_ingreso'], 1)} m³; con drenaje "
        f"deficiente quedan {number(mass_def['almacenada'], 1)} m³ almacenados y "
        f"{number(mass_def['salida_drenaje'], 1)} m³ drenados, frente a "
        f"{number(mass_norm['almacenada'], 1)} m³ almacenados con drenaje normal"
    )

    base_vol = e3_runs[(0.5, "pendiente_deficiente", "alto")]["response"].summary["mass_balance_m3"]["almacenada"]
    candidates = []
    comparison_cases = [
        (
            "validar/reducir el supuesto de P4 alto a medio",
            e3_runs[(0.5, "pendiente_deficiente", "medio")],
        ),
        (
            "validar/mejorar drenaje pendiente deficiente a normal",
            e3_runs[(0.5, "normal", "alto")],
        ),
    ]
    for label, candidate_run in comparison_cases:
        stored = candidate_run["response"].summary["mass_balance_m3"]["almacenada"]
        candidates.append((abs(base_vol - stored), label, stored, base_vol - stored))
    fill_alternatives = [
        (cap, e3_runs[(cap, "pendiente_deficiente", "alto")])
        for cap in (1.0, None)
    ]
    cap, alternative = max(
        fill_alternatives,
        key=lambda item: abs(
            base_vol - item[1]["response"].summary["mass_balance_m3"]["almacenada"]
        ),
    )
    alt_stored = alternative["response"].summary["mass_balance_m3"]["almacenada"]
    cap_label = "1,0 m" if cap == 1.0 else "sin tope"
    candidates.append((
        abs(base_vol - alt_stored),
        f"validar el tope de relleno de 0,5 m frente a {cap_label}",
        alt_stored,
        base_vol - alt_stored,
    ))
    candidates.sort(key=lambda item: item[0], reverse=True)

    conclusions = [
        f"1. (a) Salto más marcado: {cause_a}; el drenaje no añade volumen, pero su capacidad "
        "menor que el aporte neto deja agua disponible para expandir el área.",
        f"2. (b) Menor descenso del agua: {cause_b}; la diferencia entre entrada, drenaje, "
        "borde y almacenamiento se contrasta en los balances E1-E3.",
    ]
    for rank, (_, label, stored, delta) in enumerate(candidates, start=1):
        direction = "reduce" if delta > 0 else "aumenta"
        conclusions.append(
            f"{rank}. (c) Candidato #{rank}: {label}; almacenamiento final "
            f"{number(base_vol, 1)}→{number(stored, 1)} m³ "
            f"({direction} {number(abs(delta), 1)} m³ en la comparación modelada); "
            "no aplicado."
        )
    report.extend(conclusions)
    report.extend([
        "",
        "---",
        "Todas las magnitudes son resultados del modelo simplificado y dependen de la "
        "malla, hietograma y parámetros supuestos; no son mediciones ni validan "
        "inundaciones reales. La diferencia entre escorrentía, drenaje y almacenamiento "
        "debe interpretarse con esa limitación.",
        "",
    ])
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text("\n".join(report), encoding="utf-8")
    print(f"Informe escrito: {OUT_PATH}")
    print(f"Corridas E1/E2: {len(e1_runs)}; corridas E3: {len(e3_runs)}.")
    print(f"Perimetro: {int(campus_mask.sum())} celdas; P4 <=100 m: {local_open_cells} celdas.")
    print("Conclusiones (5 líneas) incluidas en el informe.")


if __name__ == "__main__":
    main()
