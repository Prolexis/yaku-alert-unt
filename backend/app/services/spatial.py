import json
from typing import Any

from shapely.geometry import shape

from app.config import CAMPUS_GEOJSON_PATH, HAZARDS_GEOJSON_PATH
from app.models import ExposedElement, SpatialAnalysisResult


def load_campus_geojson() -> dict[str, Any]:
    with CAMPUS_GEOJSON_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_hazards_geojson() -> dict[str, Any]:
    with HAZARDS_GEOJSON_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def analyze_spatial_exposure(hazard_zone_id: str) -> tuple[SpatialAnalysisResult, dict[str, Any]]:
    campus_data = load_campus_geojson()
    hazards_data = load_hazards_geojson()

    selected_hazard = None
    for feat in hazards_data.get("features", []):
        if feat.get("properties", {}).get("scenario_id") == hazard_zone_id:
            selected_hazard = feat
            break

    if selected_hazard is None:
        raise ValueError(f"Escenario espacial no encontrado: {hazard_zone_id}")

    hazard_geom = shape(selected_hazard["geometry"])
    hazard_props = selected_hazard["properties"]

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
            status = (
                "Expuesto en escenario simulado (revisar primer nivel)"
                if intersects
                else "Fuera del polígono de peligro simulado"
            )
            exposed_buildings.append(
                ExposedElement(
                    id=props["id"],
                    name=props["name"],
                    category=category,
                    criticality=props.get("criticality"),
                    inside_hazard_zone=intersects,
                    overlap_pct=overlap_pct,
                    status_in_scenario=status,
                )
            )
        elif category == "acceso":
            status = (
                "Acceso restringido en simulación (posible anegamiento)"
                if intersects
                else "Acceso transitable en simulación (sujeto a verificación)"
            )
            restricted_accesses.append(
                ExposedElement(
                    id=props["id"],
                    name=props["name"],
                    category=category,
                    inside_hazard_zone=intersects,
                    overlap_pct=overlap_pct,
                    status_in_scenario=status,
                )
            )
        elif category == "punto_encuentro":
            status = (
                "Comprometido en simulación — usar punto alterno"
                if intersects
                else "Disponible como referencia en simulación"
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

    total_exp_bld = sum(1 for b in exposed_buildings if b.inside_hazard_zone)
    total_res_acc = sum(1 for a in restricted_accesses if a.inside_hazard_zone)

    result = SpatialAnalysisResult(
        hazard_zone_id=hazard_zone_id,
        hazard_zone_name=hazard_props.get("zone_name", hazard_zone_id),
        hazard_severity=hazard_props.get("severity", "desconocido"),
        exposed_buildings=exposed_buildings,
        restricted_accesses=restricted_accesses,
        meeting_points_status=meeting_points_status,
        total_exposed_buildings=total_exp_bld,
        total_restricted_accesses=total_res_acc,
        spatial_engine="Shapely 2.x (intersección geométrica real sobre GeoJSON referencial)",
    )

    return result, selected_hazard
