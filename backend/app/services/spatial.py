import json
import math
from functools import lru_cache
from typing import Any

import numpy as np
import shapely
from shapely.affinity import translate
from shapely.geometry import GeometryCollection, Point, mapping, shape
from shapely.ops import unary_union

from app.config import (
    CAMPUS_GEOJSON_PATH,
    DATA_DIR,
    EVACUATION_GEOJSON_PATH,
    HAZARDS_GEOJSON_PATH,
    TRUJILLO_CONTEXT_GEOJSON_PATH,
)
from app.models import (
    ExposedElement,
    SpatialAnalysisResult,
    SyntheticExposureAnalysis,
    WatchedBuilding,
)
from app.services.conditions import HAZARD_ZONE_ID as CONDITIONS_ZONE_ID, resolve_conditions


# Umbrales EXPERIMENTALES de exposición (% de la huella del edificio dentro de la zona simulada).
# No provienen de una norma ni están validados: sirven para graduar el aviso y se deben poder discutir.
MARGINAL_MAX_PCT = 5.0   # < 5 %: contacto marginal (no cuenta como edificio expuesto)
PARTIAL_MAX_PCT = 25.0   # 5–25 %: parcial
HIGH_MAX_PCT = 75.0      # 25–75 %: alta; > 75 %: total
EXPOSED_LEVELS = ("parcial", "alta", "total")
SYNTH_REACH_M = {"lluvia_intensa_fen": 40.0, "escenario_extremo_fen": 80.0}
SYNTH_SPREAD_M = 15.0
LAT0 = -8.114
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574


def classify_exposure(overlap_pct: float) -> str:
    """Nivel de exposición de un edificio según el % de su huella dentro de la zona."""
    if overlap_pct <= 0:
        return "ninguna"
    if overlap_pct < MARGINAL_MAX_PCT:
        return "marginal"
    if overlap_pct <= PARTIAL_MAX_PCT:
        return "parcial"
    if overlap_pct <= HIGH_MAX_PCT:
        return "alta"
    return "total"


_LEVEL_STATUS = {
    "ninguna": "Fuera de la zona experimental analizada",
    "marginal": "Contacto marginal ({pct}% de la huella) con la zona analizada; sin afectación esperada del edificio",
    "parcial": "Exposición parcial ({pct}% de la huella) en escenario experimental: revisar el sector y los accesos al primer nivel",
    "alta": "Exposición alta ({pct}% de la huella) en escenario experimental: es probable que el primer nivel y sus accesos queden afectados",
    "total": "Exposición total ({pct}% de la huella) en escenario experimental: la huella queda casi por completo dentro de la zona",
}


def load_campus_geojson() -> dict[str, Any]:
    with CAMPUS_GEOJSON_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_hazards_geojson() -> dict[str, Any]:
    with HAZARDS_GEOJSON_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _compute_evacuation_dem_validation() -> dict[str, Any]:
    """Valida áreas seguras y puntos de encuentro contra la malla DEM 10 m en 2017 y 2023."""
    from app.services.hydro import list_presets, load_terrain_grid, simulate_core

    with EVACUATION_GEOJSON_PATH.open("r", encoding="utf-8") as f:
        evac = json.load(f)

    campus = load_campus_geojson()
    campus_poly = unary_union([
        shape(feat["geometry"])
        for feat in campus.get("features", [])
        if feat.get("properties", {}).get("category") == "perimetro_campus"
    ])

    grid = load_terrain_grid()
    presets_by_id = {p.id: p for p in list_presets().presets}
    scenarios = ("evento_2017_03", "evento_2023_03_10")
    peaks_cm: dict[str, np.ndarray] = {}
    for pid in scenarios:
        preset = presets_by_id.get(pid)
        if preset is None:
            continue
        defaults = preset.defaults or {}
        hourly: list[np.ndarray] = []
        simulate_core(
            preset.rainfall_mm_h,
            drainage_state=defaults.get("drainage_state", "normal"),
            inflow_p4=defaults.get("inflow_p4", "medio"),
            secondary_inflow=bool(defaults.get("secondary_inflow", False)),
            use_reported_sinks=bool(defaults.get("use_reported_sinks", False)),
            hourly_out=hourly,
        )
        peaks_cm[pid] = np.max(np.stack(hourly, axis=0), axis=0) * 100.0

    combined_cm = (
        np.maximum.reduce(list(peaks_cm.values()))
        if peaks_cm
        else np.zeros((grid.ny, grid.nx), dtype=np.float64)
    )

    x_centers = grid.origin_lon + (np.arange(grid.nx) + 0.5) * grid.dx_deg
    y_centers = grid.origin_lat - (np.arange(grid.ny) + 0.5) * grid.dy_deg
    xx, yy = np.meshgrid(x_centers, y_centers)

    max_point_cm = 0.0
    max_area_cm = 0.0
    max_2017_cm = 0.0
    max_2023_cm = 0.0
    all_inside = True
    safe_area_count = 0
    meeting_point_count = 0
    route_count = 0

    for feat in evac.get("features", []):
        props = feat.get("properties", {})
        ltype = props.get("layer_type") or props.get("zone_type")
        geom = shape(feat["geometry"])

        if ltype == "evacuation_route":
            route_count += 1
            continue

        if ltype == "meeting_point" or ltype == "safe_point":
            meeting_point_count += 1
            lon, lat = feat["geometry"]["coordinates"]
            if not campus_poly.buffer(1e-5).contains(Point(lon, lat)):
                all_inside = False
            col = min(max(int((lon - grid.origin_lon) / grid.dx_deg), 0), grid.nx - 1)
            row = min(max(int((grid.origin_lat - lat) / grid.dy_deg), 0), grid.ny - 1)
            d_all = float(combined_cm[row, col])
            max_point_cm = max(max_point_cm, d_all)
            if "evento_2017_03" in peaks_cm:
                max_2017_cm = max(max_2017_cm, float(peaks_cm["evento_2017_03"][row, col]))
            if "evento_2023_03_10" in peaks_cm:
                max_2023_cm = max(max_2023_cm, float(peaks_cm["evento_2023_03_10"][row, col]))
        elif ltype == "safe_area":
            safe_area_count += 1
            if not campus_poly.buffer(1e-5).contains(geom):
                all_inside = False
            mask = shapely.contains_xy(geom, xx, yy)
            if not mask.any():
                c = geom.centroid
                col = min(max(int((c.x - grid.origin_lon) / grid.dx_deg), 0), grid.nx - 1)
                row = min(max(int((grid.origin_lat - c.y) / grid.dy_deg), 0), grid.ny - 1)
                mask = np.zeros((grid.ny, grid.nx), dtype=bool)
                mask[row, col] = True
            d_all = float(combined_cm[mask].max())
            max_area_cm = max(max_area_cm, d_all)
            if "evento_2017_03" in peaks_cm:
                max_2017_cm = max(max_2017_cm, float(peaks_cm["evento_2017_03"][mask].max()))
            if "evento_2023_03_10" in peaks_cm:
                max_2023_cm = max(max_2023_cm, float(peaks_cm["evento_2023_03_10"][mask].max()))

    overall_max_cm = max(max_point_cm, max_area_cm)
    return {
        "verified_against_dem": bool(all_inside and overall_max_cm < 2.0),
        "dem_resolution_m": int(grid.cell_size_m),
        "scenarios_tested": list(peaks_cm.keys()),
        "threshold_cm": 2.0,
        "all_within_campus": all_inside,
        "max_depth_at_safe_points_cm": round(max_point_cm, 2),
        "max_depth_at_safe_areas_cm": round(max_area_cm, 2),
        "max_depth_2017_cm": round(max_2017_cm, 2),
        "max_depth_2023_cm": round(max_2023_cm, 2),
        "counts": {
            "safe_areas": safe_area_count,
            "meeting_points": meeting_point_count,
            "evacuation_routes": route_count,
        },
        "note": "Validado sobre malla DEM 10 m — libre de aniego (< 2 cm) en escenarios de referencia 2017/2023.",
    }


def load_evacuation_geojson() -> dict[str, Any]:
    with EVACUATION_GEOJSON_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)
    validation = _compute_evacuation_dem_validation()
    data["dem_validation"] = validation
    meta = dict(data.get("metadata", {}))
    meta["verified_against_dem"] = validation["verified_against_dem"]
    meta["max_depth_at_safe_points_cm"] = validation["max_depth_at_safe_points_cm"]
    meta["max_depth_at_safe_areas_cm"] = validation["max_depth_at_safe_areas_cm"]
    data["metadata"] = meta
    return data


def load_trujillo_context_geojson() -> dict[str, Any]:
    with TRUJILLO_CONTEXT_GEOJSON_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def _synthetic_influence(geom, reach_m: float, azimuth_deg: float):
    local = shapely.transform(
        geom,
        lambda coords: np.column_stack((
            (coords[:, 0] + 79.0) * KX,
            (coords[:, 1] - LAT0) * KY,
        )),
    )
    angle = math.radians(azimuth_deg)
    shifted = translate(
        local,
        xoff=math.sin(angle) * reach_m,
        yoff=math.cos(angle) * reach_m,
    )
    influence = unary_union([local, shifted]).convex_hull.buffer(SYNTH_SPREAD_M)
    return shapely.transform(
        influence,
        lambda coords: np.column_stack((
            coords[:, 0] / KX - 79.0,
            coords[:, 1] / KY + LAT0,
        )),
    )


def _dem_azimuth() -> tuple[float, bool]:
    path = DATA_DIR / "dem_report.json"
    if not path.exists():
        return 203.0, True
    report = json.loads(path.read_text(encoding="utf-8"))
    value = report.get("azimut_descenso_deg")
    return (203.0, True) if value is None else (float(value), False)


def load_conditions_names(active_ids: list[str]) -> list[dict[str, Any]]:
    """Datos del catálogo de las condiciones indicadas, en el orden recibido."""
    from app.services.conditions import load_conditions_catalog

    by_id = {c["id"]: c for c in load_conditions_catalog()["conditions"]}
    return [by_id[i] for i in active_ids]


def _exposure_for_geometry(campus_data: dict[str, Any], hazard_geom):
    """Exposición de edificios, accesos y puntos de encuentro frente a una geometría de zona."""
    exposed_buildings: list[ExposedElement] = []
    restricted_accesses: list[ExposedElement] = []
    meeting_points_status: list[ExposedElement] = []

    for feat in campus_data.get("features", []):
        props = feat.get("properties", {})
        category = props.get("category", "")
        geom = shape(feat["geometry"])
        intersects = hazard_geom.intersects(geom)

        overlap_pct = 0.0
        if intersects and geom.area > 0:
            inter_area = hazard_geom.intersection(geom).area
            overlap_pct = round((inter_area / geom.area) * 100.0, 1)
        elif intersects:
            overlap_pct = 100.0

        if category == "edificio":
            level = classify_exposure(overlap_pct)
            status = _LEVEL_STATUS[level].format(pct=overlap_pct)
            exposed_buildings.append(
                ExposedElement(
                    id=props["id"],
                    name=props["name"],
                    category=category,
                    criticality=props.get("criticality"),
                    inside_hazard_zone=intersects,
                    overlap_pct=overlap_pct,
                    exposure_level=level,
                    status_in_scenario=status,
                    osm_id=props.get("osm_id"),
                )
            )
        elif category == "acceso":
            status = (
                "Acceso dentro de la zona experimental analizada (relieve o reporte)"
                if intersects
                else "Sin intersección con la zona analizada (sujeto a verificación en campo)"
            )
            restricted_accesses.append(
                ExposedElement(
                    id=props["id"],
                    name=props["name"],
                    category=category,
                    inside_hazard_zone=intersects,
                    overlap_pct=overlap_pct,
                    exposure_level=classify_exposure(overlap_pct),
                    status_in_scenario=status,
                    osm_id=props.get("osm_id"),
                )
            )
        elif category == "punto_encuentro":
            status = (
                "Comprometido en simulación — usar punto alterno"
                if intersects
                else "Fuera de la zona analizada (referencial)"
            )
            meeting_points_status.append(
                ExposedElement(
                    id=props["id"],
                    name=props["name"],
                    category=category,
                    inside_hazard_zone=intersects,
                    overlap_pct=overlap_pct,
                    status_in_scenario=status,
                )
            )

    counts = {lv: sum(1 for b in exposed_buildings if b.exposure_level == lv)
              for lv in ("marginal", "parcial", "alta", "total")}
    total_exp_bld = sum(counts[lv] for lv in EXPOSED_LEVELS)
    total_res_acc = sum(1 for a in restricted_accesses if a.inside_hazard_zone)
    return exposed_buildings, restricted_accesses, meeting_points_status, counts, total_exp_bld, total_res_acc


def _build_synthetic(
    campus_data: dict[str, Any],
    report_features: list[dict[str, Any]],
    scenario_id: str,
    reach_m: float,
    origin_note: str = "",
) -> tuple[SyntheticExposureAnalysis, dict[str, Any]]:
    """Influencia SINTÉTICA aguas abajo desde las zonas reportadas indicadas."""
    azimuth, azimuth_assumption = _dem_azimuth()
    synthetic_features = []
    synthetic_geometries = []
    for report in report_features:
        report_props = report["properties"]
        report_shape = shape(report["geometry"])
        zones = list(report_shape.geoms) if report_shape.geom_type == "MultiPolygon" else [report_shape]
        for component_index, zone in enumerate(zones):
            influence = _synthetic_influence(zone, reach_m, azimuth)
            description = (
                f"Área de influencia SINTÉTICA: se extiende {reach_m:g} m aguas abajo "
                f"(azimut {azimuth:g}°, derivado del DEM) desde las zonas reportadas. "
                "Parámetros arbitrarios de demostración, sin base de campo; no es una predicción. "
                f"Zona de origen: {report_props.get('name', 'reporte')}. "
                + (
                    "Se asumió azimut 203° porque dem_report.json no tenía azimut_descenso_deg. "
                    if azimuth_assumption else ""
                )
                + origin_note
                + "El alcance no depende de la lluvia."
            )
            synthetic_geometries.append(influence)
            synthetic_features.append({
                "type": "Feature",
                "geometry": mapping(influence),
                "properties": {
                    "kind": "influencia_sintetica",
                    "scenario_id": scenario_id,
                    "report_id": report_props.get("id"),
                    "report_component_index": component_index,
                    "report_name": report_props.get("name"),
                    "data_nature": "sintetico_demostrativo",
                    "method": "reporte+direccion_descenso_DEM",
                    "reach_m": reach_m,
                    "spread_m": SYNTH_SPREAD_M,
                    "azimuth_deg": azimuth,
                    "azimuth_assumption": azimuth_assumption,
                    "description": description,
                },
            })

    synthetic_geom = unary_union(synthetic_geometries)

    def summarize_synthetic(category: str) -> tuple[list[ExposedElement], dict[str, int]]:
        items = []
        for feat in campus_data.get("features", []):
            props = feat.get("properties", {})
            if props.get("category") != category:
                continue
            geom = shape(feat["geometry"])
            intersects = synthetic_geom.intersects(geom)
            overlap = 0.0
            if intersects and geom.area > 0:
                overlap = round(synthetic_geom.intersection(geom).area / geom.area * 100.0, 1)
            elif intersects:
                overlap = 100.0
            level = classify_exposure(overlap)
            items.append(ExposedElement(
                id=props["id"],
                name=props["name"],
                category=category,
                criticality=props.get("criticality"),
                inside_hazard_zone=intersects,
                overlap_pct=overlap,
                exposure_level=level,
                status_in_scenario=(
                    f"Elemento dentro de la influencia SINTÉTICA ({overlap}% de la huella)"
                    if intersects else "Fuera de la influencia SINTÉTICA"
                ),
                osm_id=props.get("osm_id"),
            ))
        level_counts = {
            level: sum(item.exposure_level == level for item in items)
            for level in ("marginal", "parcial", "alta", "total")
        }
        return items, level_counts

    synthetic_buildings, synthetic_building_counts = summarize_synthetic("edificio")
    synthetic_accesses, synthetic_access_counts = summarize_synthetic("acceso")
    synthetic_exposure = SyntheticExposureAnalysis(
        reach_m=reach_m,
        azimuth_deg=azimuth,
        azimuth_assumption=azimuth_assumption,
        buildings=synthetic_buildings,
        accesses=synthetic_accesses,
        building_counts=synthetic_building_counts,
        access_counts=synthetic_access_counts,
        total_buildings_exposed=sum(
            synthetic_building_counts[level] for level in EXPOSED_LEVELS
        ),
        total_accesses_inside=sum(
            item.inside_hazard_zone for item in synthetic_accesses
        ),
        description=(
            "Parámetros arbitrarios de demostración; no es una predicción. "
            "El alcance no depende de la lluvia."
        ),
    )
    return synthetic_exposure, {"type": "FeatureCollection", "features": synthetic_features}


def analyze_spatial_exposure(
    hazard_zone_id: str,
    synthetic_reach_m: float | None = None,
) -> tuple[SpatialAnalysisResult, dict[str, Any], dict[str, Any] | None]:
    campus_data = load_campus_geojson()
    hazards_data = load_hazards_geojson()

    selected_hazard = None
    for feat in hazards_data.get("features", []):
        props = feat.get("properties", {})
        if props.get("scenario_id") == hazard_zone_id and props.get("kind") != "influencia_sintetica":
            selected_hazard = feat
            break

    if selected_hazard is None:
        raise ValueError(f"Escenario espacial no encontrado: {hazard_zone_id}")

    hazard_geom = shape(selected_hazard["geometry"])
    hazard_props = selected_hazard["properties"]

    (exposed_buildings, restricted_accesses, meeting_points_status,
     counts, total_exp_bld, total_res_acc) = _exposure_for_geometry(campus_data, hazard_geom)

    synthetic_geojson = None
    synthetic_exposure = None
    if hazard_zone_id in SYNTH_REACH_M:
        effective_reach = (
            synthetic_reach_m if synthetic_reach_m is not None
            else SYNTH_REACH_M[hazard_zone_id]
        )
        report_features = [
            f for f in campus_data.get("features", [])
            if f.get("properties", {}).get("category") == "zona_reportada"
        ]
        synthetic_exposure, synthetic_geojson = _build_synthetic(
            campus_data, report_features, hazard_zone_id, effective_reach
        )

    result = SpatialAnalysisResult(
        hazard_zone_id=hazard_zone_id,
        hazard_zone_name=hazard_props.get("zone_name", hazard_zone_id),
        hazard_severity=hazard_props.get("severity", "desconocido"),
        exposed_buildings=exposed_buildings,
        restricted_accesses=restricted_accesses,
        meeting_points_status=meeting_points_status,
        total_exposed_buildings=total_exp_bld,
        total_restricted_accesses=total_res_acc,
        exposure_counts=counts,
        synthetic_exposure=synthetic_exposure,
        spatial_engine="Shapely 2.x (intersección geométrica real sobre GeoJSON referencial)",
    )

    return result, selected_hazard, synthetic_geojson


def analyze_conditions_exposure(
    condition_ids: list[str],
    synthetic_reach_m: float | None = None,
) -> tuple[SpatialAnalysisResult, dict[str, Any], dict[str, Any] | None]:
    """Escenario D: la zona se arma con las condiciones externas declaradas (sí/no).

    Devuelve lo mismo que analyze_spatial_exposure. La zona es la unión de las zonas
    reportadas que piden las reglas activas; el alcance sintético (si lo hay) va aparte,
    etiquetado como sintético y sin sumarse al conteo principal. Los edificios con agua
    en eventos previos se devuelven en watch_buildings, sin agrandar el polígono.
    ValueError si alguna condición no existe.
    """
    resolved = resolve_conditions(condition_ids)
    campus_data = load_campus_geojson()

    reports = {
        f["properties"]["id"]: f
        for f in campus_data.get("features", [])
        if f.get("properties", {}).get("category") == "zona_reportada"
    }
    missing = [zid for zid in resolved.zone_ids if zid not in reports]
    if missing:
        raise ValueError(f"Las reglas piden zonas que no existen en campus_unt.geojson: {', '.join(missing)}")
    zone_features = [reports[zid] for zid in resolved.zone_ids]
    hazard_geom = (
        unary_union([shape(f["geometry"]) for f in zone_features])
        if zone_features else GeometryCollection()
    )

    if not resolved.active:
        severity = "ninguno"
        zone_name = "Escenario D — Condiciones externas declaradas (ninguna activa)"
    else:
        severity = "muy_alto" if resolved.reach_m > 0 else ("alto" if zone_features else "moderado")
        zone_name = "Escenario D — Condiciones externas declaradas: " + "; ".join(
            c["name"] for c in load_conditions_names(resolved.active)
        )

    hazard_feature = {
        "type": "Feature",
        "geometry": mapping(hazard_geom),
        "properties": {
            "scenario_id": CONDITIONS_ZONE_ID,
            "zone_name": zone_name,
            "hazard_type": "condiciones_externas_declaradas",
            "severity": severity,
            "description": (
                "Zona armada con las condiciones externas que el usuario declaró (sí/no) y las zonas "
                "reportadas por testimonio y prensa; NO modelada ni verificada. No hay sensores en calles "
                "ni quebradas, y la lluvia no modifica este polígono."
            ),
            "data_nature": "condiciones_declaradas_testimonio_no_verificado",
            "method": "reglas_condiciones_externas",
            "conditions_active": resolved.active,
            "rules_fired": [r["id"] for r in resolved.fired_rules],
        },
    }

    (exposed_buildings, restricted_accesses, meeting_points_status,
     counts, total_exp_bld, total_res_acc) = _exposure_for_geometry(campus_data, hazard_geom)

    effective_reach = synthetic_reach_m if synthetic_reach_m is not None else resolved.reach_m
    synthetic_exposure = None
    synthetic_geojson = None
    if effective_reach > 0 and zone_features:
        synthetic_exposure, synthetic_geojson = _build_synthetic(
            campus_data, zone_features, CONDITIONS_ZONE_ID, effective_reach,
            origin_note="Alcance definido por las reglas de condiciones externas activas. ",
        )

    buildings = {
        f["properties"]["id"]: f
        for f in campus_data.get("features", [])
        if f.get("properties", {}).get("category") == "edificio"
    }
    watch: list[WatchedBuilding] = []
    seen: set[str] = set()
    for event in resolved.watch_events:
        for ref_id in event.get("ref_ids", []):
            if ref_id in seen or ref_id not in buildings:
                continue
            seen.add(ref_id)
            props = buildings[ref_id]["properties"]
            geom = shape(buildings[ref_id]["geometry"])
            inside = hazard_geom.intersects(geom)
            overlap = (
                round(hazard_geom.intersection(geom).area / geom.area * 100.0, 1)
                if inside and geom.area > 0 else 0.0
            )
            watch.append(WatchedBuilding(
                id=ref_id,
                name=props["name"],
                event_id=event["id"],
                event_date=event.get("fecha"),
                source=event["fuente"],
                confidence=event.get("confianza", "baja"),
                inside_hazard_zone=inside,
                overlap_pct=overlap,
                status_in_scenario=(
                    f"Vigilar: agua reportada en este edificio el {event.get('fecha') or 'fecha no indicada'} "
                    "(prensa, por confirmar). Se muestra aunque quede fuera del polígono."
                ),
            ))

    result = SpatialAnalysisResult(
        hazard_zone_id=CONDITIONS_ZONE_ID,
        hazard_zone_name=zone_name,
        hazard_severity=severity,
        exposed_buildings=exposed_buildings,
        restricted_accesses=restricted_accesses,
        meeting_points_status=meeting_points_status,
        total_exposed_buildings=total_exp_bld,
        total_restricted_accesses=total_res_acc,
        exposure_counts=counts,
        synthetic_exposure=synthetic_exposure,
        watch_buildings=watch,
        spatial_engine="Shapely 2.x (intersección geométrica real; zona armada por condiciones externas declaradas)",
    )
    return result, hazard_feature, synthetic_geojson


# ---------------------------------------------------------------------------
# Motor contextual dinámico por edificio y por rol (Bloque 2)
# ---------------------------------------------------------------------------
BUILDING_RISK_META: dict[str, dict[str, str]] = {
    "critico": {
        "label": "Crítico (> 15 cm)",
        "summary": "Inundación modelada en entorno o acceso principal",
    },
    "alto": {
        "label": "Alto (5–15 cm)",
        "summary": "Aniego peatonal cercano en accesos o planta baja",
    },
    "moderado": {
        "label": "Moderado (2–5 cm)",
        "summary": "Encharcamiento leve en veredas y vías adyacentes",
    },
    "seguro": {
        "label": "Seguro (< 2 cm)",
        "summary": "Sector seco en cota favorable, apto para resguardo temporal",
    },
}


def _classify_building_depth(max_depth_cm: float) -> str:
    if max_depth_cm > 15.0:
        return "critico"
    if max_depth_cm >= 5.0:
        return "alto"
    if max_depth_cm >= 2.0:
        return "moderado"
    return "seguro"


def _metric_distance_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    dx = (lon2 - lon1) * KX
    dy = (lat2 - lat1) * KY
    return math.hypot(dx, dy)


def _short_gate_name(raw_name: str) -> str:
    import re as _re

    match = _re.search(r"\bPuerta\s*([1-4])\b", raw_name or "", _re.IGNORECASE)
    if match:
        return f"Puerta {match.group(1)}"
    return (raw_name or "Acceso perimetral").strip()


def _to_metric(geom):
    return shapely.transform(
        geom,
        lambda coords: np.column_stack((
            (coords[:, 0] + 79.0) * KX,
            (coords[:, 1] - LAT0) * KY,
        )),
    )


def _extract_hydro_dict(hydro_result: Any) -> dict[str, Any]:
    if hasattr(hydro_result, "model_dump"):
        return hydro_result.model_dump()
    if isinstance(hydro_result, dict):
        return hydro_result
    raise ValueError("hydro_result debe ser HydroRunResponse o dict.")


def build_building_recommendations(
    hydro_result: Any,
    campus_geojson: dict[str, Any] | None = None,
    evacuation_geojson: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Cruza cada edificio de campus_unt.geojson con la malla real de hydro.py (~18 m de borde).

    Devuelve recomendaciones diferenciadas por edificio y por rol (estudiante, docente, administrativo).
    """
    hydro = _extract_hydro_dict(hydro_result)
    campus = campus_geojson if campus_geojson is not None else load_campus_geojson()
    evacuation = evacuation_geojson if evacuation_geojson is not None else load_evacuation_geojson()

    elements_by_id: dict[str, dict[str, Any]] = {
        str(el.get("id")): el for el in (hydro.get("elements") or []) if el.get("id")
    }
    frames = hydro.get("frames") or []

    # Preprocesar polígonos inundados por hora en coordenadas métricas
    parsed_frames: list[tuple[int, list[tuple[Any, str, float, float]]]] = []
    class_floor_cm = {"leve": 2.5, "moderada": 6.0, "alta": 16.0}
    for frame in frames:
        hour = int(frame.get("hour", 1))
        fc = frame.get("geojson") or {}
        feats = fc.get("features") or []
        frame_items: list[tuple[Any, str, float, float]] = []
        for feat in feats:
            geom_raw = feat.get("geometry")
            if not geom_raw:
                continue
            props = feat.get("properties") or {}
            cls = str(props.get("depth_class") or "leve")
            min_cm = float(props.get("min_depth_cm") or class_floor_cm.get(cls, 2.0))
            max_cm = float(props.get("max_depth_cm") or min_cm)
            try:
                geom_m = _to_metric(shape(geom_raw))
                frame_items.append((geom_m, cls, min_cm, max_cm))
            except Exception:
                continue
        if frame_items:
            parsed_frames.append((hour, frame_items))

    # 1. Identificar puertas nominales (P1-P4) y su afectación
    gates: list[dict[str, Any]] = []
    for feat in campus.get("features", []):
        props = feat.get("properties") or {}
        if props.get("category") != "acceso":
            continue
        name = str(props.get("name") or "")
        short_name = _short_gate_name(name)
        if not short_name.startswith("Puerta "):
            continue
        geom = shape(feat["geometry"])
        c = geom.centroid
        el = elements_by_id.get(str(props.get("id") or ""))
        gate_depth = float(el.get("max_depth_cm") or 0.0) if el else 0.0
        if gate_depth < 2.0 and parsed_frames:
            gate_buf = _to_metric(geom).buffer(15.0)
            for _hr, items in parsed_frames:
                for g_m, cls, min_cm, _max_cm in items:
                    if gate_buf.intersects(g_m):
                        gate_depth = max(gate_depth, max(min_cm, class_floor_cm.get(cls, 2.0)))
        gates.append({
            "id": str(props.get("id") or short_name),
            "name": name,
            "short_name": short_name,
            "lon": float(c.x),
            "lat": float(c.y),
            "max_depth_cm": round(gate_depth, 1),
            "affected": gate_depth >= 2.0,
        })

    affected_gates_all = [g for g in gates if g["affected"]]
    free_gates_all = [g for g in gates if not g["affected"]]

    # 2. Evaluar puntos de encuentro de evacuation_reference.geojson (libres si < 2 cm)
    meeting_points: list[dict[str, Any]] = []
    for feat in evacuation.get("features", []):
        props = feat.get("properties") or {}
        ltype = props.get("layer_type") or props.get("zone_type")
        if ltype not in ("meeting_point", "safe_point"):
            continue
        geom = shape(feat["geometry"])
        c = geom.centroid
        pt_depth = 0.0
        if parsed_frames:
            pt_buf = _to_metric(geom).buffer(8.0)
            for _hr, items in parsed_frames:
                for g_m, cls, min_cm, _max_cm in items:
                    if pt_buf.intersects(g_m):
                        pt_depth = max(pt_depth, max(min_cm, class_floor_cm.get(cls, 2.0)))
        meeting_points.append({
            "id": str(props.get("id") or props.get("name") or "mp"),
            "name": str(props.get("name") or "Punto de encuentro UNT"),
            "lon": float(c.x),
            "lat": float(c.y),
            "max_depth_cm": round(pt_depth, 1),
            "is_safe": pt_depth < 2.0,
        })

    safe_meeting_points = [mp for mp in meeting_points if mp["is_safe"]]
    candidate_meeting_points = safe_meeting_points if safe_meeting_points else meeting_points

    # 3. Cruzar cada edificio con la malla real (interior + borde de ~18 m)
    summary_peak_hour = int((hydro.get("summary") or {}).get("peak_hour") or 1)
    results: list[dict[str, Any]] = []

    for feat in campus.get("features", []):
        props = feat.get("properties") or {}
        if props.get("category") != "edificio":
            continue
        bld_id = str(props.get("id") or "")
        bld_name = str(props.get("name") or "Edificio UNT")
        geom = shape(feat["geometry"])
        centroid = geom.centroid
        bld_lon, bld_lat = float(centroid.x), float(centroid.y)
        bld_buf_m = _to_metric(geom).buffer(18.0)

        el = elements_by_id.get(bld_id)
        elem_depth_cm = float(el.get("max_depth_cm") or 0.0) if el else 0.0
        elem_first_hr = el.get("first_hour_affected") if el else None

        max_depth_cm = elem_depth_cm
        peak_hour: int | None = int(elem_first_hr) if elem_first_hr is not None else None
        best_frame_depth = 0.0

        for hr, items in parsed_frames:
            hr_depth = 0.0
            for g_m, cls, min_cm, max_cm in items:
                if bld_buf_m.intersects(g_m):
                    # Usar el piso real de la clase (o el valor exacto del elemento si está en esa clase)
                    est_cm = max(min_cm, class_floor_cm.get(cls, 2.0))
                    if cls == "alta":
                        est_cm = max(15.5, min(max_cm, max(elem_depth_cm, 15.5)))
                    elif cls == "moderada":
                        est_cm = max(5.5, min(14.9, max(elem_depth_cm, min_cm)))
                    elif cls == "leve":
                        est_cm = max(2.2, min(4.9, max(elem_depth_cm, min_cm)))
                    hr_depth = max(hr_depth, est_cm)
            if hr_depth > best_frame_depth:
                best_frame_depth = hr_depth
                peak_hour = hr

        max_depth_cm = round(max(elem_depth_cm, best_frame_depth), 1)
        if peak_hour is None:
            peak_hour = summary_peak_hour if max_depth_cm >= 2.0 else None

        risk_level = _classify_building_depth(max_depth_cm)
        risk_meta = BUILDING_RISK_META[risk_level]

        # Puertas afectadas más cercanas a evitar
        sorted_affected = sorted(
            affected_gates_all,
            key=lambda g: _metric_distance_m(bld_lon, bld_lat, g["lon"], g["lat"]),
        )
        avoid_gates = [g["short_name"] for g in sorted_affected[:2]]
        avoid_text = ", ".join(avoid_gates) if avoid_gates else "accesos con agua acumulada"

        # Puerta libre más cercana (referencia)
        sorted_free = sorted(
            free_gates_all,
            key=lambda g: _metric_distance_m(bld_lon, bld_lat, g["lon"], g["lat"]),
        )
        nearest_free_gate = sorted_free[0]["short_name"] if sorted_free else "el acceso en cota más alta"

        # Punto de encuentro seguro más cercano (< 2 cm)
        nearest_mp: dict[str, Any] | None = None
        if candidate_meeting_points:
            best_mp = min(
                candidate_meeting_points,
                key=lambda mp: _metric_distance_m(bld_lon, bld_lat, mp["lon"], mp["lat"]),
            )
            dist_m = round(_metric_distance_m(bld_lon, bld_lat, best_mp["lon"], best_mp["lat"]))
            walk_min = max(1, round(dist_m / 70.0))
            nearest_mp = {
                "id": best_mp["id"],
                "name": best_mp["name"],
                "distance_m": int(dist_m),
                "walk_time_min": int(walk_min),
                "lat": best_mp["lat"],
                "lon": best_mp["lon"],
                "max_depth_cm": best_mp["max_depth_cm"],
            }
        mp_name = nearest_mp["name"] if nearest_mp else "el punto de encuentro seguro más cercano"
        mp_dist_txt = (
            f"{nearest_mp['distance_m']} m (~{nearest_mp['walk_time_min']} min a pie)"
            if nearest_mp
            else "cota alta libre de aniego"
        )
        peak_txt = f"h+{peak_hour}" if peak_hour is not None else "el periodo evaluado"

        if risk_level == "critico":
            recs = {
                "estudiante": (
                    f"Evacúa preventivamente {bld_name} hacia {mp_name} ({mp_dist_txt}) antes de {peak_txt} "
                    f"o aplica refugio vertical en el 2.° piso si el agua rodea la salida ({max_depth_cm} cm modelados). "
                    f"Evita {avoid_text}."
                ),
                "docente": (
                    f"Suspende de inmediato la sesión en {bld_name} ({max_depth_cm} cm modelados en {peak_txt}), "
                    f"corta energía de equipos de laboratorio y guía al grupo en orden hacia {mp_name} "
                    f"(o piso superior si el acceso está anegado), evitando {avoid_text}."
                ),
                "administrativo": (
                    f"Cierra atención presencial en planta baja de {bld_name}, desconecta tomas bajas y resguarda "
                    f"equipos críticos en nivel superior ante lámina crítica ({max_depth_cm} cm en {peak_txt}). "
                    f"Coordina evacuación hacia {mp_name} sin cruzar {avoid_text}."
                ),
            }
        elif risk_level == "alto":
            recs = {
                "estudiante": (
                    f"Restringe el tránsito por los accesos bajos de {bld_name} ({max_depth_cm} cm en {peak_txt}). "
                    f"Sal con anticipación por {nearest_free_gate} o dirígete a {mp_name} ({mp_dist_txt}), "
                    f"evitando {avoid_text}."
                ),
                "docente": (
                    f"Concluye actividades en planta baja de {bld_name} antes del pico ({peak_txt}, {max_depth_cm} cm), "
                    f"resguarda proyectores y material docente en altura y orienta la salida hacia {mp_name} "
                    f"o {nearest_free_gate}, evitando {avoid_text}."
                ),
                "administrativo": (
                    f"Eleva equipos de cómputo y archivos del primer nivel en {bld_name} ({max_depth_cm} cm en {peak_txt}), "
                    f"coloca señalización preventiva en puertas bajas y deriva el flujo peatonal hacia {nearest_free_gate} "
                    f"y {mp_name}."
                ),
            }
        elif risk_level == "moderado":
            recs = {
                "estudiante": (
                    f"Encharcamiento leve cerca de {bld_name} ({max_depth_cm} cm en {peak_txt}). "
                    f"Transita solo por veredas elevadas, evita {avoid_text} y ten ubicado {mp_name} ({mp_dist_txt}) "
                    f"si la lluvia persiste la próxima hora."
                ),
                "docente": (
                    f"Mantén vigilancia durante la próxima hora en {bld_name} ({max_depth_cm} cm en {peak_txt}); "
                    f"evita prácticas en exteriores cercanos y prevé flexibilidad de salida hacia {mp_name} "
                    f"si aumenta la acumulación."
                ),
                "administrativo": (
                    f"Verifica sumideros y canaletas de entrada en {bld_name} ante encharcamiento leve ({max_depth_cm} cm), "
                    f"mantén despejada la ruta hacia {mp_name} y reporta obstrucciones en el panel."
                ),
            }
        else:
            recs = {
                "estudiante": (
                    f"{bld_name} permanece seco en cota favorable (< 2 cm; {max_depth_cm} cm modelados). "
                    f"Puedes permanecer resguardado aquí y apoyar la orientación hacia {mp_name} ({mp_dist_txt}); "
                    f"evita desplazarte hacia {avoid_text}."
                ),
                "docente": (
                    f"{bld_name} está en sector seguro (< 2 cm). Puede operar como espacio de resguardo temporal "
                    f"para estudiantes de zonas bajas mientras pasa el pico; evita liberar grupos hacia {avoid_text}."
                ),
                "administrativo": (
                    f"{bld_name} presenta cota favorable (< 2 cm) y es apto como punto de apoyo logístico y "
                    f"resguardo temporal en coordinación con {mp_name}. Mantén habilitado el acceso para evacuados."
                ),
            }

        results.append({
            "id": bld_id,
            "name": bld_name,
            "max_depth_cm": max_depth_cm,
            "risk_level": risk_level,
            "risk_label": risk_meta["label"],
            "risk_summary": risk_meta["summary"],
            "peak_hour": peak_hour,
            "avoid_gates": avoid_gates,
            "nearest_safe_meeting_point": nearest_mp,
            "recommendations_by_role": recs,
            "centroid": {"lat": round(bld_lat, 6), "lon": round(bld_lon, 6)},
        })

    # Ordenar por severidad/profundidad descendente, luego nombre
    risk_order = {"critico": 0, "alto": 1, "moderado": 2, "seguro": 3}
    results.sort(key=lambda b: (risk_order.get(b["risk_level"], 4), -b["max_depth_cm"], b["name"]))
    return results
