#!/usr/bin/env python3
"""Diagnóstico reproducible de acumulación y del tope de relleno (Fase 1.5).

Uso:
    python scripts_nuevos/diagnostico_acumulacion.py

Genera ``datos_nuevos/analisis/diagnostico_acumulacion_datos.json`` con:
  * estadística del relleno de microdepresiones (celdas, percentiles, top-20);
  * comparación de al menos 3 topes de relleno (sin tope, 1,0 m, 0,5 m);
  * para 3 casos, los 10 mayores grupos de celdas mojadas en la hora pico.

No modifica nada: solo lee ``terrain_grid.json`` y ``hydro_params.json`` y
recalcula el relleno en memoria. El tope vigente es el de
``hydro_params.json -> fill_max_rise_m``; los topes de comparación son
``[None, 1.0, 0.5]`` (más el vigente si no está en esa lista).
"""
from __future__ import annotations

import json
import math
import sys
from collections import deque
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "scripts_nuevos"))

from app.services.hydro import (  # noqa: E402
    TerrainGrid,
    build_rainfall_series,
    load_hydro_params,
    simulate_core,
)
from build_terrain_grid import _priority_flood_fill  # noqa: E402

DATA_DIR = ROOT / "backend" / "app" / "data"
OUT_JSON = ROOT / "datos_nuevos" / "analisis" / "diagnostico_acumulacion_datos.json"
VISIBLE_M = 0.01


# ---------------------------------------------------------------------------
# Utilidades de geometría
# ---------------------------------------------------------------------------
def _grid_from_raw(raw: dict, routing: np.ndarray | None = None) -> TerrainGrid:
    """TerrainGrid con superficie de enrutamiento sustituida (sin tocar el JSON)."""
    raw2 = dict(raw)
    if routing is not None:
        raw2["elevation_routing_m"] = [round(float(v), 3) for v in routing.ravel()]
    return TerrainGrid(raw2)


def _lonlat(grid: TerrainGrid, rows: np.ndarray, cols: np.ndarray):
    lon = grid.origin_lon + (cols + 0.5) * grid.dx_deg
    lat = grid.origin_lat - (rows + 0.5) * grid.dy_deg
    return float(lon.mean()), float(lat.mean())


def _element_index(grid: TerrainGrid) -> list[dict]:
    out = []
    for element in grid.elements:
        cells = element["cells"]
        if cells.size == 0:
            continue
        rows, cols = np.divmod(cells, grid.nx)
        out.append({
            "id": element["id"],
            "name": element["name"],
            "category": element["category"],
            "scope": element["scope"],
            "row": float(rows.mean()),
            "col": float(cols.mean()),
        })
    return out


def _nearest_element(grid: TerrainGrid, r: float, c: float, index: list[dict]) -> dict | None:
    best = None
    for element in index:
        dist = math.hypot((element["row"] - r) * grid.cell_size_m,
                          (element["col"] - c) * grid.cell_size_m)
        if best is None or dist < best["distance_m"]:
            best = {
                "id": element["id"],
                "name": element["name"],
                "category": element["category"],
                "distance_m": round(dist, 1),
            }
    return best


def _components(mask: np.ndarray) -> list[np.ndarray]:
    """Componentes conexas de 8 vecinos; devuelve arrays de índices planos."""
    ny, nx = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    groups: list[np.ndarray] = []
    for start in np.argwhere(mask):
        r0, c0 = int(start[0]), int(start[1])
        if seen[r0, c0]:
            continue
        queue = deque([(r0, c0)])
        seen[r0, c0] = True
        members = []
        while queue:
            r, c = queue.popleft()
            members.append(r * nx + c)
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    if dr == 0 and dc == 0:
                        continue
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < ny and 0 <= nc < nx and mask[nr, nc] and not seen[nr, nc]:
                        seen[nr, nc] = True
                        queue.append((nr, nc))
        groups.append(np.asarray(members, dtype=np.int64))
    return groups


def _sector_deg(vector_az: float) -> str:
    names = ("N", "NE", "E", "SE", "S", "SO", "O", "NO")
    return names[int(((vector_az + 22.5) % 360.0) // 45.0)]


def _peaks(grid: TerrainGrid, depth: np.ndarray, index: list[dict],
           min_cells: int = 5, min_depth_m: float = 0.05) -> list[dict]:
    """Grupos de celdas mojadas con acumulación apreciable, ordenados por área."""
    wet = depth >= VISIBLE_M
    groups = []
    for members in _components(wet):
        rows, cols = np.divmod(members, grid.nx)
        values = depth.ravel()[members]
        if values.max() < min_depth_m or members.size < min_cells:
            continue
        lon, lat = _lonlat(grid, rows, cols)
        groups.append({
            "cells": int(members.size),
            "area_m2": round(float(members.size) * grid.area_m2, 1),
            "max_depth_cm": round(float(values.max()) * 100.0, 1),
            "mean_depth_cm": round(float(values.mean()) * 100.0, 1),
            "centroid_lon": round(lon, 6),
            "centroid_lat": round(lat, 6),
            "raw_z_mean_m": round(float(grid.z.ravel()[members].mean()), 2),
            "routing_z_mean_m": round(float(grid.z_route.ravel()[members].mean()), 2),
            "nearest_element": _nearest_element(grid, rows.mean(), cols.mean(), index),
        })
    groups.sort(key=lambda g: (g["area_m2"], g["max_depth_cm"]), reverse=True)
    return groups


# ---------------------------------------------------------------------------
# Casos
# ---------------------------------------------------------------------------
def _cases(params: dict) -> list[dict]:
    presets = {p["id"]: p for p in params["presets"]}
    c2023 = presets["evento_2023_03_10"]
    extremo = presets["extremo_hipotetico"]
    return [
        {
            "id": "evento_2023_p4_medio",
            "label": "Evento 2023-03-10 (35 mm) con ingreso P4 medio",
            "series": build_rainfall_series(c2023),
            "kwargs": {
                "drainage_state": c2023["defaults"]["drainage_state"],
                "inflow_p4": c2023["defaults"]["inflow_p4"],
                "secondary_inflow": bool(c2023["defaults"]["secondary_inflow"]),
            },
        },
        {
            "id": "extremo_p4_alto",
            "label": "Extremo hipotético (70 mm) con ingreso P4 alto",
            "series": build_rainfall_series(extremo),
            "kwargs": {
                "drainage_state": extremo["defaults"]["drainage_state"],
                "inflow_p4": extremo["defaults"]["inflow_p4"],
                "secondary_inflow": bool(extremo["defaults"]["secondary_inflow"]),
            },
        },
        {
            "id": "solo_lluvia_sin_ingreso",
            "label": "Solo lluvia (35 mm) sin ingreso externo",
            "series": build_rainfall_series(c2023),
            "kwargs": {
                "drainage_state": "normal",
                "inflow_p4": "ninguno",
                "secondary_inflow": False,
            },
        },
    ]


def _run_case(grid: TerrainGrid, case: dict) -> dict:
    hourly: list[np.ndarray] = []
    resp, final_depth = simulate_core(
        case["series"], grid=grid, hourly_out=hourly, **case["kwargs"]
    )
    peak_hour = int(resp.summary["peak_hour"])
    depth = hourly[peak_hour - 1]
    return {
        "response": resp,
        "final_depth": final_depth,
        "peak_hour": peak_hour,
        "peak_depth": depth,
        "hourly": hourly,
    }


def _p4_vector(grid: TerrainGrid) -> tuple[float, float]:
    p4 = grid.inlets["p4"]
    rows, cols = np.divmod(p4, grid.nx)
    return float(rows.mean()), float(cols.mean())


def main() -> None:
    params = load_hydro_params()
    raw = json.loads((DATA_DIR / "terrain_grid.json").read_text(encoding="utf-8"))
    base = _grid_from_raw(raw)
    index = _element_index(base)
    p4_row, p4_col = _p4_vector(base)

    configured = params.get("fill_max_rise_m", {}).get("value")
    caps: list[float | None] = [None, 1.0, 0.5]
    if configured not in caps:
        caps.append(configured)

    cases = _cases(params)
    report: dict = {
        "generated_by": "scripts_nuevos/diagnostico_acumulacion.py",
        "grid": {
            "shape": [base.ny, base.nx],
            "cell_size_m": base.cell_size_m,
            "cells_total": base.n,
            "cells_blocked": int(base.blocked.sum()),
            "reported_zones": [
                {"id": z["id"], "label": z["label"], "cells": int(z["cells"].size)}
                for z in base.reported_zones.values()
            ],
        },
        "configured_fill_max_rise_m": configured,
        "caps_m": caps,
        "cases": [{"id": c["id"], "label": c["label"],
                   "params": c["kwargs"],
                   "rainfall_total_mm": round(sum(c["series"]), 2)} for c in cases],
        "fill": {},
        "comparison": {},
        "detail": {},
    }

    # --- relleno: estadística por tope ---------------------------------------
    elevation = base.z
    blocked = base.blocked
    fills: dict[str, np.ndarray] = {}
    for cap in caps:
        key = "sin_tope" if cap is None else f"{cap:g}m"
        filled = _priority_flood_fill(elevation, blocked, cap)
        fills[key] = filled
        rise = filled - elevation
        open_rise = rise[~blocked]
        filled_mask = rise > 5e-3
        top = np.argsort(open_rise)[-20:][::-1]
        flat_open = np.flatnonzero(~blocked.ravel())
        top_cells = flat_open[top]
        top_rows, top_cols = np.divmod(top_cells, base.nx)
        top_items = []
        for rank, (r, c, val) in enumerate(zip(top_rows, top_cols, open_rise[top]), start=1):
            lon, lat = _lonlat(base, np.array([r]), np.array([c]))
            near = _nearest_element(base, float(r), float(c), index)
            top_items.append({
                "rank": rank,
                "lon": round(lon, 6),
                "lat": round(lat, 6),
                "rise_m": round(float(val), 3),
                "raw_z_m": round(float(elevation[r, c]), 2),
                "nearest_element": near,
                "reported_zone": _zone_at(base, int(r), int(c)),
            })
        report["fill"][key] = {
            "cap_m": cap,
            "cells_filled": int(filled_mask.sum()),
            "p50_m": round(float(np.percentile(open_rise[open_rise > 5e-3], 50)), 3)
            if filled_mask.any() else 0.0,
            "p90_m": round(float(np.percentile(open_rise[open_rise > 5e-3], 90)), 3)
            if filled_mask.any() else 0.0,
            "p99_m": round(float(np.percentile(open_rise[open_rise > 5e-3], 99)), 3)
            if filled_mask.any() else 0.0,
            "max_m": round(float(open_rise.max()), 3),
            "top20": top_items,
        }

    # --- comparación de topes x casos ---------------------------------------
    for cap in caps:
        key = "sin_tope" if cap is None else f"{cap:g}m"
        grid = _grid_from_raw(raw, fills[key])
        per_case = {}
        for case in cases:
            run = _run_case(grid, case)
            groups = _peaks(grid, run["peak_depth"], index)
            zones = [g for g in groups if g["area_m2"] >= 500.0]
            per_case[case["id"]] = {
                "peak_hour": run["peak_hour"],
                "max_depth_cm": run["response"].summary["max_depth_cm"],
                "peak_wet_area_m2": run["response"].summary["peak_wet_area_m2"],
                "zones_ge_500m2": len(zones),
                "zones_top": [
                    {
                        "area_m2": g["area_m2"],
                        "max_depth_cm": g["max_depth_cm"],
                        "centroid_lon": g["centroid_lon"],
                        "centroid_lat": g["centroid_lat"],
                        "sector_from_p4": _sector_from_p4(base, p4_row, p4_col,
                                                          g["centroid_lon"], g["centroid_lat"]),
                        "nearest_element": g["nearest_element"],
                    }
                    for g in zones[:5]
                ],
            }
        report["comparison"][key] = per_case

    # --- detalle de los 10 mayores grupos con el tope vigente ----------------
    key_cfg = "sin_tope" if configured is None else f"{configured:g}m"
    grid_cfg = _grid_from_raw(raw, fills[key_cfg])
    for case in cases:
        run = _run_case(grid_cfg, case)
        groups = _peaks(grid_cfg, run["peak_depth"], index)
        mr, mc = np.unravel_index(int(np.argmax(run["peak_depth"])), run["peak_depth"].shape)
        max_lon, max_lat = _lonlat(grid_cfg, np.array([mr]), np.array([mc]))
        report["detail"][case["id"]] = {
            "cap_key": key_cfg,
            "peak_hour": run["peak_hour"],
            "max_depth_cm": run["response"].summary["max_depth_cm"],
            "max_location": {
                "lon": round(max_lon, 6),
                "lat": round(max_lat, 6),
                "raw_z_m": round(float(grid_cfg.z[mr, mc]), 2),
                "nearest_element": _nearest_element(grid_cfg, float(mr), float(mc), index),
                "sector_from_p4": _sector_from_p4(base, p4_row, p4_col, max_lon, max_lat),
                "reported_zone": _zone_at(grid_cfg, int(mr), int(mc)),
            },
            "mass_balance": run["response"].summary["mass_balance_m3"],
            "groups": [
                {
                    **g,
                    "sector_from_p4": _sector_from_p4(base, p4_row, p4_col,
                                                      g["centroid_lon"], g["centroid_lat"]),
                }
                for g in groups[:10]
            ],
            "zones_ge_500m2": len([g for g in groups if g["area_m2"] >= 500.0]),
        }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Escrito: {OUT_JSON}")

    print("\n== Relleno por tope ==")
    for key, block in report["fill"].items():
        print(f"{key:>9}: celdas={block['cells_filled']:5d} "
              f"p50={block['p50_m']:.2f} p90={block['p90_m']:.2f} "
              f"p99={block['p99_m']:.2f} max={block['max_m']:.2f} m")

    print("\n== Comparación topes x casos ==")
    header = f"{'tope':>9} | {'caso':<26} | {'pico':>5} | {'max_cm':>6} | {'area_m2':>7} | {'zonas':>5}"
    print(header)
    for key, per_case in report["comparison"].items():
        for case_id, row in per_case.items():
            print(f"{key:>9} | {case_id:<26} | {row['peak_hour']:5d} | "
                  f"{row['max_depth_cm']:6.1f} | {row['peak_wet_area_m2']:7.0f} | "
                  f"{row['zones_ge_500m2']:5d}")

    print("\n== Grupos (tope vigente) ==")
    for case_id, block in report["detail"].items():
        print(f"\n[{case_id}] pico h+{block['peak_hour']} max {block['max_depth_cm']} cm "
              f"| zonas>=500m2: {block['zones_ge_500m2']}")
        loc = block.get("max_location")
        if loc:
            near = loc["nearest_element"]
            print(f"  máx en {loc['sector_from_p4']} | z={loc['raw_z_m']} m | "
                  f"{near['name'][:40] if near else '-'} ({near['distance_m'] if near else '-'} m)"
                  f"{' | zona reportada: ' + loc['reported_zone']['label'] if loc.get('reported_zone') else ''}")
        for g in block["groups"][:10]:
            near = g["nearest_element"]
            print(f"  {g['area_m2']:7.0f} m2 | {g['max_depth_cm']:5.1f} cm | "
                  f"z {g['raw_z_mean_m']:5.2f}/{g['routing_z_mean_m']:5.2f} | "
                  f"{g['sector_from_p4']:>2} | {near['name'][:38] if near else '-'} "
                  f"({near['distance_m'] if near else '-'} m)")


def _zone_at(grid: TerrainGrid, r: int, c: int) -> str | None:
    cell = r * grid.nx + c
    for zone in grid.reported_zones.values():
        if cell in zone["cells"]:
            return zone["label"]
    return None


def _sector_from_p4(grid: TerrainGrid, p4_row: float, p4_col: float,
                    lon: float, lat: float) -> str:
    col = (lon - grid.origin_lon) / grid.dx_deg - 0.5
    row = (grid.origin_lat - lat) / grid.dy_deg - 0.5
    dx = (col - p4_col) * grid.cell_size_m
    dy = -(row - p4_row) * grid.cell_size_m
    if dx == 0.0 and dy == 0.0:
        return "P4"
    az = (math.degrees(math.atan2(dx, dy)) + 360.0) % 360.0
    return _sector_deg(az)


if __name__ == "__main__":
    main()
