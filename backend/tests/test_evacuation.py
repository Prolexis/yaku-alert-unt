"""Pruebas para la capa referencial de áreas seguras, puntos de encuentro y rutas de evacuación UNT."""
from __future__ import annotations

import numpy as np
import shapely
from fastapi.testclient import TestClient
from shapely.geometry import Point, shape
from shapely.ops import unary_union

from app.main import app
from app.services.hydro import list_presets, load_terrain_grid, simulate_core
from app.services.spatial import load_campus_geojson, load_evacuation_geojson

client = TestClient(app)


def _iter_coords(geometry: dict):
    gtype = geometry["type"]
    coords = geometry["coordinates"]
    if gtype == "Point":
        yield coords
    elif gtype == "LineString":
        yield from coords
    elif gtype == "Polygon":
        for ring in coords:
            yield from ring
    elif gtype == "MultiPolygon":
        for poly in coords:
            for ring in poly:
                yield from ring


def test_evacuation_geojson_schema_and_campus_bounds():
    evac = load_evacuation_geojson()
    assert evac["type"] == "FeatureCollection"
    assert evac["metadata"]["reference_only"] is True
    assert evac["metadata"]["verified_against_dem"] is True

    features = evac["features"]
    safe_areas = [f for f in features if f["properties"].get("layer_type") == "safe_area"]
    meeting_points = [f for f in features if f["properties"].get("layer_type") == "meeting_point"]
    routes = [f for f in features if f["properties"].get("layer_type") == "evacuation_route"]

    assert 3 <= len(safe_areas) <= 4
    assert len(meeting_points) == 5
    assert 4 <= len(routes) <= 5

    safe_area_ids = set()
    for sa in safe_areas:
        assert sa["geometry"]["type"] == "Polygon"
        props = sa["properties"]
        assert props.get("id")
        assert props.get("name")
        assert props.get("area_kind") in ("espacio_abierto_elevado", "refugio_bajo_techo")
        assert props.get("elevation_note")
        assert props.get("capacity_ref")
        assert props.get("rationale")
        assert props.get("reference_only") is True
        safe_area_ids.add(props["id"])

    meeting_point_ids = set()
    for mp in meeting_points:
        assert mp["geometry"]["type"] == "Point"
        props = mp["properties"]
        assert props.get("id")
        assert props.get("name")
        assert props.get("linked_safe_area_id") in safe_area_ids
        assert props.get("landmark")
        assert isinstance(props.get("accessible_from"), list) and len(props["accessible_from"]) > 0
        assert isinstance(props.get("avoid_when_gate_affected"), list)
        assert props.get("rationale")
        assert props.get("reference_only") is True
        meeting_point_ids.add(props["id"])

    for route in routes:
        assert route["geometry"]["type"] == "LineString"
        props = route["properties"]
        assert props.get("id")
        assert props.get("name")
        assert props.get("from_zone")
        assert props.get("to_meeting_point_id") in meeting_point_ids
        assert props.get("distance_m_approx", 0) > 0
        assert props.get("walk_min_approx", 0) > 0
        assert isinstance(props.get("avoid_when_gate_affected"), list)
        assert props.get("reference_only") is True

    campus = load_campus_geojson()
    perimeters = [
        shape(f["geometry"])
        for f in campus["features"]
        if f["properties"].get("category") == "perimetro_campus"
    ]
    assert perimeters
    campus_poly = unary_union(perimeters)
    minx, miny, maxx, maxy = campus_poly.bounds

    for feat in features:
        fid = feat["properties"]["id"]
        for lon, lat in _iter_coords(feat["geometry"]):
            assert minx <= lon <= maxx, f"{fid}: lon {lon} fuera del bbox UNT"
            assert miny <= lat <= maxy, f"{fid}: lat {lat} fuera del bbox UNT"
            assert campus_poly.buffer(1e-5).contains(Point(lon, lat)), (
                f"{fid}: ({lon}, {lat}) fuera del polígono del campus UNT"
            )


def test_safe_areas_and_meeting_points_stay_dry_in_2017_and_2023_dem():
    """Valida con hydro.py sobre evento_2017_03 y evento_2023_03_10 que todas las áreas seguras
    y puntos de encuentro se mantienen dentro del campus UNT y con profundidad < 2 cm en hora pico."""
    evac = load_evacuation_geojson()
    grid = load_terrain_grid()
    presets_by_id = {p.id: p for p in list_presets().presets}

    x_centers = grid.origin_lon + (np.arange(grid.nx) + 0.5) * grid.dx_deg
    y_centers = grid.origin_lat - (np.arange(grid.ny) + 0.5) * grid.dy_deg
    xx, yy = np.meshgrid(x_centers, y_centers)

    for preset_id in ("evento_2017_03", "evento_2023_03_10"):
        preset = presets_by_id[preset_id]
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
        peak_cm = np.max(np.stack(hourly, axis=0), axis=0) * 100.0

        for feat in evac["features"]:
            props = feat["properties"]
            ltype = props.get("layer_type")
            fid = props["id"]
            if ltype == "meeting_point":
                lon, lat = feat["geometry"]["coordinates"]
                col = int((lon - grid.origin_lon) / grid.dx_deg)
                row = int((grid.origin_lat - lat) / grid.dy_deg)
                assert grid.campus_mask[row, col], f"{fid} fuera de campus_mask"
                depth = float(peak_cm[row, col])
                assert depth < 2.0, f"{fid} alcanza {depth:.2f} cm en {preset_id} (>= 2 cm)"
            elif ltype == "safe_area":
                poly = shape(feat["geometry"])
                mask = shapely.contains_xy(poly, xx, yy)
                assert mask.any(), f"{fid} sin celdas DEM"
                assert bool(grid.campus_mask[mask].all()), f"{fid} tiene celdas fuera del campus"
                depth = float(peak_cm[mask].max())
                assert depth < 2.0, f"{fid} alcanza {depth:.2f} cm en {preset_id} (>= 2 cm)"


def test_evacuation_endpoints_expose_dem_validation():
    resp_layers = client.get("/api/campus/layers")
    assert resp_layers.status_code == 200
    layers = resp_layers.json()
    assert "campus" in layers
    assert "hazards" in layers
    assert "evacuation" in layers
    assert layers["evacuation"]["type"] == "FeatureCollection"

    evac = layers["evacuation"]
    assert evac["metadata"]["verified_against_dem"] is True
    assert evac["dem_validation"]["verified_against_dem"] is True
    assert evac["dem_validation"]["max_depth_at_safe_points_cm"] < 2.0
    assert evac["dem_validation"]["max_depth_at_safe_areas_cm"] < 2.0
    assert evac["dem_validation"]["counts"]["safe_areas"] == 4
    assert evac["dem_validation"]["counts"]["meeting_points"] == 5

    resp_evac = client.get("/api/campus/evacuation")
    assert resp_evac.status_code == 200
    assert resp_evac.json() == evac
