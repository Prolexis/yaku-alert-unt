"""Mide cuanta evidencia real de inundacion cubre cada escenario.

Uso (desde la raiz del repo):
    python scripts/validar_escenarios.py
    python scripts/validar_escenarios.py --data-dir RUTA --evidencia RUTA/evidencia_inundacion.json

Que mide: RECALL (de los puntos con evidencia, cuantos caen en el escenario) y el
COSTO (que % del campus ocupa el escenario). Sin puntos donde NO se inundo no se
puede medir precision: el % de campus es solo un indicador del costo de ampliar.
Solo cuentan para el recall las evidencias con independiente=true.
"""
import argparse, json, math, sys
from pathlib import Path
import numpy as np
import shapely
from shapely.geometry import shape
from shapely.ops import unary_union

LAT0 = -8.114
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110574
UMBRAL_PCT = 5.0  # mismo umbral 'marginal' que spatial.py


def metros(g):
    return shapely.transform(g, lambda c: np.column_stack(((c[:, 0] + 79.0) * KX, (c[:, 1] - LAT0) * KY)))


def main():
    base = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default=str(base / "backend" / "app" / "data"))
    ap.add_argument("--evidencia", default=str(base / "backend" / "app" / "data" / "evidencia_inundacion.json"))
    a = ap.parse_args()
    d = Path(a.data_dir)
    campus = json.loads((d / "campus_unt.geojson").read_text(encoding="utf-8"))
    haz = json.loads((d / "hazard_scenarios.geojson").read_text(encoding="utf-8"))
    ev = json.loads(Path(a.evidencia).read_text(encoding="utf-8"))["eventos"]

    geom_por_id = {f["properties"]["id"]: metros(shape(f["geometry"])) for f in campus["features"]}
    perimetro = geom_por_id["perimetro_campus_111289083"]

    esc, sint = {}, []
    for f in haz["features"]:
        p = f["properties"]
        g = metros(shape(f["geometry"]))
        if p.get("kind") == "influencia_sintetica":
            if p["scenario_id"] == "escenario_extremo_fen":
                sint.append(g)
        else:
            esc[p["scenario_id"]] = g
    esc["C + influencia sintetica 80 m"] = unary_union([esc["escenario_extremo_fen"], *sint])
    nombres = {"lluvia_moderada": "A (DEM p15)", "lluvia_intensa_fen": "B (reportes)",
               "escenario_extremo_fen": "C (p30 + reportes)",
               "C + influencia sintetica 80 m": "C + sintetica 80 m"}

    print(f"{'evidencia':26}{'indep':>6}" + "".join(f"{nombres[k]:>20}" for k in esc))
    cuenta = {k: [0, 0] for k in esc}
    for e in ev:
        fila = f"{e['id'][:25]:26}{'si' if e['independiente'] else 'no':>6}"
        geos = [geom_por_id[i] for i in e["ref_ids"] if i in geom_por_id]
        for k, z in esc.items():
            if not geos:
                fila += f"{'sin ubicar':>20}"
                continue
            pct = max(g.intersection(z).area / g.area * 100 if g.area > 0 else (100.0 if g.intersects(z) else 0.0) for g in geos)
            dist = min(g.distance(z) for g in geos)
            fila += f"{(f'{pct:.0f}%' if pct > 0 else f'fuera ({dist:.0f} m)'):>20}"
            if e["independiente"]:
                cuenta[k][1] += 1
                cuenta[k][0] += pct >= UMBRAL_PCT
        print(fila)

    print("\nRESUMEN (solo evidencia independiente y ubicable)")
    for k, z in esc.items():
        ok, n = cuenta[k]
        costo = z.intersection(perimetro).area / perimetro.area * 100
        print(f"  {nombres[k]:22} recall {ok}/{n}   costo: {costo:.1f}% del campus")

    evaluar_condiciones(base, ev, geom_por_id, perimetro)


def evaluar_condiciones(base, ev, geom_por_id, perimetro):
    """Escenario D: cobertura según las condiciones declaradas. Usa el código y los datos de backend/app."""
    sys.path.insert(0, str(base / "backend"))
    try:
        from app.services.spatial import analyze_conditions_exposure
    except Exception as exc:  # backend no disponible: se omite, el resto del informe sigue valiendo
        print(f"\n(Escenario D omitido: no se pudo importar backend/app: {exc})")
        return
    combos = {
        "D: solo Av. Jesús de Nazareth": ["av_jesus_nazareth"],
        "D: Jesús de Nazareth + quebrada": ["av_jesus_nazareth", "quebrada_san_ildefonso"],
        "D: todas las condiciones": ["av_jesus_nazareth", "av_juan_pablo_ii", "quebrada_san_ildefonso"],
    }
    objetivo = [(e["id"], i) for e in ev if e["independiente"] for i in e["ref_ids"]
                if i in geom_por_id and i.startswith("bld_")]
    print("\nESCENARIO D (condiciones declaradas) — evidencia independiente y ubicable:", len(objetivo), "edificios")
    print(f"  {'caso':36}{'polígono':>10}{'+sintética':>12}{'+vigilar':>10}{'costo pol.':>12}{'costo pol.+sint.':>18}")
    for nombre, conds in combos.items():
        res, haz, sint = analyze_conditions_exposure(conds)
        pol = metros(shape(haz["geometry"]))
        sint_u = unary_union([metros(shape(f["geometry"])) for f in sint["features"]]) if sint else None
        vig = {w.id for w in res.watch_buildings}
        n_pol = n_sint = n_vig = 0
        for _, ref in objetivo:
            g = geom_por_id[ref]
            en_pol = g.area > 0 and g.intersection(pol).area / g.area * 100 >= UMBRAL_PCT
            en_sint = sint_u is not None and g.area > 0 and g.intersection(sint_u).area / g.area * 100 >= UMBRAL_PCT
            n_pol += en_pol
            n_sint += en_pol or en_sint
            n_vig += en_pol or en_sint or ref in vig
        c_pol = pol.intersection(perimetro).area / perimetro.area * 100
        c_ps = (unary_union([pol, sint_u]) if sint_u is not None else pol).intersection(perimetro).area / perimetro.area * 100
        t = len(objetivo)
        print(f"  {nombre:36}{f'{n_pol}/{t}':>10}{f'{n_sint}/{t}':>12}{f'{n_vig}/{t}':>10}{c_pol:>11.1f}%{c_ps:>17.1f}%")
    print("  (La lista 'vigilar' marca edificios con agua en eventos previos SIN agrandar el polígono; es calibración, no validación.)")


if __name__ == "__main__":
    main()
