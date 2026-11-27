import json
import math
from typing import Any

import numpy as np
import shapely
from shapely.affinity import translate
from shapely.geometry import GeometryCollection, mapping, shape
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


def load_evacuation_geojson() -> dict[str, Any]:
    with EVACUATION_GEOJSON_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


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
