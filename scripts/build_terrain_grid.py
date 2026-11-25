#!/usr/bin/env python3
"""Preprocesamiento OFFLINE que genera ``backend/app/data/terrain_grid.json``.

Uso:
    python scripts/build_terrain_grid.py

DEPENDENCIAS
------------
Solo **numpy** y **shapely** (las mismas dependencias de producción del backend),
más el DEM Copernicus GLO-30 en ``scripts/dem/S09_W080.tif`` y
``backend/app/data/campus_unt.geojson``.

**No usa rasterio/GDAL.** Reutiliza el lector mínimo de GeoTIFF (numpy + zlib) de
``scripts/analyze_dem.py``. Si en el futuro se quisiera usar ``rasterio``, sería
una dependencia **SOLO de ``scripts/``** (nunca del backend en producción):
se instalaría aparte (``pip install rasterio``) y habría que documentarlo aquí.
El backend jamás importa este módulo: solo lee el JSON que produce.

QUÉ GENERA
----------
Cuadrícula regular de celdas de 10 m sobre el perímetro del campus + 100 m de margen:

* elevación interpolada (bilineal) desde el DEM de 30 m  -> **NO agrega información**;
  es la misma superficie del DEM vista en una malla más fina;
* máscara de edificios (huellas de ``campus_unt.geojson``) como celdas BLOQUEADAS;
* clase de superficie por celda: edificio/techo, vía, estacionamiento,
  área deportiva, área verde, otro;
* celdas de borde del campus por donde el agua puede salir del campus;
* celdas de ingreso: **P4 (obligatoria)** y, como secundarias, las puertas P1–P3
  de la Av. Juan Pablo II (peso bajo e incierto);
* los elementos del catálogo (edificios, accesos, estacionamientos, áreas
  deportivas) con sus celdas, para el resumen por elemento.

El GLO-30 es un DSM (incluye edificios y árboles): los píxeles con >= 40 % de
cobertura edificada se enmascaran y se rellenan por vecindad antes de interpolar,
igual que ``analyze_dem.py``, para no crear costas artificiales sobre los patios.

Este script se ejecuta A MANO. El backend solo lee el JSON resultante.
"""
from __future__ import annotations

import heapq
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Point, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from analyze_dem import (  # noqa: E402  (import tras sys.path, es un script hermano)
    VERT_ERROR_M,
    building_cover,
    fill_nan,
    read_geotiff_window,
)

DATA_DIR = ROOT / "backend" / "app" / "data"
CAMPUS_PATH = DATA_DIR / "campus_unt.geojson"
DEM_PATH = ROOT / "scripts" / "dem" / "S09_W080.tif"
OUT_PATH = DATA_DIR / "terrain_grid.json"

# --- geometría de la cuadrícula -------------------------------------------------
CELL_SIZE_M = 10.0
CAMPUS_MARGIN_M = 100.0
LAT0 = -8.114
KX = 111320.0 * math.cos(math.radians(LAT0))
KY = 110574.0
DX_DEG = CELL_SIZE_M / KX
DY_DEG = CELL_SIZE_M / KY

# --- superficies y bloqueos -----------------------------------------------------
SURFACE_CLASSES = ("edificio", "via", "estacionamiento", "area_deportiva", "area_verde", "otro")
BUILDING_BLOCK_COVER = 0.50   # fracción de cobertura que deja la celda BLOQUEADA
DEM_BUILDING_COVER = 0.40     # píxeles DEM con esta cobertura se enmascaran (DSM)
ROAD_HALF_WIDTH_M = 5.0       # SUPUESTO: media anchura de vía (OSM no trae "width")
EDGE_BAND_M = 7.1             # media diagonal de una celda de 10 m

# --- ingresos -------------------------------------------------------------------
P4_LON, P4_LAT = -79.035987, -8.11167   # Puerta 4, Av. Jesús de Nazareth (obligatoria)
INLET_RADIUS_M = 12.0
SECONDARY_GATE_NAMES = ("puerta 1", "puerta 2", "puerta 3")  # Av. Juan Pablo II (incierto)

# --- elementos del catálogo -----------------------------------------------------
ELEMENT_CATEGORIES = ("edificio", "acceso", "estacionamiento", "area_deportiva")
ACCESS_RADIUS_M = 15.0   # los accesos son puntos OSM: se toma un radio
RING_M = 10.0            # anillo alrededor de la huella si todo está bloqueado


def _bilinear_at(dem: np.ndarray, x0: float, y0: float, dx: float, dy: float,
                 xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
    """Interpola bilineal el DEM en los centros de celda (xs, ys).

    x0/y0 = esquina superior izquierda del píxel [0, 0]; dx/dy > 0.
    """
    n_r, n_c = dem.shape
    px = x0 + (np.arange(n_c) + 0.5) * dx
    py = y0 - (np.arange(n_r) + 0.5) * dy
    fx = np.clip((xs - px[0]) / dx, 0.0, n_c - 1.0)          # (nx,)
    fy = np.clip((py[0] - ys) / dy, 0.0, n_r - 1.0)          # (ny,)
    j0 = np.floor(fx).astype(np.int32)          # (nx,)
    i0 = np.floor(fy).astype(np.int32)          # (ny,)
    j1 = np.minimum(j0 + 1, n_c - 1)
    i1 = np.minimum(i0 + 1, n_r - 1)
    wx = (fx - j0)[None, :]                     # (1, nx)
    wy = (fy - i0)[:, None]                     # (ny, 1)
    jj0, ii0 = j0[None, :], i0[:, None]
    jj1, ii1 = j1[None, :], i1[:, None]
    top = dem[ii0, jj0] * (1.0 - wx) + dem[ii0, jj1] * wx
    bot = dem[ii1, jj0] * (1.0 - wx) + dem[ii1, jj1] * wx
    return top * (1.0 - wy) + bot * wy


def _mask(geom, X: np.ndarray, Y: np.ndarray) -> np.ndarray:
    if geom is None or geom.is_empty:
        return np.zeros(X.shape, dtype=bool)
    shapely.prepare(geom)
    return shapely.contains_xy(geom, X, Y)


def _union(features, categories: tuple[str, ...] | list[str]):
    geoms = [
        shape(f["geometry"])
        for f in features
        if f.get("properties", {}).get("category") in categories
        and f.get("geometry")
    ]
    if not geoms:
        return None
    return unary_union(geoms)


def _priority_flood_fill(elevation: np.ndarray, blocked: np.ndarray) -> np.ndarray:
    """Rellena microdepresiones cerradas hasta su nivel de vertida (priority flood).

    Método estándar de procesamiento de DEM para enrutamiento de flujo (mismo
    principio que GRASS ``r.fill.dir``/GDAL ``gdalwarp -dstnodata`` + ``sieve``):
    sin relleno, el error vertical de +/-4 m del DEM de 30 m deja miles de
    hoyos de 10 m donde el agua quedaría atrapada y no podría drenar.
    Solo se SUBEN celdas (nunca se baja el relieve) y las celdas bloqueadas
    (edificios) actúan como muros. La elevación cruda se conserva aparte para
    reportar cotas; esta superficie se usa únicamente para el enrutamiento.
    """
    ny, nx = elevation.shape
    filled = elevation.copy()
    visited = blocked.copy()
    heap: list[tuple[float, int, int]] = []

    def _seed(r: int, c: int) -> None:
        if not visited[r, c]:
            visited[r, c] = True
            heapq.heappush(heap, (float(elevation[r, c]), r, c))

    for r in range(ny):
        _seed(r, 0)
        _seed(r, nx - 1)
    for c in range(nx):
        _seed(0, c)
        _seed(ny - 1, c)

    while heap:
        level, r, c = heapq.heappop(heap)
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                if dr == 0 and dc == 0:
                    continue
                nr, nc = r + dr, c + dc
                if not (0 <= nr < ny and 0 <= nc < nx) or visited[nr, nc]:
                    continue
                visited[nr, nc] = True
                if blocked[nr, nc]:
                    continue
                nlv = max(level, float(elevation[nr, nc]))
                if nlv > elevation[nr, nc]:
                    filled[nr, nc] = nlv
                heapq.heappush(heap, (nlv, nr, nc))
    return filled


def main() -> None:
    campus_data = json.loads(CAMPUS_PATH.read_text(encoding="utf-8"))
    features = campus_data["features"]

    perimeter = _union(features, ("perimetro_campus",))
    if perimeter is None:
        sys.exit("campus_unt.geojson no tiene perímetro de campus.")
    buildings = _union(features, ("edificio",))
    parking = _union(features, ("estacionamiento",))
    sports = _union(features, ("area_deportiva",))
    greens = _union(features, ("area_verde",))

    road_geoms = [
        shape(f["geometry"])
        for f in features
        if f.get("properties", {}).get("category") == "via" and f.get("geometry")
    ]
    roads = (
        unary_union([g.buffer(ROAD_HALF_WIDTH_M / KY) for g in road_geoms])
        if road_geoms else None
    )

    # --- cuadrícula: perímetro del campus + margen, ajustada a múltiplos de 10 m ---
    minx, miny, maxx, maxy = perimeter.bounds
    gx0 = math.floor((minx - CAMPUS_MARGIN_M / KX) / DX_DEG) * DX_DEG
    gy0 = math.floor((miny - CAMPUS_MARGIN_M / KY) / DY_DEG) * DY_DEG
    gx1 = math.ceil((maxx + CAMPUS_MARGIN_M / KX) / DX_DEG) * DX_DEG
    gy1 = math.ceil((maxy + CAMPUS_MARGIN_M / KY) / DY_DEG) * DY_DEG
    nx = int(round((gx1 - gx0) / DX_DEG))
    ny = int(round((gy1 - gy0) / DY_DEG))
    if nx * ny > 400_000:
        sys.exit(f"Cuadrícula demasiado grande ({nx}x{ny}). Revisa el perímetro.")

    xs = gx0 + (np.arange(nx) + 0.5) * DX_DEG
    ys = gy1 - (np.arange(ny) + 0.5) * DY_DEG
    X, Y = np.meshgrid(xs, ys)

    # --- elevación: DEM de 30 m, edificios enmascados y rellenos, luego bilineal ---
    pad_lon = 3 * DX_DEG
    pad_lat = 3 * DY_DEG
    dem, dx0, dy0, ddx, ddy = read_geotiff_window(
        str(DEM_PATH), gx0 - pad_lon, gy0 - pad_lat, gx1 + pad_lon, gy1 + pad_lat
    )
    native_cover = building_cover(dem.shape, dx0, dy0, ddx, ddy, buildings, sub=3)
    dem = fill_nan(np.where(native_cover >= DEM_BUILDING_COVER, np.nan, dem))
    elevation = _bilinear_at(dem, dx0, dy0, ddx, ddy, xs, ys)

    # --- bloqueo por huellas de edificios ---------------------------------------
    grid_cover = building_cover((ny, nx), gx0, gy1, DX_DEG, DY_DEG, buildings, sub=3)
    blocked = grid_cover >= BUILDING_BLOCK_COVER
    open_mask = ~blocked

    # --- superficie de enrutamiento: relleno de microdepresiones ---------------
    elevation_routing = _priority_flood_fill(elevation, blocked)
    fill_delta = elevation_routing - elevation
    n_filled = int((fill_delta > 1e-9).sum())

    # --- clase de superficie (prioridad creciente: lo último sobrescribe) -------
    classes = np.full((ny, nx), SURFACE_CLASSES.index("otro"), dtype=np.uint8)
    for cat in ("area_verde", "area_deportiva", "estacionamiento", "via"):
        geom = {"area_verde": greens, "area_deportiva": sports,
                "estacionamiento": parking, "via": roads}[cat]
        if geom is not None:
            classes[_mask(geom, X, Y)] = SURFACE_CLASSES.index(cat)
    classes[blocked] = SURFACE_CLASSES.index("edificio")

    # --- celdas de borde del campus (por donde el agua sale del campus) ---------
    edge_geom = perimeter.boundary.buffer(EDGE_BAND_M / KY)
    campus_edge = _mask(edge_geom, X, Y)

    # --- celdas de ingreso -------------------------------------------------------
    p4_point = Point(P4_LON, P4_LAT)
    p4_cells = np.flatnonzero(_mask(p4_point.buffer(INLET_RADIUS_M / KY), X, Y).ravel())
    if p4_cells.size == 0:
        sys.exit("No se encontraron celdas de ingreso para la Puerta 4.")

    secondary_geoms = []
    for f in features:
        props = f.get("properties", {})
        if props.get("category") != "acceso" or not f.get("geometry"):
            continue
        name = (props.get("name") or "").lower()
        if any(gate in name for gate in SECONDARY_GATE_NAMES):
            secondary_geoms.append(shape(f["geometry"]))
    secondary_cells = (
        np.flatnonzero(_mask(unary_union(secondary_geoms).buffer(INLET_RADIUS_M / KY),
                             X, Y).ravel())
        if secondary_geoms else np.array([], dtype=np.int64)
    )

    # --- elementos del catálogo con sus celdas ----------------------------------
    elements = []
    for f in features:
        props = f.get("properties", {})
        if props.get("category") not in ELEMENT_CATEGORIES or not f.get("geometry"):
            continue
        geom = shape(f["geometry"])
        if geom.geom_type == "Point":
            cells = np.flatnonzero(_mask(geom.buffer(ACCESS_RADIUS_M / KY), X, Y).ravel())
            scope = f"radio_{ACCESS_RADIUS_M:g}m"
        else:
            inside = _mask(geom, X, Y) & open_mask
            if inside.any():
                cells = np.flatnonzero(inside.ravel())
                scope = "huella"
            else:
                ring = _mask(geom.buffer(RING_M / KY), X, Y) & open_mask
                cells = np.flatnonzero(ring.ravel())
                scope = f"anillo_{RING_M:g}m"
        elements.append({
            "id": props.get("id"),
            "name": props.get("name"),
            "category": props.get("category"),
            "scope": scope,
            "cells": [int(c) for c in cells],
        })

    # --- red de salida (vecinos abiertos, para repartir agua de tejados) ---------
    # La información útil para el motor se deja en el JSON; el cómputo es del runtime.

    grid = {
        "metadata": {
            "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "generator": "scripts/build_terrain_grid.py",
            "origin": (
                "DEM Copernicus GLO-30 (scripts/dem/S09_W080.tif) + "
                "campus_unt.geojson (OpenStreetMap, ODbL)"
            ),
            "dem_resolution_m": [30.6, 30.7],
            "dem_vertical_error_m": VERT_ERROR_M,
            "dem_is_dsm": (
                "GLO-30 es un DSM: los píxeles con >= 40 % de cobertura edificada se "
                "enmascaran y rellenan por vecindad antes de interpolar."
            ),
            "grid_resolution_m": CELL_SIZE_M,
            "campus_margin_m": CAMPUS_MARGIN_M,
            "interpolation": (
                "bilineal desde el DEM nativo de 30 m: suaviza la malla pero NO agrega "
                "información sobre el terreno real; el error vertical declarado de +/-4 m "
                "sigue siendo el límite de lo que se puede afirmar."
            ),
            "routing_fill": {
                "method": "priority flood (relleno de microdepresiones hasta su nivel de vertida)",
                "cells_filled": n_filled,
                "fill_max_m": round(float(fill_delta.max()), 3),
                "fill_mean_filled_m": (
                    round(float(fill_delta[fill_delta > 1e-9].mean()), 3) if n_filled else 0.0
                ),
                "source": "SUPUESTO / práctica estándar de procesamiento de DEM",
                "justification": (
                    "El DEM de 30 m con +/-4 m de error deja miles de hoyos de 10 m donde "
                    "el agua quedaría atrapada; sin relleno el flujo no puede drenar. Solo "
                    "se suben celdas y las cotas reportadas siguen siendo las del DEM crudo."
                ),
            },
            "road_half_width_m": {"value": ROAD_HALF_WIDTH_M, "unit": "m",
                                  "range": [3.0, 8.0], "source": "SUPUESTO",
                                  "justification": "OSM no publica el ancho de las vías "
                                                   "del campus; se asume media anchura típica."},
            "inlet_radius_m": {"value": INLET_RADIUS_M, "unit": "m", "range": [5.0, 25.0],
                               "source": "SUPUESTO",
                               "justification": "Radio alrededor del punto de Puerta 4 y de "
                                                "las puertas P1-P3 para marcar celdas de ingreso."},
            "disclaimer": (
                "Malla exploratoria de 10 m construida por interpolación de un DEM de 30 m "
                "y geometrías OSM no verificadas. No es un levantamiento topográfico ni un "
                "modelo hidráulico validado."
            ),
        },
        "shape": [ny, nx],
        "origin_lon": gx0,
        "origin_lat": gy1,
        "dx_deg": DX_DEG,
        "dy_deg": DY_DEG,
        "bounds": [gx0, gy0, gx1, gy1],
        "surface_classes": list(SURFACE_CLASSES),
        "elevation_m": [round(float(v), 2) for v in elevation.ravel()],
        "elevation_routing_m": [round(float(v), 2) for v in elevation_routing.ravel()],
        "surface_class": "".join(str(int(v)) for v in classes.ravel()),
        "blocked": "".join("1" if b else "0" for b in blocked.ravel()),
        "campus_edge": "".join("1" if b else "0" for b in campus_edge.ravel()),
        "inlets": [
            {"id": "p4", "label": "Puerta 4 (Av. Jesús de Nazareth)",
             "required": True, "weight": 1.0,
             "cells": [int(c) for c in p4_cells]},
            {"id": "secundario", "label": "P1-P3 (Av. Juan Pablo II)",
             "required": False, "weight": 0.3,
             "cells": [int(c) for c in secondary_cells]},
        ],
        "elements": elements,
    }
    OUT_PATH.write_text(json.dumps(grid, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")

    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"Cuadrícula {ny}x{nx} = {ny * nx} celdas de {CELL_SIZE_M:g} m "
          f"({(gx1 - gx0) * KX:.0f} x {(gy1 - gy0) * KY:.0f} m)")
    print(f"Celdas bloqueadas (edificios): {int(blocked.sum())} "
          f"| celdas de borde del campus: {int(campus_edge.sum())}")
    print(f"Ingreso P4: {p4_cells.size} celdas | ingreso secundario: {secondary_cells.size} celdas")
    print(f"Elevación: min {elevation.min():.1f} / max {elevation.max():.1f} m | "
          f"elementos: {len(elements)}")
    print(f"Relleno de microdepresiones (enrutamiento): {n_filled} celdas, "
          f"máx {float(fill_delta.max()):.2f} m | "
          f"cotas crudas: min {elevation.min():.1f} / max {elevation.max():.1f} m")
    print(f"Escrito: {OUT_PATH} ({size_kb:.0f} kB)")


if __name__ == "__main__":
    main()
