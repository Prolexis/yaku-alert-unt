#!/usr/bin/env python3
"""Genera backend/app/data/campus_unt.geojson con geometrías REALES de OpenStreetMap.

Uso (desde la raíz del proyecto, con internet):
    pip install httpx shapely
    python scripts/build_campus_geojson.py            # descarga de Overpass
    python scripts/build_campus_geojson.py --input overpass.json   # usa un export ya descargado

Salida: mismo esquema que usa spatial.py (id, name, category, criticality, ...)
más trazabilidad: source, osm_id, verified, data_nature.
Los puntos de encuentro y accesos NO se inventan: se leen de
scripts/campus_curation.json (llenado tras visita de campo / planos oficiales).
Datos © colaboradores de OpenStreetMap, licencia ODbL.
"""
import argparse, json, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "backend" / "app" / "data" / "campus_unt.geojson"
CURATION = Path(__file__).with_name("campus_curation.json")

# Caja que cubre la Ciudad Universitaria (S, W, N, E)
BBOX = (-8.1200, -79.0450, -8.1090, -79.0330)
OVERPASS = ["https://overpass-api.de/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter"]

QUERY = """[out:json][timeout:60];
(
  way["building"]({s},{w},{n},{e});
  way["amenity"~"university|college"]({s},{w},{n},{e});
  way["leisure"~"pitch|stadium|sports_centre"]({s},{w},{n},{e});
  way["highway"~"footway|path|pedestrian|service|residential|tertiary|secondary"]({s},{w},{n},{e});
  node["barrier"~"gate|entrance"]({s},{w},{n},{e});
  node["entrance"]({s},{w},{n},{e});
);
out geom tags;"""


def fetch():
    import httpx
    q = QUERY.format(s=BBOX[0], w=BBOX[1], n=BBOX[2], e=BBOX[3])
    for url in OVERPASS:
        try:
            r = httpx.post(url, data={"data": q}, timeout=90,
                           headers={"User-Agent": "yaku-alert-unt/1.0 (hackathon)"})
            r.raise_for_status()
            return r.json()
        except Exception as exc:  # noqa
            print(f"[aviso] {url}: {exc}", file=sys.stderr)
    sys.exit("No se pudo descargar de Overpass. Exporta los datos desde overpass-turbo.eu "
             "(Exportar > datos sin procesar) y usa --input archivo.json")


def ring(geom):
    return [[p["lon"], p["lat"]] for p in geom]


def build(data, curation):
    cur = curation.get("overrides", {})
    feats = []
    for el in data.get("elements", []):
        t = el.get("tags", {})
        oid = f'{el["type"]}/{el["id"]}'
        base = {"osm_id": oid, "source": "OpenStreetMap (ODbL)", "verified": False,
                "data_nature": "osm_referencial"}
        if el["type"] == "way" and "geometry" in el:
            pts = ring(el["geometry"])
            closed = len(pts) > 3 and pts[0] == pts[-1]
            if "building" in t and closed:
                p = {"id": f'bld_osm_{el["id"]}', "category": "edificio",
                     "name": t.get("name") or "Edificio sin nombre (OSM)",
                     "floors": int(t["building:levels"]) if t.get("building:levels", "").isdigit() else None,
                     "criticality": "media", "has_ground_level_services": True, **base}
                feats.append({"type": "Feature", "properties": p,
                              "geometry": {"type": "Polygon", "coordinates": [pts]}})
            elif ("amenity" in t or "leisure" in t) and closed:
                kind = "perimetro_campus" if t.get("amenity") in ("university", "college") else "area_deportiva"
                p = {"id": f'{kind}_{el["id"]}', "category": kind,
                     "name": t.get("name") or kind, **base}
                feats.append({"type": "Feature", "properties": p,
                              "geometry": {"type": "Polygon", "coordinates": [pts]}})
            elif "highway" in t:
                p = {"id": f'via_{el["id"]}', "category": "via", "highway": t["highway"],
                     "name": t.get("name") or "Vía/sendero", **base}
                feats.append({"type": "Feature", "properties": p,
                              "geometry": {"type": "LineString", "coordinates": pts}})
        elif el["type"] == "node" and ("barrier" in t or "entrance" in t):
            p = {"id": f'acc_osm_{el["id"]}', "category": "acceso",
                 "name": t.get("name") or "Acceso (OSM)", **base}
            feats.append({"type": "Feature", "properties": p,
                          "geometry": {"type": "Point", "coordinates": [el["lon"], el["lat"]]}})
    # Curación manual: renombrar / reclasificar por osm_id
    for f in feats:
        o = cur.get(f["properties"]["osm_id"])
        if o:
            f["properties"].update(o)
    # Elementos que solo existen por trabajo de campo (puntos de encuentro, accesos)
    for item in curation.get("manual_features", []):
        if str(item.get("source", "")).startswith("EJEMPLO"):
            continue  # plantilla: no entra al mapa
        feats.append({"type": "Feature", "properties": {
            "verified": item.get("verified", False), "source": item.get("source", "visita de campo"),
            "data_nature": "campo_referencial", **item["properties"]},
            "geometry": item["geometry"]})
    return {"type": "FeatureCollection",
            "metadata": {"campus": "Ciudad Universitaria — UNT", "center": [-79.038595, -8.114656],
                         "data_nature": "osm_referencial",
                         "generated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                         "attribution": "© colaboradores de OpenStreetMap (ODbL)",
                         "disclaimer": "Geometrías de OpenStreetMap, no verificadas oficialmente. "
                                       "No reemplazan planos catastrales ni mapas de Defensa Civil UNT."},
            "features": feats}


def clip_to_campus(fc, perimeter_ids, include_names=(), buffer_deg=0.00012):
    """Recorta al perímetro de la UNT (+ ~13 m de margen para puertas en el borde)."""
    from shapely.geometry import shape, mapping
    from shapely.ops import unary_union
    per = [shape(f["geometry"]) for f in fc["features"]
           if f["properties"]["osm_id"] in perimeter_ids]
    if not per:
        sys.exit(f"No encontré los perímetros {perimeter_ids}. Revisa --perimeter.")
    area = unary_union(per).buffer(buffer_deg)
    # Anexos que son parte de la UNT aunque OSM los dibuje fuera del perímetro
    # (CEPUNT, CIDUNT, RNC...): se incluyen por nombre y se amplía el área ~35 m
    # alrededor para traer también sus accesos y senderos.
    import re
    rx = re.compile("|".join(include_names), re.I) if include_names else None
    if rx:
        extra = [shape(f["geometry"]).buffer(0.00035) for f in fc["features"]
                 if f["geometry"]["type"] == "Polygon"
                 and f["properties"]["osm_id"] not in perimeter_ids
                 and rx.search(f["properties"].get("name") or "")]
        if extra:
            area = unary_union([area, *extra])
            print(f"[info] anexos incluidos por nombre: {len(extra)}")
    kept = []
    for f in fc["features"]:
        pr = f["properties"]
        if pr["osm_id"] in perimeter_ids:
            pr["category"] = "perimetro_campus"
            pr["name"] = "CEPUNT (dentro del campus)" if pr.get("name") == "CEPUNT" \
                else "Perímetro Ciudad Universitaria UNT"
            kept.append(f); continue
        if pr.get("category") in ("punto_encuentro", "ruta_referencial"):
            kept.append(f); continue  # manuales: no se recortan
        g = shape(f["geometry"])
        if g.geom_type == "Polygon":
            if area.contains(g.representative_point()):
                kept.append(f)
        elif g.geom_type == "LineString":
            inter = g.intersection(area)
            if inter.is_empty:
                continue
            if inter.geom_type == "MultiLineString":
                for i, part in enumerate(inter.geoms):
                    nf = json.loads(json.dumps(f)); nf["properties"]["id"] += f"_{i}"
                    nf["geometry"] = mapping(part); kept.append(nf)
            elif inter.geom_type == "LineString":
                f["geometry"] = mapping(inter); kept.append(f)
        elif g.geom_type == "Point" and area.contains(g):
            kept.append(f)
    fc["features"] = kept
    return fc


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input")
    ap.add_argument("--perimeter", nargs="+",
                    default=["way/111289083", "way/189140719"],
                    help="osm_id del perímetro UNT (+ CEPUNT). Usa 'none' para no recortar.")
    a = ap.parse_args()
    data = json.loads(Path(a.input).read_text(encoding="utf-8")) if a.input else fetch()
    curation = json.loads(CURATION.read_text(encoding="utf-8")) if CURATION.exists() else {}
    fc = build(data, curation)
    if a.perimeter != ["none"]:
        names = curation.get("include_names", ["CEPUNT", "CIDUNT", "Centro de Idiomas", r"\bRNC\b", r"Narv[aá]ez"])
        fc = clip_to_campus(fc, set(a.perimeter), names)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(fc, ensure_ascii=False, indent=1), encoding="utf-8")
    cats = {}
    for f in fc["features"]:
        c = f["properties"]["category"]; cats[c] = cats.get(c, 0) + 1
    print("Escrito", OUT, cats)


if __name__ == "__main__":
    main()
