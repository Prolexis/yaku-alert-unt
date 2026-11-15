#!/usr/bin/env python3
"""Genera dos hojas CSV para completar datos del campus UNT en una visita de campo.

    python scripts/generar_hojas_campo.py

Salidas (en scripts/hojas_campo/), se abren con Excel o Google Sheets:
  1) hoja_puntos_candidatos.csv  -> espacios abiertos que se CONFIRMAN o descartan en el sitio,
     ordenados por una prioridad de visita con reglas explícitas (ver PRIORIDAD abajo).
  2) hoja_edificios_sin_nombre.csv -> edificios sin nombre, numerados por tamaño.
  3) mapa_etiquetado.html -> mapa sin internet con esos edificios numerados, para nombrarlos mirando Google Maps.

PRIORIDAD de visita (criterio del equipo de software, NO una norma ni una evaluación de seguridad):
  1 = área >= 2000 m2, 0 % dentro de las zonas A, B y C y a >= 40 m de las zonas reportadas
  2 = área >= 500 m2, 0 % dentro de A y B y a >= 20 m de las zonas reportadas
  X = >= 25 % dentro de la zona A (no conviene como candidato)
  3 = el resto

IMPORTANTE: un espacio abierto NO es un punto de encuentro hasta que se confirme (señalización
oficial, indicación de Defensa Civil UNT o criterio documentado). Aquí solo se proponen candidatos.
"""
import csv, json, math, sys
from pathlib import Path

from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "backend" / "app" / "data"
OUT = Path(__file__).with_name("hojas_campo")
KX, KY = 111320 * math.cos(math.radians(-8.114)), 110574
MIN_OPEN_M2, MIN_BLD_M2 = 400, 120


def area_m2(g):
    return g.area * KX * KY


def priority(area, a, b, dist_rep):
    """a, b = % dentro de A y B; c = % dentro de C no excluye pero baja la prioridad."""
    if a >= 25:
        return "X", "≥25% dentro de la zona A"
    if area >= 2000 and a == 0 and b == 0 and dist_rep >= 40:
        return "1", "grande, fuera de A y B, lejos de zonas reportadas"
    if area >= 500 and a == 0 and b == 0 and dist_rep >= 20:
        return "2", "fuera de A y B"
    return "3", "dentro de B o cerca de zona reportada o pequeño"


def maps(lat, lon):
    return f"https://www.google.com/maps?q={lat:.6f},{lon:.6f}"


def write_label_map(campus, brows, path):
    """Mapa SVG sin internet: edificios nombrados (texto) y sin nombre (número rojo)."""
    from html import escape
    num = {r[1]: r[0] for r in brows}
    pts = []
    for f in campus:
        if f["properties"]["category"] in ("edificio", "perimetro_campus"):
            for x, y in shape(f["geometry"]).exterior.coords:
                pts.append((x, y))
    minx, maxx = min(p[0] for p in pts), max(p[0] for p in pts)
    miny, maxy = min(p[1] for p in pts), max(p[1] for p in pts)
    S = 4.0  # px por metro
    W, H = (maxx - minx) * KX * S, (maxy - miny) * KY * S
    def px(x, y):
        return (x - minx) * KX * S + 20, (maxy - y) * KY * S + 20
    parts = []
    for f in campus:
        p, g = f["properties"], shape(f["geometry"])
        if p["category"] == "perimetro_campus":
            d = " ".join(("M" if i == 0 else "L") + "%.1f,%.1f" % px(x, y) for i, (x, y) in enumerate(g.exterior.coords))
            parts.append(f'<path d="{d}Z" fill="#F8FAFC" stroke="#0B1F33" stroke-dasharray="6 5" stroke-width="2"/>')
    for f in campus:
        p, g = f["properties"], shape(f["geometry"])
        if p["category"] in ("area_verde", "area_deportiva", "estacionamiento"):
            col = {"area_verde": "#DCFCE7", "area_deportiva": "#BBF7D0", "estacionamiento": "#E2E8F0"}[p["category"]]
            d = " ".join(("M" if i == 0 else "L") + "%.1f,%.1f" % px(x, y) for i, (x, y) in enumerate(g.exterior.coords))
            parts.append(f'<path d="{d}Z" fill="{col}" stroke="none"/>')
    for f in campus:
        p, g = f["properties"], shape(f["geometry"])
        if p["category"] != "edificio":
            continue
        d = " ".join(("M" if i == 0 else "L") + "%.1f,%.1f" % px(x, y) for i, (x, y) in enumerate(g.exterior.coords))
        n = num.get(p["osm_id"])
        c = g.centroid
        cx, cy = px(c.x, c.y)
        if n:
            parts.append(f'<path d="{d}Z" fill="#FECACA" stroke="#B91C1C" stroke-width="1.5"/>')
            parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="24" fill="#B91C1C"/>'
                         f'<text x="{cx:.1f}" y="{cy + 10:.1f}" text-anchor="middle" font-size="28" font-weight="700" fill="#fff">{n}</text>')
        else:
            named = not p["name"].startswith("Edificio sin nombre")
            parts.append(f'<path d="{d}Z" fill="{"#DBEAFE" if named else "#E2E8F0"}" stroke="#2563EB" stroke-width="1"/>')
            if named:
                parts.append(f'<text x="{cx:.1f}" y="{cy:.1f}" text-anchor="middle" font-size="17" fill="#1E3A8A">{escape(p["name"][:28])}</text>')
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W + 40:.0f} {H + 40:.0f}" style="width:100%;height:auto" font-family="Arial,sans-serif">{"".join(parts)}</svg>'
    lista = "".join(f"<li><b>{r[0]}</b> · {r[4]} m² · <a href=\"{r[5]}\" target=\"_blank\" rel=\"noopener\">ver en Google Maps</a></li>" for r in brows)
    path.write_text(f"""<!doctype html><meta charset="utf-8"><title>Mapa de etiquetado UNT</title>
<body style="font-family:Arial;margin:16px"><h2>Edificios sin nombre (números rojos)</h2>
<p>Escribe el nombre de cada número en <b>hoja_edificios_sin_nombre.csv</b>. Los edificios azules ya tienen nombre (OSM). Funciona sin internet.</p>
<div style="overflow:auto;border:1px solid #ccc">{svg}</div><ol style="columns:2">{lista}</ol></body>""", encoding="utf-8")


def main():
    campus = json.loads((DATA / "campus_unt.geojson").read_text(encoding="utf-8"))["features"]
    hz = {}
    hp = DATA / "hazard_scenarios.geojson"
    if hp.exists():
        for f in json.loads(hp.read_text(encoding="utf-8"))["features"]:
            hz[f["properties"]["scenario_id"]] = shape(f["geometry"])
    OUT.mkdir(exist_ok=True)

    def expo(g):
        res = []
        for sid in ("lluvia_moderada", "lluvia_intensa_fen", "escenario_extremo_fen"):
            h = hz.get(sid)
            pct = round(h.intersection(g).area / g.area * 100) if h is not None and g.area else 0
            res.append(f"{pct}%")
        return res

    from shapely.ops import unary_union
    rep_geoms = [shape(f["geometry"]) for f in campus if f["properties"]["category"] == "zona_reportada"]
    rep_union = unary_union(rep_geoms) if rep_geoms else None

    def dist_rep_m(g):
        return round(g.distance(rep_union) * 111000) if rep_union is not None else 999

    # --- 1) puntos candidatos
    rows = []
    for f in campus:
        p = f["properties"]
        if p["category"] not in ("area_deportiva", "area_verde"):
            continue
        g = shape(f["geometry"])
        a = area_m2(g)
        if a < MIN_OPEN_M2:
            continue
        c = g.centroid
        ex = expo(g)
        pa, pb = int(ex[0].rstrip("%")), int(ex[1].rstrip("%"))
        dr = dist_rep_m(g)
        pr, why = priority(a, pa, pb, dr)
        rows.append([pr, why, p["id"], "Área verde" if p["category"] == "area_verde" else "Área deportiva",
                     p.get("name", ""), f"{c.y:.6f}", f"{c.x:.6f}", round(a), *ex, dr, maps(c.y, c.x),
                     "", "", "", "", "", ""])
    order = {"1": 0, "2": 1, "3": 2, "X": 3}
    rows.sort(key=lambda r: (order[r[0]], -r[7]))
    with open(OUT / "hoja_puntos_candidatos.csv", "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(["prioridad_visita", "motivo", "id", "tipo", "nombre_OSM", "lat", "lon", "area_m2",
                    "dentro_zona_A", "dentro_zona_B", "dentro_zona_C", "dist_m_a_zona_reportada", "ver_en_mapa",
                    "SEÑALIZADO_como_punto_de_encuentro (SI/NO)", "nombre_para_el_mapa",
                    "amplio_y_abierto (SI/NO)", "acceso_por_via_libre (SI/NO)", "foto (nombre de archivo)",
                    "observaciones"])
        w.writerows(rows)

    # --- 2) edificios sin nombre
    brows = []
    for f in campus:
        p = f["properties"]
        if p["category"] != "edificio" or not p["name"].startswith("Edificio sin nombre"):
            continue
        g = shape(f["geometry"])
        a = area_m2(g)
        if a < MIN_BLD_M2:
            continue
        c = g.centroid
        brows.append([0, p["osm_id"], f"{c.y:.6f}", f"{c.x:.6f}", round(a), maps(c.y, c.x), "", "", "", ""])
    brows.sort(key=lambda r: -r[4])
    for i, r in enumerate(brows, 1):
        r[0] = i
    with open(OUT / "hoja_edificios_sin_nombre.csv", "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(["n", "osm_id", "lat", "lon", "area_m2", "ver_en_mapa", "nombre_correcto",
                    "uso (aula/laboratorio/administrativo/biblioteca/servicios/caseta/otro)",
                    "pisos", "sotano (SI/NO/NO SE)"])
        w.writerows(brows)
    write_label_map(campus, brows, OUT / "mapa_etiquetado.html")
    print(f"Puntos candidatos: {len(rows)} | edificios sin nombre >= {MIN_BLD_M2} m2: {len(brows)}")
    print("Hojas en", OUT)


if __name__ == "__main__":
    main()
