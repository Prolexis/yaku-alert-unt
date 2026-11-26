"""Pruebas para la capa referencial de puntos seguros y rutas de evacuación UNT."""
from __future__ import annotations

from fastapi.testclient import TestClient
from shapely.geometry import Point, shape
from shapely.ops import unary_union

from app.main import app
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

    features = evac["features"]
    safe_points = [f for f in features if f["properties"].get("zone_type") == "safe_point"]
    routes = [f for f in features if f["properties"].get("zone_type") == "evacuation_route"]

    assert 4 <= len(safe_points) <= 5
    assert 4 <= len(routes) <= 5

    safe_point_ids = set()
    for sp in safe_points:
        props = sp["properties"]
        assert props.get("id")
        assert props.get("name")
        assert props.get("rationale")
        assert props.get("reference_only") is True
        safe_point_ids.add(props["id"])

    for route in routes:
        props = route["properties"]
        assert props.get("id")
        assert props.get("name")
        assert props.get("from_zone")
        assert props.get("to_safe_point_id") in safe_point_ids
        assert props.get("distance_m_approx", 0) > 0
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


def test_evacuation_endpoints_backwards_compatible():
    resp_layers = client.get("/api/campus/layers")
    assert resp_layers.status_code == 200
    layers = resp_layers.json()
    assert "campus" in layers
    assert "hazards" in layers
    assert "evacuation" in layers
    assert layers["evacuation"]["type"] == "FeatureCollection"

    resp_evac = client.get("/api/campus/evacuation")
    assert resp_evac.status_code == 200
    assert resp_evac.json() == layers["evacuation"]
