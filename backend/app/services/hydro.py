"""Motor de agua simplificado — FASE 1 (solo backend, capa NUEVA).

Modelo **exploratorio simplificado**: un autómata celular de 8 vecinos sobre una
cuadrícula regular de 10 m generada por ``scripts/build_terrain_grid.py``.

NO es un modelo hidrodinámico, NO es una estimación de eventos futuros y
NO sustituye estudios hidrológicos. Cada parámetro físico vive en
``backend/app/data/hydro_params.json`` con valor, unidad, rango y fuente o
"SUPUESTO" con su justificación: aquí no hay números mágicos.

Reglas del motor
----------------
* Lluvia por celda: ``lluvia(mm/h) × C(superficie)`` menos la capacidad de
  drenaje del estado elegido -> lámina que se suma a la celda.
* El agua que cae sobre celdas de edificio (bloqueadas) se reparte a las celdas
  abiertas vecinas, como si saliera por canalones: nunca queda sobre el edificio
  ni lo atraviesa.
* Ingreso externo en las celdas de Puerta 4 (y opcionalmente en P1-P3).
* Propagación: cada celda transfiere agua a sus vecinos de menor nivel de
  superficie (cota + profundidad), con flujo limitado para no vaciar más de lo
  que hay (estabilidad). Las celdas de borde del dominio drenan hacia fuera.
* Depresiones locales: el agua se acumula y se desborda a la siguiente celda
  cuando ya no cabe (cascada), de forma emergente.
* Determinista: misma entrada, misma salida (sin aleatoriedad, sin reloj).

100 % offline: solo lee JSON locales; no hay llamadas de red ni tiles.
"""
from __future__ import annotations

import hashlib
import json
from functools import lru_cache
from typing import Any, Sequence

import numpy as np
import shapely
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

from app.config import DATA_DIR
from app.models import (
    HydroElementImpact,
    HydroFrame,
    HydroPreset,
    HydroPresetsResponse,
    HydroRunResponse,
)
from app.services.virtual_sensors import build_virtual_sensor_readings

TERRAIN_PATH = DATA_DIR / "terrain_grid.json"
HYDRO_PARAMS_PATH = DATA_DIR / "hydro_params.json"
CAMPUS_PATH = DATA_DIR / "campus_unt.geojson"

DEPTH_CLASS_ORDER = ("leve", "moderada", "alta")
ELEVATION_MIN_M = -1.0  # cota mínima admitida al cargar el DEM (control de sanidad)

# Escenarios paramétricos hipotéticos de alcantarillado y canaletas nuevas UNT (TRL 3-4)
DRAINAGE_SCENARIOS: dict[str, dict[str, Any]] = {
    "obstruido": {
        "label": "Alcantarillado obstruido (peor caso)",
        "factor": 0.35,
        "corridor_bonus_mm_h": 0.0,
        "inflow_p4_factor": 1.0,
    },
    "base": {
        "label": "Estado base actual (referencia)",
        "factor": 1.0,
        "corridor_bonus_mm_h": 0.0,
        "inflow_p4_factor": 1.0,
    },
    "canaletas_nuevas": {
        "label": "Canaletas nuevas + mantenimiento",
        "factor": 1.75,
        "corridor_bonus_mm_h": 6.0,
        "inflow_p4_factor": 0.85,
    },
}
DRAINAGE_SCENARIO_MAX_MM_H = 35.0
DRAINAGE_ASSUMPTION_NOTE = (
    "Simulación paramétrica hipotética (TRL 3–4). Pendiente de calibración con planos as-built "
    "de alcantarillado y canaletas nuevas de la Oficina de Infraestructura UNT."
)


# ---------------------------------------------------------------------------
# Geometría de vecindad
# ---------------------------------------------------------------------------
def _slices(ny: int, nx: int) -> list[tuple[tuple[slice, slice], tuple[slice, slice]]]:
    """Pares (vista origen, vista vecino) para las 8 direcciones, sin copias."""
    out = []
    for sy in (-1, 0, 1):
        for sx in (-1, 0, 1):
            if sy == 0 and sx == 0:
                continue
            i0, i1 = max(0, -sy), min(ny, ny - sy)
            j0, j1 = max(0, -sx), min(nx, nx - sx)
            out.append(
                ((slice(i0, i1), slice(j0, j1)),
                 (slice(i0 + sy, i1 + sy), slice(j0 + sx, j1 + sx)))
            )
    return out


def _open_neighbor_count(open_mask: np.ndarray,
                         slices) -> np.ndarray:
    """Vecinos abiertos de cada celda (para repartir el agua de tejados)."""
    count = np.zeros(open_mask.shape, dtype=np.int16)
    for s_src, s_nbr in slices:
        count[s_nbr] += open_mask[s_src].astype(np.int16)
    return count


@lru_cache(maxsize=1)
def _load_campus_perimeter():
    with CAMPUS_PATH.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    perimeters = [
        shape(feature["geometry"])
        for feature in data.get("features", [])
        if feature.get("properties", {}).get("category") == "perimetro_campus"
        and feature.get("geometry")
    ]
    if not perimeters:
        raise ValueError("campus_unt.geojson no contiene un perímetro del campus.")
    return unary_union(perimeters)


def _distribute_roof(roof: np.ndarray, blocked: np.ndarray, open_mask: np.ndarray,
                     open_nbr_count: np.ndarray, slices) -> np.ndarray:
    """Reparte el escurrimiento de tejados entre las celdas abiertas vecinas."""
    out = np.zeros_like(roof)
    for s_src, s_nbr in slices:
        source_ok = blocked[s_src] & open_mask[s_nbr]
        count = open_nbr_count[s_src]
        contrib = np.where(
            source_ok & (count > 0),
            roof[s_src] / np.maximum(count, 1).astype(roof.dtype),
            0.0,
        )
        out[s_nbr] += contrib
    return out


def _propagate(depth: np.ndarray, z: np.ndarray, open_mask: np.ndarray,
               outlet_mask: np.ndarray, k: float, max_frac: float,
               edge_frac: float, area_m2: float,
               storage: np.ndarray | None = None) -> float:
    """Un subpaso de propagación + drenaje de frontera. Devuelve m³ que salen.

    ``storage`` (m) es la lámina retenida por celda en los sumideros activos:
    esas celdas solo ceden el agua que excede su capacidad declarada.
    """
    if not depth.any():
        return 0.0

    ny, nx = depth.shape
    rows = np.flatnonzero(depth.any(axis=1))
    cols = np.flatnonzero(depth.any(axis=0))
    r0, r1 = max(0, int(rows[0]) - 1), min(ny, int(rows[-1]) + 2)
    c0, c1 = max(0, int(cols[0]) - 1), min(nx, int(cols[-1]) + 2)

    d = depth[r0:r1, c0:c1]            # vista: los cambios llegan a `depth`
    head = z[r0:r1, c0:c1] + d
    op = open_mask[r0:r1, c0:c1]

    flows: list[tuple[np.ndarray, tuple[slice, slice], tuple[slice, slice]]] = []
    out_total = np.zeros_like(d)
    for s_src, s_nbr in _slices(d.shape[0], d.shape[1]):
        dh = head[s_src] - head[s_nbr]
        flow = np.where(op[s_src] & op[s_nbr] & (dh > 0.0), k * dh, 0.0)
        flows.append((flow, s_src, s_nbr))
        out_total[s_src] += flow

    # Nunca se transfiere más de la fracción permitida: la celda no se vacía.
    cap = max_frac * d
    if storage is not None:
        # Los sumideros retienen hasta su capacidad: solo ceden el excedente.
        cap = np.minimum(cap, np.maximum(d - storage[r0:r1, c0:c1], 0.0))
    scale = np.ones_like(out_total)
    nz = out_total > 0.0
    scale[nz] = np.minimum(1.0, cap[nz] / out_total[nz])

    for flow, s_src, s_nbr in flows:
        part = flow * scale[s_src]
        d[s_src] -= part
        d[s_nbr] += part

    # Frontera abierta: las celdas de borde del dominio drenan hacia fuera.
    if outlet_mask.any():
        leaving = depth[outlet_mask] * edge_frac
        depth[outlet_mask] -= leaving
        return float(leaving.sum()) * area_m2
    return 0.0


# ---------------------------------------------------------------------------
# Carga de datos (una sola vez, en memoria)
# ---------------------------------------------------------------------------
class TerrainGrid:
    """Cuadrícula de terreno ya convertida a arrays de numpy."""

    def __init__(self, raw: dict[str, Any]):
        ny, nx = raw["shape"]
        self.ny, self.nx = int(ny), int(nx)
        self.n = self.ny * self.nx
        self.origin_lon = float(raw["origin_lon"])
        self.origin_lat = float(raw["origin_lat"])
        self.dx_deg = float(raw["dx_deg"])
        self.dy_deg = float(raw["dy_deg"])
        self.cell_size_m = float(raw["metadata"]["grid_resolution_m"])
        self.area_m2 = self.cell_size_m ** 2
        self.metadata = raw["metadata"]
        self.bounds = [float(v) for v in raw.get("bounds", [])]
        self.classes = list(raw["surface_classes"])
        x = self.origin_lon + (np.arange(self.nx) + 0.5) * self.dx_deg
        y = self.origin_lat - (np.arange(self.ny) + 0.5) * self.dy_deg
        x_grid, y_grid = np.meshgrid(x, y)
        self.campus_mask = shapely.contains_xy(
            _load_campus_perimeter(), x_grid, y_grid
        )

        self.z = np.asarray(raw["elevation_m"], dtype=np.float64).reshape(self.ny, self.nx)
        if not np.isfinite(self.z).all() or float(self.z.min()) < ELEVATION_MIN_M:
            raise ValueError("terrain_grid.json tiene elevaciones inválidas.")

        # Superficie de enrutamiento: elevación cruda con microdepresiones
        # rellenadas (priority flood). El agua fluye por esta cara; las cotas
        # que se reportan siguen siendo las de `self.z` (DEM crudo).
        route_raw = raw.get("elevation_routing_m")
        if route_raw is None:
            self.z_route = self.z.copy()
        else:
            self.z_route = np.asarray(route_raw, dtype=np.float64).reshape(self.ny, self.nx)
            if not np.isfinite(self.z_route).all():
                raise ValueError("terrain_grid.json tiene elevaciones de enrutamiento inválidas.")

        class_idx = np.frombuffer(raw["surface_class"].encode("ascii"), dtype=np.uint8) - 48
        self.class_idx = class_idx.reshape(self.ny, self.nx).astype(np.int8)

        blocked_bits = np.frombuffer(raw["blocked"].encode("ascii"), dtype=np.uint8)
        self.blocked = (blocked_bits == ord("1")).reshape(self.ny, self.nx)
        edge_bits = np.frombuffer(raw["campus_edge"].encode("ascii"), dtype=np.uint8)
        self.campus_edge = (edge_bits == ord("1")).reshape(self.ny, self.nx)
        self.open_mask = ~self.blocked

        # Frontera abierta del dominio: por ahí el agua sale del modelo.
        self.outlet = np.zeros((self.ny, self.nx), dtype=bool)
        self.outlet[0, :] = self.outlet[-1, :] = True
        self.outlet[:, 0] = self.outlet[:, -1] = True

        self.slices = _slices(self.ny, self.nx)
        self.open_nbr_count = _open_neighbor_count(self.open_mask, self.slices)

        self.inlets: dict[str, np.ndarray] = {}
        self.inlet_labels: dict[str, str] = {}
        for inlet in raw["inlets"]:
            cells = np.asarray(inlet["cells"], dtype=np.int64)
            if cells.size:
                cells = cells[~self.blocked.ravel()[cells]]
            self.inlets[inlet["id"]] = cells
            self.inlet_labels[inlet["id"]] = inlet["label"]

        self.elements: list[dict[str, Any]] = []
        for element in raw["elements"]:
            cells = np.asarray(element["cells"], dtype=np.int64)
            if cells.size:
                cells = cells[~self.blocked.ravel()[cells]]
            self.elements.append({
                "id": element["id"],
                "name": element["name"],
                "category": element["category"],
                "scope": element["scope"],
                "cells": cells,
            })

        # Zonas reportadas por el equipo (pueden activarse como sumideros locales)
        self.reported_zones: dict[str, dict[str, Any]] = {}
        for zone in raw.get("reported_zones", []):
            cells = np.asarray(zone.get("cells", []), dtype=np.int64)
            if cells.size:
                cells = cells[~self.blocked.ravel()[cells]]
            self.reported_zones[str(zone["id"])] = {
                "id": str(zone["id"]),
                "label": zone.get("label") or str(zone["id"]),
                "reported": bool(zone.get("reported", True)),
                "cells": cells,
            }

        # Coeficiente de escorrentía por celda (se completa con hydro_params.json)
        self.runoff_c: np.ndarray | None = None

    def apply_runoff_coefficients(self, coefficients: dict[str, Any]) -> None:
        missing = [name for name in self.classes if name not in coefficients]
        if missing:
            raise ValueError(
                "hydro_params.json no define C para las clases: " + ", ".join(missing)
            )
        values = np.array(
            [float(coefficients[name]["value"]) for name in self.classes],
            dtype=np.float64,
        )
        self.runoff_c = values[self.class_idx]


@lru_cache(maxsize=1)
def load_terrain_grid() -> TerrainGrid:
    with TERRAIN_PATH.open("r", encoding="utf-8") as fh:
        return TerrainGrid(json.load(fh))


@lru_cache(maxsize=1)
def load_hydro_params() -> dict[str, Any]:
    with HYDRO_PARAMS_PATH.open("r", encoding="utf-8") as fh:
        params = json.load(fh)
    # Sanidad mínima: todos los bloques que el motor necesita.
    for key in ("coeficientes_escorrentia", "capacidad_drenaje_mm_h",
                "hidrograma_p4", "radio_exclusion_salida_p4_celdas",
                "intercepcion_buzonetas",
                "ingreso_secundario_fraccion", "almacenamiento_inicial_mm",
                "infiltracion_mm_h", "propagacion",
                "clases_profundidad_m", "hietograma_supuesto", "presets"):
        if key not in params:
            raise ValueError(f"hydro_params.json falta la clave '{key}'.")
    return params


# ---------------------------------------------------------------------------
# Presets (hietograma horario SUPUESTO sobre un acumulado diario que sí es dato)
# ---------------------------------------------------------------------------
def build_rainfall_series(preset: dict[str, Any], hours: int = 48) -> list[float]:
    """Reparte el acumulado diario en una ventana de 4-6 h (SUPUESTO)."""
    params = load_hydro_params()
    weights = params["hietograma_supuesto"][f"pesos_{int(preset['window_hours'])}h"]
    series = [0.0] * hours
    start = int(preset["start_hour"])
    total = float(preset["total_mm"])
    for offset, weight in enumerate(weights):
        idx = start + offset
        if 0 <= idx < hours:
            series[idx] = round(total * float(weight), 4)
    return series


def list_presets(hours: int = 48) -> HydroPresetsResponse:
    params = load_hydro_params()
    presets: list[HydroPreset] = []
    for raw in params["presets"]:
        presets.append(HydroPreset(
            id=raw["id"],
            label=raw["label"],
            total_mm=float(raw["total_mm"]),
            hours=hours,
            start_hour=int(raw["start_hour"]),
            window_hours=int(raw["window_hours"]),
            data_nature=raw["data_nature"],
            source=raw["source"],
            note=raw["note"],
            defaults=dict(raw.get("defaults", {})),
            rainfall_mm_h=build_rainfall_series(raw, hours),
        ))
    return HydroPresetsResponse(
        is_simulation=True,
        data_nature="SUPUESTO_HORARIO_SOBRE_ACUMULADO_DIARIO",
        assumptions=[
            "El acumulado diario de cada evento es dato de referencia; la distribución "
            "horaria es SUPUESTO: no existen registros horarios para esos eventos.",
            "El hietograma concentra el total en una ventana de 4 a 6 h con forma "
            "triangular (pesos en hydro_params.json), sin medición que lo respalde.",
            "Los parámetros de drenaje y de ingreso que se usen al ejecutar el preset "
            "también son SUPUESTOS, declarados en hydro_params.json.",
        ],
        limitations=[
            "Estos presets alimentan una simulación exploratoria simplificada; no son un "
            "modelo hidrodinámico ni una estimación de eventos futuros.",
            "Un acumulado diario no describe cómo cayó la lluvia: otra distribución "
            "horaria daría otra lámina, aunque el total sea el mismo.",
            "El preset 'extremo_hipotetico' no corresponde a ningún evento observado.",
        ],
        avisos=[
            "SIMULACIÓN: los presets son escenarios de entrada, no eventos en curso.",
            "La lluvia solo alimenta la capa nueva de simulación; los escenarios "
            "heredados A-D no cambian con ella.",
        ],
        hyetogram_note=params["hietograma_supuesto"]["justification"],
        presets=presets,
    )


# ---------------------------------------------------------------------------
# GeoJSON por hora (unido con Shapely, con tolerancia para mantenerlo ligero)
# ---------------------------------------------------------------------------
def _runs(mask: np.ndarray) -> list[tuple[int, int, int]]:
    """Corridas horizontales de True -> (fila, columna inicial, columna final)."""
    padded = np.zeros((mask.shape[0], mask.shape[1] + 2), dtype=np.int8)
    padded[:, 1:-1] = mask.astype(np.int8)
    diff = np.diff(padded, axis=1)
    starts = np.argwhere(diff == 1)
    ends = np.argwhere(diff == -1)
    return [(int(r), int(c0), int(c1)) for (r, c0), (r2, c1) in zip(starts, ends)]


def _mask_geometry(mask: np.ndarray, grid: TerrainGrid):
    """Une las celdas de una máscara en una geometría (Multi)Polygon de Shapely."""
    runs = _runs(mask)
    if not runs:
        return None
    rows = np.fromiter((r for r, _, _ in runs), dtype=np.int64, count=len(runs))
    c0 = np.fromiter((a for _, a, _ in runs), dtype=np.int64, count=len(runs))
    c1 = np.fromiter((b for _, _, b in runs), dtype=np.int64, count=len(runs))

    x_left = grid.origin_lon + c0 * grid.dx_deg
    x_right = grid.origin_lon + c1 * grid.dx_deg
    y_top = grid.origin_lat - rows * grid.dy_deg
    y_bottom = grid.origin_lat - (rows + 1) * grid.dy_deg
    boxes = shapely.box(x_left, y_bottom, x_right, y_top)
    merged = shapely.union_all(boxes)
    if merged.is_empty:
        return None
    # Se simplifica ~0,5 m y se redondean las coordenadas: sigue siendo la misma
    # mancha a escala de la celda de 10 m, pero la respuesta cabe en < 2 MB.
    tol = 0.05 * min(grid.dx_deg, grid.dy_deg)
    merged = merged.simplify(tol, preserve_topology=True)
    merged = shapely.transform(merged, lambda coords: np.round(coords, 6))
    return merged


def _frame_geojson(depth: np.ndarray, grid: TerrainGrid,
                   class_ranges: dict[str, list]) -> dict[str, Any]:
    lo_visible, _ = class_ranges[DEPTH_CLASS_ORDER[0]]
    visible = depth >= float(lo_visible)
    features: list[dict[str, Any]] = []
    for cls in DEPTH_CLASS_ORDER:
        lo, hi = class_ranges[cls]
        hi_val = np.inf if hi is None else float(hi)
        class_mask = visible & (depth >= float(lo)) & (depth < hi_val)
        if not class_mask.any():
            continue
        geom = _mask_geometry(class_mask, grid)
        if geom is None or geom.is_empty:
            continue
        values = depth[class_mask]
        features.append({
            "type": "Feature",
            "geometry": mapping(geom),
            "properties": {
                "depth_class": cls,
                "min_depth_cm": round(float(values.min()) * 100.0, 1),
                "max_depth_cm": round(float(values.max()) * 100.0, 1),
                "cells": int(class_mask.sum()),
                "data_nature": "SIMULACION_EXPLORATORIA_SIMPLIFICADA",
            },
        })
    return {"type": "FeatureCollection", "features": features}


# ---------------------------------------------------------------------------
# Ejecución
# ---------------------------------------------------------------------------
def _stable_run_id(payload: dict[str, Any]) -> str:
    digest = hashlib.sha1(
        json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()[:10].upper()
    return f"HYDRO-{digest}"


def run_hydro_simulation(
    rainfall_mm_h: Sequence[float],
    drainage_state: str = "normal",
    inflow_p4: str = "medio",
    secondary_inflow: bool = False,
    use_reported_sinks: bool = False,
    drainage_scenario: str = "base",
    *,
    data_nature: str = "SIMULACION_EXPLORATORIA_SIMPLIFICADA",
    source: str = "serie horaria de lluvia recibida en la petición",
    weather: dict[str, Any] | None = None,
) -> HydroRunResponse:
    """Ejecuta el motor para la serie dada y devuelve marcos por hora."""
    resp = simulate_core(
        rainfall_mm_h,
        drainage_state=drainage_state,
        inflow_p4=inflow_p4,
        secondary_inflow=secondary_inflow,
        use_reported_sinks=use_reported_sinks,
        drainage_scenario=drainage_scenario,
        data_nature=data_nature,
        source=source,
        weather=weather,
    )[0]
    if drainage_scenario != "base" and resp.drainage_impact is not None:
        base_resp = simulate_core(
            rainfall_mm_h,
            drainage_state=drainage_state,
            inflow_p4=inflow_p4,
            secondary_inflow=secondary_inflow,
            use_reported_sinks=use_reported_sinks,
            drainage_scenario="base",
            data_nature=data_nature,
            source=source,
            weather=weather,
        )[0]
        base_depth = float(base_resp.summary.get("max_depth_cm", 0.0))
        curr_depth = float(resp.summary.get("max_depth_cm", 0.0))
        base_area = float(base_resp.summary.get("peak_wet_area_m2", 0.0))
        curr_area = float(resp.summary.get("peak_wet_area_m2", 0.0))
        base_el = int(base_resp.summary.get("elements_affected", 0))
        curr_el = int(resp.summary.get("elements_affected", 0))
        base_persist = max(
            (int(e.hours_with_water_above_threshold) for e in base_resp.elements),
            default=0,
        )
        curr_persist = max(
            (int(e.hours_with_water_above_threshold) for e in resp.elements),
            default=0,
        )
        resp.drainage_impact.update({
            "delta_max_depth_cm": round(curr_depth - base_depth, 1),
            "delta_affected_area_pct": (
                round(((curr_area - base_area) / base_area) * 100.0, 1)
                if base_area > 0.0 else 0.0
            ),
            "delta_persistence_hours": curr_persist - base_persist,
            "delta_affected_elements": curr_el - base_el,
            "base_max_depth_cm": base_depth,
            "base_elements_affected": base_el,
        })
    return resp


def _triangular_hydrograph(
    total_volume_m3: float,
    duration_h: int,
    start_hour_index: int,
    hours: int,
) -> np.ndarray:
    """Return hourly volume rates for a normalized triangular event."""
    if duration_h < 2:
        raise ValueError("La duración del hidrograma P4 debe ser de al menos 2 horas.")
    if total_volume_m3 <= 0.0:
        return np.zeros(hours, dtype=np.float64)

    midpoints = (np.arange(duration_h, dtype=np.float64) + 0.5) / duration_h
    weights = 1.0 - np.abs(2.0 * midpoints - 1.0)
    weights /= weights.sum()
    result = np.zeros(hours, dtype=np.float64)
    event_end = min(start_hour_index + duration_h, hours)
    if start_hour_index < hours:
        result[start_hour_index:event_end] = (
            total_volume_m3 * weights[:event_end - start_hour_index]
        )
    return result


def simulate_core(
    rainfall_mm_h: Sequence[float],
    drainage_state: str = "normal",
    inflow_p4: str = "medio",
    secondary_inflow: bool = False,
    use_reported_sinks: bool = False,
    drainage_scenario: str = "base",
    *,
    data_nature: str = "SIMULACION_EXPLORATORIA_SIMPLIFICADA",
    source: str = "serie horaria de lluvia recibida en la petición",
    weather: dict[str, Any] | None = None,
    grid: TerrainGrid | None = None,
    hourly_out: list[np.ndarray] | None = None,
) -> tuple[HydroRunResponse, np.ndarray]:
    """Igual que run_hydro_simulation pero devuelve también la lámina final (m).

    La lámina final la usan las pruebas para verificar conservación de masa,
    monotonicidad, que el agua baja hacia el suroeste y que no hay agua sobre
    celdas de edificio. ``grid`` permite inyectar otra superficie de
    enrutamiento (diagnósticos) y ``hourly_out`` acumula la lámina por hora.
    """
    params = load_hydro_params()
    grid = grid if grid is not None else load_terrain_grid()
    grid.apply_runoff_coefficients(params["coeficientes_escorrentia"])

    if drainage_state not in params["capacidad_drenaje_mm_h"]:
        raise ValueError(f"Estado de drenaje desconocido: {drainage_state}")
    if drainage_scenario not in DRAINAGE_SCENARIOS:
        raise ValueError(f"Escenario de drenaje desconocido: {drainage_scenario}")
    scenario_cfg = DRAINAGE_SCENARIOS[drainage_scenario]
    drainage_factor = float(scenario_cfg["factor"])
    corridor_bonus_mm_h = float(scenario_cfg["corridor_bonus_mm_h"])
    inflow_p4_factor = float(scenario_cfg["inflow_p4_factor"])
    hydrograph_cfg = params["hidrograma_p4"]
    if inflow_p4 not in hydrograph_cfg["volumen_total_m3"]:
        raise ValueError(f"Nivel de ingreso desconocido: {inflow_p4}")

    series = [float(v) for v in rainfall_mm_h]
    if not series:
        raise ValueError("La serie de lluvia no puede estar vacía.")
    if any(v < 0.0 for v in series):
        raise ValueError("La lluvia no puede ser negativa.")

    duration_cfg = hydrograph_cfg["duracion_h"]
    duration_raw = float(duration_cfg["value"])
    duration_h = int(duration_raw)
    duration_min, duration_max = duration_cfg["range"]
    if (
        duration_raw != duration_h
        or duration_h < int(duration_min)
        or duration_h > int(duration_max)
    ):
        raise ValueError("La duracion del hidrograma P4 debe ser entera y estar entre 3 y 6 horas.")

    prop = params["propagacion"]
    n_sub = int(prop["subpasos_por_hora"]["value"])
    k = float(prop["coeficiente_transferencia"]["value"])
    max_frac = float(prop["max_frac_salida_por_subpaso"]["value"])
    edge_frac = float(prop["drenaje_borde_frac_por_subpaso"]["value"])
    visible_m = float(prop["umbral_profundidad_visible_m"]["value"])

    base_drain_mm_h = float(params["capacidad_drenaje_mm_h"][drainage_state]["value"])
    drain_mm_h = min(
        DRAINAGE_SCENARIO_MAX_MM_H,
        base_drain_mm_h * drainage_factor + corridor_bonus_mm_h,
    )
    drain_sub = (drain_mm_h / 1000.0) / n_sub
    missing_storage = [
        name for name in grid.classes
        if name not in params["almacenamiento_inicial_mm"]
    ]
    missing_infiltration = [
        name for name in grid.classes
        if name not in params["infiltracion_mm_h"]
    ]
    if missing_storage or missing_infiltration:
        missing = sorted(set(missing_storage + missing_infiltration))
        raise ValueError(
            "hydro_params.json no define almacenamiento/infiltración para: "
            + ", ".join(missing)
        )
    initial_storage_m = np.array(
        [float(params["almacenamiento_inicial_mm"][name]["value"]) / 1000.0
         for name in grid.classes],
        dtype=np.float64,
    )[grid.class_idx]
    initial_storage_remaining = initial_storage_m.copy()
    infiltration_sub = (
        np.array(
            [float(params["infiltracion_mm_h"][name]["value"]) / 1000.0 / n_sub
             for name in grid.classes],
            dtype=np.float64,
        )[grid.class_idx]
        * grid.campus_mask
    )
    drainage_classes = {
        grid.classes.index(name)
        for name in ("via", "estacionamiento")
        if name in grid.classes
    }
    drainage_mask = np.isin(grid.class_idx, list(drainage_classes))
    if drainage_scenario == "canaletas_nuevas":
        for zone in grid.reported_zones.values():
            if zone["cells"].size:
                drainage_mask.reshape(-1)[zone["cells"]] = True
    drainage_mask &= grid.campus_mask & grid.open_mask

    # --- sumideros locales reportados (opcionales, apagados por defecto) ------
    storage: np.ndarray | None = None
    sink_info: list[dict[str, Any]] = []
    if use_reported_sinks:
        sink_cfg = params.get("sumideros_reportados", {})
        storage_depth = float(sink_cfg.get("storage_depth_m", {}).get("value", 0.0))
        storage = np.zeros((grid.ny, grid.nx), dtype=np.float64)
        for sink in sink_cfg.get("sinks", []):
            if not bool(sink.get("reported", True)):
                continue
            zone = grid.reported_zones.get(str(sink.get("zone_id", "")))
            if zone is None or zone["cells"].size == 0:
                continue
            storage.reshape(-1)[zone["cells"]] = storage_depth
            sink_info.append({
                "id": str(sink["id"]),
                "label": sink.get("label") or str(sink["id"]),
                "cells": int(zone["cells"].size),
                "storage_depth_m": storage_depth,
            })

    area = grid.area_m2
    p4_cells = grid.inlets.get("p4", np.empty(0, dtype=np.int64))
    exclusion_radius_raw = float(
        params["radio_exclusion_salida_p4_celdas"]["value"]
    )
    exclusion_radius_cells = int(exclusion_radius_raw)
    if exclusion_radius_raw != exclusion_radius_cells or exclusion_radius_cells < 0:
        raise ValueError("El radio de exclusion de salida de P4 debe ser un entero no negativo.")
    p4_buffer_mask = np.zeros_like(grid.campus_mask)
    for cell in p4_cells:
        row, col = divmod(int(cell), grid.nx)
        row_start = max(0, row - exclusion_radius_cells)
        row_end = min(grid.ny, row + exclusion_radius_cells + 1)
        col_start = max(0, col - exclusion_radius_cells)
        col_end = min(grid.nx, col + exclusion_radius_cells + 1)
        p4_buffer_mask[row_start:row_end, col_start:col_end] = True
    outside_p4_buffer_mask = ~grid.campus_mask & p4_buffer_mask
    outside_exit_mask = ~grid.campus_mask & ~p4_buffer_mask
    sec_cells = grid.inlets.get("secundario", np.empty(0, dtype=np.int64))
    if not secondary_inflow:
        sec_cells = np.empty(0, dtype=np.int64)

    intercepted = float(params["intercepcion_buzonetas"]["value"])
    p4_volume_gross = (
        float(hydrograph_cfg["volumen_total_m3"][inflow_p4]["value"]) * inflow_p4_factor
    )
    rainfall_peak_index = int(np.argmax(series)) if max(series) > 0.0 else 0
    p4_hourly_m3 = _triangular_hydrograph(
        p4_volume_gross * (1.0 - intercepted) if p4_cells.size else 0.0,
        duration_h,
        rainfall_peak_index,
        len(series),
    )
    p4_peak_m3_h = float(p4_hourly_m3.max())
    p4_volume_delivered_m3 = float(p4_hourly_m3.sum())
    secondary_fraction = float(params["ingreso_secundario_fraccion"]["value"])
    sec_peak_m3_h = p4_peak_m3_h * secondary_fraction

    depth = np.zeros((grid.ny, grid.nx), dtype=np.float64)
    depth_flat = depth.reshape(-1)

    runoff_c = grid.runoff_c
    blocked, open_mask = grid.blocked, grid.open_mask
    open_nbr_count = grid.open_nbr_count
    outlet_mask = grid.outlet & ~outside_p4_buffer_mask

    mass_rain = mass_initial_storage = mass_infiltration = 0.0
    mass_inflow = mass_drain = mass_edge = mass_roof_lost = 0.0

    frames: list[HydroFrame] = []
    sensor_hourly_depths: list[np.ndarray] = []
    max_depth_seen = 0.0
    peak_wet_area = 0.0
    peak_hour = 0

    # --- seguimiento por elemento del catálogo (edic., accesos, estac., deporte) ---
    threshold_m = visible_m
    el_max = np.zeros(len(grid.elements), dtype=np.float64)
    el_first = np.zeros(len(grid.elements), dtype=np.int64)
    el_first_depth = np.zeros(len(grid.elements), dtype=np.float64)
    el_persistence_hours = np.zeros(len(grid.elements), dtype=np.int64)
    persistence_threshold_m = (
        float(params["reglas_preventivas_hidro"]["R-HID-03"]["depth_cm"]["value"]) / 100.0
    )
    final_wet_area = 0.0
    class_ranges = {
        name: params["clases_profundidad_m"][name]["range"]
        for name in DEPTH_CLASS_ORDER
    }

    for hour_idx, rain_mm in enumerate(series, start=1):
        rain_depth = (rain_mm / 1000.0) * grid.campus_mask
        effective_rain = rain_depth * runoff_c
        initial_storage_fill = np.minimum(
            rain_depth, initial_storage_remaining
        )
        initial_storage_remaining -= initial_storage_fill
        mass_rain += float(effective_rain.sum()) * area
        mass_initial_storage += float(
            (initial_storage_fill * runoff_c).sum()
        ) * area
        runoff = (rain_depth - initial_storage_fill) * runoff_c

        roof = runoff * blocked
        stranded = blocked & (open_nbr_count == 0)
        mass_roof_lost += float(roof[stranded].sum()) * area
        roof_add = _distribute_roof(roof, blocked, open_mask, open_nbr_count, grid.slices)

        input_add = runoff * open_mask + roof_add       # 0 en celdas bloqueadas
        input_sub = input_add / n_sub

        p4_hour_m3 = float(p4_hourly_m3[hour_idx - 1])
        p4_step = (
            p4_hour_m3 / p4_cells.size / n_sub / area
            if p4_cells.size and p4_hour_m3 > 0.0 else 0.0
        )
        sec_hour_m3 = p4_hour_m3 * secondary_fraction
        sec_step = (
            sec_hour_m3 / sec_cells.size / n_sub / area
            if sec_cells.size and sec_hour_m3 > 0.0 else 0.0
        )
        inflow_hour_m3 = p4_hour_m3 + (
            sec_hour_m3 if sec_cells.size else 0.0
        )

        for _ in range(n_sub):
            depth += input_sub
            if infiltration_sub.any():
                if storage is None:
                    infiltrated = np.minimum(depth, infiltration_sub)
                else:
                    infiltrated = np.minimum(
                        np.maximum(depth - storage, 0.0), infiltration_sub
                    )
                depth -= infiltrated
                mass_infiltration += float(infiltrated.sum()) * area
            if drain_sub > 0.0:
                if storage is None:
                    removed = np.minimum(depth, drain_sub) * drainage_mask
                else:
                    # los sumideros conservan su lámina hasta la capacidad declarada
                    removed = (
                        np.minimum(np.maximum(depth - storage, 0.0), drain_sub)
                        * drainage_mask
                    )
                depth -= removed
                mass_drain += float(removed.sum()) * area
            if p4_step:
                depth_flat[p4_cells] += p4_step
            if sec_step:
                depth_flat[sec_cells] += sec_step
            mass_inflow += inflow_hour_m3 / n_sub
            mass_edge += _propagate(depth, grid.z_route, open_mask, outlet_mask,
                                    k, max_frac, edge_frac, area, storage=storage)
            outside_depth = depth[outside_exit_mask]
            mass_edge += float(outside_depth.sum()) * area
            depth[outside_exit_mask] = 0.0

        for idx, element in enumerate(grid.elements):
            cells = element["cells"]
            if cells.size == 0:
                continue
            here = float(depth_flat[cells].max())
            if here > el_max[idx]:
                el_max[idx] = here
            if el_first[idx] == 0 and here >= threshold_m:
                el_first[idx] = hour_idx
                el_first_depth[idx] = here
            if here >= persistence_threshold_m:
                el_persistence_hours[idx] += 1

        wet = depth >= visible_m
        wet_area = float(wet.sum()) * area
        final_wet_area = wet_area
        max_depth = float(depth.max())
        if wet_area > peak_wet_area:
            peak_wet_area = wet_area
            peak_hour = hour_idx
        max_depth_seen = max(max_depth_seen, max_depth)

        frames.append(HydroFrame(
            hour=hour_idx,
            label=f"h+{hour_idx}",
            max_depth_cm=round(max_depth * 100.0, 1),
            wet_area_m2=round(wet_area, 1),
            campus_edge_wet_cells=int((wet & grid.campus_edge).sum()),
            geojson=_frame_geojson(depth, grid, class_ranges),
        ))
        sensor_hourly_depths.append(depth.copy())
        if hourly_out is not None:
            hourly_out.append(depth.copy())

    elements_out: list[HydroElementImpact] = []
    for idx, element in enumerate(grid.elements):
        first = int(el_first[idx])
        elements_out.append(HydroElementImpact(
            id=element["id"],
            name=element["name"],
            category=element["category"],
            scope=element["scope"],
            max_depth_cm=round(float(el_max[idx]) * 100.0, 1),
            first_hour_affected=first if first > 0 else None,
            first_hour_depth_cm=(
                round(float(el_first_depth[idx]) * 100.0, 1) if first > 0 else None
            ),
            hours_with_water_above_threshold=int(el_persistence_hours[idx]),
        ))

    stored_m3 = float(depth.sum()) * area
    entrada = mass_rain + mass_inflow
    salida = (
        mass_initial_storage + mass_infiltration + mass_drain
        + mass_edge + mass_roof_lost
    )
    residual = entrada - salida - stored_m3

    run_id_payload = {
        "rainfall_mm_h": series,
        "drainage_state": drainage_state,
        "inflow_p4": inflow_p4,
        "p4_hydrograph_m3_h": p4_hourly_m3.tolist(),
        "p4_hydrograph_duration_h": duration_h,
        "p4_hydrograph_start_hour": rainfall_peak_index + 1,
        "p4_exit_exclusion_cells": exclusion_radius_cells,
        "secondary_inflow": bool(secondary_inflow),
    }
    if drainage_scenario != "base":
        run_id_payload["drainage_scenario"] = drainage_scenario
    run_id = _stable_run_id(run_id_payload)

    routing_fill = dict(grid.metadata.get("routing_fill", {}))
    assumptions = [
        "Modelo exploratorio simplificado: autómata celular de 8 vecinos sobre celdas de 10 m; "
        "no es un modelo hidrodinámico ni sustituye estudios hidrológicos.",
        "DEM de 30 m interpolado a 10 m, error vertical ±4 m: la malla más fina suaviza el "
        "relieve pero no agrega información sobre el terreno real.",
        "Microdepresiones rellenadas hasta "
        + (
            f"{float(routing_fill.get('fill_max_rise_m')):.1f} m por celda para el enrutamiento"
            if routing_fill.get("fill_max_rise_m") is not None
            else f"sin tope (máximo observado {float(routing_fill.get('fill_max_obs_m', 0.0)):.2f} m) "
                 "para el enrutamiento"
        )
        + " (priority flood, práctica estándar); las cotas reportadas son las del DEM crudo.",
        "Las profundidades que muestra esta respuesta son estimaciones exploratorias de una "
        "capa de agua modelada, no mediciones ni niveles de inundación observados.",
        f"Coeficientes de escorrentía SUPUESTOS dentro de los rangos de la norma OS.060 "
        f"(verificar versión vigente de la norma); drenaje '{drainage_state}' con capacidad "
        f"de {drain_mm_h:g} mm/h SUPUESTA solo en vías y estacionamientos.",
        "El almacenamiento inicial por superficie y la infiltración de áreas verdes son "
        "SUPUESTOS; no hay mediciones locales. Las clases mixtas no reciben infiltración.",
        f"Hidrograma triangular P4 '{inflow_p4}': volumen configurado {p4_volume_gross:.1f} m³ "
        f"antes de buzonetas, {p4_volume_delivered_m3:.1f} m³ netos en el horizonte, "
        f"pico horario {p4_peak_m3_h:.1f} m³/h en {p4_cells.size} celdas; inicio h+"
        f"{rainfall_peak_index + 1} según el máximo de lluvia (h+1 si no llueve). SUPUESTO, "
        "escenario, no caudal medido.",
        f"Las celdas externas dentro de {exclusion_radius_cells} celdas de P4 no son salida; "
        "las demás celdas externas siguen contabilizadas como salida de borde. SUPUESTO.",
        f"Ingreso secundario por P1-P3 (Av. Juan Pablo II): "
        + (f"pico {sec_peak_m3_h:.1f} m³/h, fracción débil e incierto del total de P4."
           if secondary_inflow else "desactivado en esta corrida."),
        (
            "Sumideros locales reportados ACTIVOS (use_reported_sinks=true, SUPUESTO): "
            + ", ".join(f"{s['label']} ({s['cells']} celdas)" for s in sink_info)
            + f" retienen hasta {sink_info[0]['storage_depth_m']:.2f} m de lámina; el excedente "
            "sigue el flujo normal. Es una hipótesis del equipo, no una medición."
            if sink_info else
            "Sumideros locales reportados DESACTIVADOS (use_reported_sinks=false): el modelo "
            "no impone acumulación adicional en CIDUNT, Derecho, Puerta 4 ni Av. Juan Pablo II."
        ),
        "Las celdas de edificio están bloqueadas: el agua no las atraviesa y el escurrimiento "
        "de sus tejados se reparte a las celdas abiertas vecinas.",
        "Umbrales de profundidad (2 cm visible; leve 2-5 cm, moderada 5-15 cm, alta ≥15 cm): "
        "SUPUESTOS de comunicación visual, no clasifican riesgo de nada.",
        "El estado de drenaje 'pendiente_deficiente' es una HIPÓTESIS NO VERIFICADA de la obra "
        "de vías y se expone solo como opción.",
    ]

    limitations = [
        "Simulación exploratoria simplificada: los resultados no son una estimación de eventos "
        "futuros y no reemplazan mapas de CENEPRED/SIGRID/INDECI.",
        "No se resuelven tuberías, bombeo, retorno de alcantarillado, marea ni turbulencia: solo "
        "escurrimiento superficial por gravedad sobre el terreno interpolado.",
        "El relieve a escala de 10 m viene de un DEM de 30 m: las microdepresiones y las "
        "pendientes de obra no están resueltas por el modelo.",
        "Las cotas de empozamiento reportadas en CIDUNT (≈24,1 m) y en Derecho (≈26,8 m) están "
        "altas en el DEM: se explican por ingreso de agua y microdepresiones, no por ser zonas bajas.",
        "Los caudales publicados de la quebrada San Ildefonso son discrepantes (Q100 = 30,6 m³/s "
        "en SENACE 2023 frente a Q20 = 99,7 m³/s en una tesis UCV 2021); por eso el ingreso es "
        "un parámetro graduable y no un dato.",
        "La probabilidad de precipitación del pronóstico no se convierte en probabilidad de "
        "activación de quebradas ni en probabilidad de avenidas.",
        "No hay sensores de nivel ni de caudal en el campus: la lámina modelada no se ha "
        "comparado con mediciones en campo.",
        "Los resultados describen cuánta agua modelada hay en cada celda; no califican edificios, "
        "accesos ni zonas.",
    ]

    avisos = [
        "SIMULACIÓN: capa dinámica nueva y exploratoria. Los escenarios de referencia A-D y sus "
        "vistas no cambian con esta corrida.",
        "La lluvia y el ingreso externo alimentan solo esta capa nueva.",
        "No usar esta simulación para decisiones operativas: no está validada con mediciones.",
        "Todo es offline: la corrida no consultó ninguna red ni ningún mapa externo.",
    ]

    virtual_sensors = build_virtual_sensor_readings(
        grid=grid,
        hourly_depths=sensor_hourly_depths,
        rainfall_mm_h=series,
        scenario_label=source,
        data_nature=data_nature,
        run_id=run_id,
    )

    response = HydroRunResponse(
        run_id=run_id,
        data_nature=data_nature,
        parameters={
            "rainfall_mm_h": series,
            "rainfall_total_mm": round(sum(series), 2),
            "hours": len(series),
            "drainage_state": drainage_state,
            "drainage_scenario": drainage_scenario,
            "drainage_factor": drainage_factor,
            "drainage_capacity_mm_h": round(drain_mm_h, 2),
            "inflow_p4": inflow_p4,
            "inflow_p4_m3_h_total": round(p4_peak_m3_h, 2),
            "inflow_p4_cells": int(p4_cells.size),
            "secondary_inflow": bool(secondary_inflow and sec_cells.size > 0),
            "secondary_inflow_m3_h_total": (
                round(sec_peak_m3_h, 2)
                if secondary_inflow and sec_cells.size else 0.0
            ),
            "secondary_inflow_cells": int(sec_cells.size),
            "substeps_per_hour": n_sub,
            "visible_threshold_cm": round(visible_m * 100.0, 1),
            "fill_max_rise_m": routing_fill.get("fill_max_rise_m"),
            "fill_max_obs_m": routing_fill.get("fill_max_obs_m"),
            "use_reported_sinks": bool(use_reported_sinks and sink_info),
            "reported_sinks": sink_info,
        },
        frames=frames,
        elements=elements_out,
        summary={
            "hours_simulated": len(series),
            "peak_hour": peak_hour,
            "max_depth_cm": round(max_depth_seen * 100.0, 1),
            "peak_wet_area_m2": round(peak_wet_area, 1),
            "final_wet_area_m2": round(final_wet_area, 1),
            "elements_affected": sum(1 for e in elements_out if e.first_hour_affected is not None),
            "mass_balance_m3": {
                "entrada_lluvia": round(mass_rain, 3),
                "entrada_ingreso": round(mass_inflow, 3),
                "perdida_almacenamiento_inicial": round(mass_initial_storage, 3),
                "salida_infiltracion": round(mass_infiltration, 3),
                "salida_drenaje": round(mass_drain, 3),
                "salida_borde": round(mass_edge, 3),
                "perdida_tejados_sin_vecino": round(mass_roof_lost, 3),
                "almacenada": round(stored_m3, 3),
                "residual": round(residual, 6),
                "residual_pct": round(100.0 * residual / entrada, 6) if entrada > 0 else 0.0,
            },
        },
        metadata={
            "engine": "autómata celular de 8 vecinos sobre cuadrícula de 10 m (numpy, determinista)",
            "source": source,
            "offline": True,
            "grid_origin": grid.metadata["origin"],
            "grid_generated_utc": grid.metadata["generated_utc"],
            "grid_resolution_m": grid.cell_size_m,
            "grid_shape": [grid.ny, grid.nx],
            "grid_bounds": grid.bounds,
            "dem_resolution_m": grid.metadata["dem_resolution_m"],
            "dem_vertical_error_m": grid.metadata["dem_vertical_error_m"],
            "interpolation": grid.metadata["interpolation"],
            "routing_fill": grid.metadata.get("routing_fill"),
            "reported_sinks": sink_info,
            "cells_total": grid.n,
            "cells_blocked": int(blocked.sum()),
            "cells_campus_edge": int(grid.campus_edge.sum()),
            "cells_outlet": int(outlet_mask.sum()),
            "inlets": [
                {"id": "p4", "label": grid.inlet_labels.get("p4", "Puerta 4"),
                 "cells": int(p4_cells.size)},
                {"id": "secundario", "label": grid.inlet_labels.get("secundario", "P1-P3"),
                 "cells": int(sec_cells.size)},
            ],
            "hydro_params_version": params.get("version"),
        },
        assumptions=assumptions,
        limitations=limitations,
        avisos=avisos,
        weather=weather,
        virtual_sensors=virtual_sensors,
        drainage_impact={
            "scenario": drainage_scenario,
            "scenario_label": scenario_cfg["label"],
            "drainage_factor": drainage_factor,
            "effective_drain_mm_h": round(drain_mm_h, 2),
            "is_hypothetical": True,
            "assumption_note": DRAINAGE_ASSUMPTION_NOTE,
            "delta_max_depth_cm": 0.0,
            "delta_affected_area_pct": 0.0,
            "delta_persistence_hours": 0,
            "delta_affected_elements": 0,
        },
    )
    return response, depth
