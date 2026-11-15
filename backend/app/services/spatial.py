import json
from typing import Any

from shapely.geometry import shape

from app.config import CAMPUS_GEOJSON_PATH, HAZARDS_GEOJSON_PATH
from app.models import ExposedElement, SpatialAnalysisResult


# Umbrales EXPERIMENTALES de exposición (% de la huella del edificio dentro de la zona simulada).
# No provienen de una norma ni están validados: sirven para graduar el aviso y se deben poder discutir.
MARGINAL_MAX_PCT = 5.0   # < 5 %: contacto marginal (no cuenta como edificio expuesto)
PARTIAL_MAX_PCT = 25.0   # 5–25 %: parcial
HIGH_MAX_PCT = 75.0      # 25–75 %: alta; > 75 %: total
EXPOSED_LEVELS = ("parcial", "alta", "total")


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
    "ninguna": "Fuera del polígono de peligro simulado",
    "marginal": "Contacto marginal ({pct}% de la huella) con la zona simulada; sin afectación esperada del edificio",
    "parcial": "Exposición parcial ({pct}% de la huella) en escenario simulado: revisar el sector y los accesos al primer nivel",
    "alta": "Exposición alta ({pct}% de la huella) en escenario simulado: es probable que el primer nivel y sus accesos queden afectados",
    "total": "Exposición total ({pct}% de la huella) en escenario simulado: la huella queda casi por completo dentro de la zona",
}


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

    counts = {lv: sum(1 for b in exposed_buildings if b.exposure_level == lv)
              for lv in ("marginal", "parcial", "alta", "total")}
    total_exp_bld = sum(counts[lv] for lv in EXPOSED_LEVELS)
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
        exposure_counts=counts,
        spatial_engine="Shapely 2.x (intersección geométrica real sobre GeoJSON referencial)",
    )

    return result, selected_hazard
