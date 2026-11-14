#!/usr/bin/env python3
"""Analiza un DEM (Copernicus GLO-30) sobre el campus UNT.

Paso 1 (informe, no escribe escenarios):
    pip install shapely numpy   (NO requiere rasterio/GDAL)
    python scripts/analyze_dem.py --dem scripts/dem/Copernicus_DSM_COG_10_S09_00_W080_00_DEM.tif

Paso 2 (genera backend/app/data/hazard_scenarios.geojson a partir del relieve):
    python scripts/analyze_dem.py --dem <tif> --write-scenarios

Método (experimental, NO validado): zonas "de cota relativamente baja" dentro del campus,
definidas por percentiles de elevación (A: p15, B: p30, C: p50). No modela lluvia, drenaje
urbano ni flujo hidráulico. Si el relieve del campus es menor que el error vertical del DEM,
el script lo advierte y se niega a escribir escenarios salvo --force.
"""
import argparse, json, struct, sys, zlib
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import shape, mapping, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
CAMPUS = ROOT / "backend" / "app" / "data" / "campus_unt.geojson"
HAZARDS = ROOT / "backend" / "app" / "data" / "hazard_scenarios.geojson"
REPORT = ROOT / "backend" / "app" / "data" / "dem_report.json"

MARGIN_DEG = 0.003      # ~330 m de contexto alrededor del campus
UPSAMPLE = 6            # 30 m -> ~5 m (solo para contornos suaves; no añade información)
VERT_ERROR_M = 4.0      # error vertical absoluto declarado (LE90) de Copernicus GLO-30
MIN_AREA_M2 = 150.0
M2_PER_DEG2 = 1.2e10    # aprox. a 8° S

SCENARIOS = [
    ("lluvia_moderada", 15, "moderado", "anegamiento_pluvial_simulado",
     "Zona Experimental A — Cota relativamente baja (p15)"),
    ("lluvia_intensa_fen", 30, "alto", "escorrentia_pluvial_simulada",
     "Zona Experimental B — Cota relativamente baja (p30)"),
    ("escenario_extremo_fen", 50, "muy_alto", "inundacion_pluvial_simulada",
     "Zona Experimental C — Cota relativamente baja (p50)"),
]


# ---------------------------------------------------------------------------
# Lector mínimo de GeoTIFF/COG (solo numpy + zlib). Evita rasterio/GDAL, cuyas
# DLL suelen ser bloqueadas por el control de aplicaciones de Windows.
# Soporta: TIFF clásico y BigTIFF, tiles o franjas, sin compresión o Deflate,
# predictor 1/2/3, float32/int16/uint16/int32.
# ---------------------------------------------------------------------------
_TYPES = {1: ("B", 1), 2: ("c", 1), 3: ("H", 2), 4: ("I", 4), 5: ("II", 8), 6: ("b", 1),
          8: ("h", 2), 9: ("i", 4), 11: ("f", 4), 12: ("d", 8), 16: ("Q", 8), 17: ("q", 8)}


def _read_tags(f, end, big):
    if big:
        f.seek(8)
        off = struct.unpack(end + "Q", f.read(8))[0]
    else:
        f.seek(4)
        off = struct.unpack(end + "I", f.read(4))[0]
    f.seek(off)
    n = struct.unpack(end + ("Q" if big else "H"), f.read(8 if big else 2))[0]
    esz = 20 if big else 12
    raw = f.read(n * esz)
    tags = {}
    for i in range(n):
        e = raw[i * esz:(i + 1) * esz]
        if big:
            tag, typ, cnt = struct.unpack(end + "HHQ", e[:12]); vfield = e[12:20]; lim = 8
        else:
            tag, typ, cnt = struct.unpack(end + "HHI", e[:8]); vfield = e[8:12]; lim = 4
        if typ not in _TYPES:
            continue
        fmt, sz = _TYPES[typ]
        total = sz * cnt
        if total <= lim:
            data = vfield[:total]
        else:
            ptr = struct.unpack(end + ("Q" if big else "I"), vfield)[0]
            pos = f.tell(); f.seek(ptr); data = f.read(total); f.seek(pos)
        if typ == 2:
            tags[tag] = data.rstrip(b"\x00").decode("latin-1")
        elif typ in (5,):
            tags[tag] = struct.unpack(end + fmt[0] * (2 * cnt), data)
        else:
            tags[tag] = struct.unpack(end + fmt * cnt, data)
    return tags


def read_geotiff_window(path, minx, miny, maxx, maxy):
    """Devuelve (arr[filas arriba->abajo], x0, y0, dx, dy): x0/y0 = esquina sup. izq. del píxel [0,0]."""
    with open(path, "rb") as f:
        bo = f.read(2)
        end = "<" if bo == b"II" else ">"
        magic = struct.unpack(end + "H", f.read(2))[0]
        big = magic == 43
        if magic not in (42, 43):
            raise ValueError("No es un TIFF válido (¿descarga incompleta?)")
        t = _read_tags(f, end, big)
        W, H = t[256][0], t[257][0]
        comp = t.get(259, (1,))[0]
        pred = t.get(317, (1,))[0]
        spp = t.get(277, (1,))[0]
        bits = t.get(258, (32,))[0]
        sfmt = t.get(339, (1,))[0]
        if spp != 1:
            raise ValueError("Se esperaba un DEM de una sola banda")
        dt = {(32, 3): "f4", (16, 1): "u2", (16, 2): "i2", (32, 2): "i4", (32, 1): "u4", (64, 3): "f8"}[(bits, sfmt)]
        bps = bits // 8
        if 322 in t:
            tw, tl = t[322][0], t[323][0]; offs, cnts = t[324], t[325]
        else:
            tw, tl = W, t[278][0]; offs, cnts = t[273], t[279]
        sx, sy = t[33550][0], t[33550][1]
        tp = t[33922]
        x_left, y_top = tp[3] - tp[0] * sx, tp[4] + tp[1] * sy
        nodata = float(t[42113]) if 42113 in t else None

        c0 = max(0, int(np.floor((minx - x_left) / sx))); c1 = min(W, int(np.ceil((maxx - x_left) / sx)))
        r0 = max(0, int(np.floor((y_top - maxy) / sy))); r1 = min(H, int(np.ceil((y_top - miny) / sy)))
        if c1 <= c0 or r1 <= r0:
            raise ValueError("La zona del campus queda fuera de este DEM. Se necesita el tile S09 W080.")
        out = np.empty((r1 - r0, c1 - c0), dtype="f8")
        tiles_x = (W + tw - 1) // tw
        for ty in range(r0 // tl, (r1 - 1) // tl + 1):
            for tx in range(c0 // tw, (c1 - 1) // tw + 1):
                idx = ty * tiles_x + tx
                f.seek(offs[idx]); raw = f.read(cnts[idx])
                if comp in (8, 32946):
                    raw = zlib.decompress(raw)
                elif comp != 1:
                    raise ValueError(f"Compresión TIFF {comp} no soportada (use Deflate o sin compresión)")
                rows = np.frombuffer(raw, dtype="u1")
                rows = rows[: tl * tw * bps].reshape(tl, tw * bps)
                if pred == 3:   # predictor de coma flotante
                    acc = np.cumsum(rows, axis=1, dtype=np.uint8)
                    planes = acc.reshape(tl, bps, tw)            # planos de bytes, MSB primero
                    arr = np.ascontiguousarray(planes[:, ::-1, :].transpose(0, 2, 1)).view("<" + dt).reshape(tl, tw)
                elif pred == 2:  # diferencia horizontal entera
                    arr = np.cumsum(np.frombuffer(raw, dtype=end + dt)[: tl * tw].reshape(tl, tw), axis=1)
                else:
                    arr = np.frombuffer(raw, dtype=end + dt)[: tl * tw].reshape(tl, tw)
                ra, rb = max(r0, ty * tl), min(r1, (ty + 1) * tl)
                ca, cb = max(c0, tx * tw), min(c1, (tx + 1) * tw)
                out[ra - r0:rb - r0, ca - c0:cb - c0] = arr[ra - ty * tl:rb - ty * tl, ca - tx * tw:cb - tx * tw]
    if nodata is not None:
        out[out == nodata] = np.nan
    return out, x_left + c0 * sx, y_top - r0 * sy, sx, sy


def upsample_bilinear(a, f):
    """Interpolación bilineal separable (numpy puro)."""
    h, w = a.shape
    yi = np.linspace(0, h - 1, h * f); xi = np.linspace(0, w - 1, w * f)
    tmp = np.array([np.interp(xi, np.arange(w), row) for row in a])
    return np.array([np.interp(yi, np.arange(h), col) for col in tmp.T]).T


def rasterize(geom, ny, nx, x0, y0, dx, dy):
    """Máscara de píxeles cuyo centro cae dentro de geom."""
    xs = x0 + (np.arange(nx) + 0.5) * dx
    ys = y0 - (np.arange(ny) + 0.5) * dy
    X, Y = np.meshgrid(xs, ys)
    return shapely.contains_xy(geom, X, Y)


def building_cover(shape2d, x0, y0, dx, dy, bgeom, sub=5):
    """Fracción (0-1) de cada píxel cubierta por edificios (muestreo sub x sub)."""
    ny, nx = shape2d
    xs = x0 + (np.arange(nx * sub) + 0.5) * dx / sub
    ys = y0 - (np.arange(ny * sub) + 0.5) * dy / sub
    X, Y = np.meshgrid(xs, ys)
    return shapely.contains_xy(bgeom, X, Y).reshape(ny, sub, nx, sub).mean(axis=(1, 3))


def fill_nan(a, iters=200):
    """Rellena NaN con el promedio de vecinos válidos (numpy puro)."""
    import warnings
    a = a.copy()
    for _ in range(iters):
        nan = np.isnan(a)
        if not nan.any():
            break
        p = np.pad(a, 1, constant_values=np.nan)
        st = np.stack([p[i:i + a.shape[0], j:j + a.shape[1]] for i in range(3) for j in range(3)])
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            m = np.nanmean(st, axis=0)
        a[nan] = m[nan]
    return a


def mask_to_polygons(mask, x0, y0, dx, dy):
    """Une corridas horizontales de píxeles True en rectángulos y los fusiona."""
    boxes = []
    for r in range(mask.shape[0]):
        row = np.concatenate([[0], mask[r].astype(np.int8), [0]])
        d = np.diff(row)
        for s, e in zip(np.where(d == 1)[0], np.where(d == -1)[0]):
            boxes.append(box(x0 + s * dx, y0 - (r + 1) * dy, x0 + e * dx, y0 - r * dy))
    return unary_union(boxes) if boxes else None


def campus_geometry():
    d = json.loads(CAMPUS.read_text(encoding="utf-8"))
    polys = [shape(f["geometry"]) for f in d["features"]
             if f["properties"].get("category") == "perimetro_campus"]
    if not polys:
        sys.exit("campus_unt.geojson no tiene perímetro. Ejecuta antes build_campus_geojson.py")
    blds = [shape(f["geometry"]) for f in d["features"] if f["properties"].get("category") == "edificio"]
    return unary_union(polys), (unary_union(blds) if blds else None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dem", required=True)
    ap.add_argument("--write-scenarios", action="store_true")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    campus, bgeom = campus_geometry()
    minx, miny, maxx, maxy = campus.bounds
    try:
        dem, x0, y0, dx, dy = read_geotiff_window(a.dem, minx - MARGIN_DEG, miny - MARGIN_DEG,
                                                  maxx + MARGIN_DEG, maxy + MARGIN_DEG)[:5]
    except (ValueError, KeyError, zlib.error) as exc:
        sys.exit(f"No pude leer el DEM: {exc}")
    res_x_m = dx * 111320 * np.cos(np.radians((miny + maxy) / 2))
    res_y_m = dy * 110574
    crs = "EPSG:4326 (WGS84)"
    if np.isnan(dem).all():
        sys.exit("La ventana del DEM está vacía: ¿el archivo cubre lat -8.11, lon -79.04? (tile S09 W080)")
    dem = np.where(np.isnan(dem), np.nanmedian(dem), dem)

    # --- relieve en la malla nativa (30 m) dentro del campus (con ~15 m de tolerancia de borde)
    nmask = rasterize(campus.buffer(0.00014), *dem.shape, x0, y0, dx, dy)
    dsm_native = dem[nmask]
    relief_dsm = float(np.percentile(dsm_native, 95) - np.percentile(dsm_native, 5))

    # --- el GLO-30 es un DSM: incluye edificios y árboles. Se mide el sesgo y se enmascara lo edificado.
    built_diff = None
    n_built = n_open = 0
    if bgeom is not None:
        cover = building_cover(dem.shape, x0, y0, dx, dy, bgeom)
        built = cover >= 0.40
        opened = (cover < 0.10) & nmask
        n_built, n_open = int((built & nmask).sum()), int(opened.sum())
        if n_built >= 5 and n_open >= 5:
            # compara contra el entorno inmediato para no confundirlo con la pendiente regional
            built_diff = float(dem[built & nmask].mean() - dem[opened].mean())
        dem = fill_nan(np.where(built, np.nan, dem))
    native = dem[nmask]
    gy, gx = np.gradient(dem, res_y_m, res_x_m)
    slope_pct = np.hypot(gx, gy) * 100
    # dirección hacia donde baja el terreno (azimut desde el norte, horario); filas crecen hacia el sur
    mgx, mgy = gx[nmask].mean(), gy[nmask].mean()
    down_az = np.degrees(np.arctan2(-mgx, mgy)) % 360

    p5, p50, p95 = np.percentile(native, [5, 50, 95])
    relief = float(p95 - p5)
    reliable = relief >= VERT_ERROR_M
    report = {
        "dem": Path(a.dem).name, "crs": crs,
        "resolucion_m": [round(res_x_m, 1), round(res_y_m, 1)],
        "pixeles_nativos_en_campus": int(nmask.sum()),
        "elevacion_m": {"min": round(float(native.min()), 2), "p5": round(float(p5), 2),
                        "mediana": round(float(p50), 2), "p95": round(float(p95), 2),
                        "max": round(float(native.max()), 2)},
        "relieve_p95_p5_m": round(relief, 2),
        "relieve_dsm_con_edificios_m": round(relief_dsm, 2),
        "pixeles_edificados_enmascarados": n_built,
        "pixeles_abiertos": n_open,
        "diferencia_media_edificado_vs_abierto_m": None if built_diff is None else round(built_diff, 2),
        "pendiente_media_pct_campus": round(float(slope_pct[nmask].mean()), 2),
        "pendiente_media_pct_contexto": round(float(slope_pct.mean()), 2),
        "azimut_descenso_deg": round(float(down_az), 0),
        "error_vertical_declarado_m": VERT_ERROR_M,
        "relieve_supera_error_vertical": bool(reliable),
        "advertencia": ("El relieve dentro del campus es MENOR que el error vertical del DEM: "
                        "no sustenta afirmaciones de acumulación de agua a escala de edificio."
                        if not reliable else
                        "El relieve supera el error vertical, pero con píxeles de ~30 m solo permite "
                        "hablar de tendencias (sectores relativamente bajos), no de charcos puntuales."),
        "nota_dsm": "Copernicus GLO-30 es un modelo de superficie (DSM): incluye copas de árboles y edificios. Los píxeles con >=40% de edificios se enmascaran y rellenan por vecindad; los árboles no se pueden separar.",
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n=== INFORME DEM — campus UNT ===")
    print(f"Resolución: ~{res_x_m:.0f} m | píxeles dentro del campus: {report['pixeles_nativos_en_campus']}")
    e = report["elevacion_m"]
    print(f"Elevación (m s.n.m.): min {e['min']} | p5 {e['p5']} | mediana {e['mediana']} | p95 {e['p95']} | max {e['max']}")
    print(f"Relieve p95-p5 con edificios (DSM crudo): {relief_dsm:.1f} m")
    print(f"Relieve p95-p5 SIN píxeles edificados:    {relief:.1f} m  (error vertical declarado ±{VERT_ERROR_M} m)")
    if built_diff is not None:
        print(f"Píxeles edificados {n_built} vs abiertos {n_open}: los edificados salen {built_diff:+.1f} m más altos en promedio"
              + ("  <- el DSM está contaminado por edificios" if built_diff > 2 else ""))
    print(f"Pendiente media: {report['pendiente_media_pct_campus']} % | el terreno desciende hacia azimut ~{down_az:.0f}° (0=N, 90=E, 180=S, 270=O)")
    print("->", report["advertencia"])
    print("Informe guardado en", REPORT)

    if not a.write_scenarios:
        print("\n(Sin --write-scenarios: no se tocó hazard_scenarios.geojson)")
        return
    if not reliable and not a.force:
        sys.exit("\nNO se generaron escenarios: el relieve no supera el error del DEM. "
                 "Usa --force solo si lo declararás explícitamente así, o usa marcación local (opción B).")

    # --- escenarios: cota relativamente baja (percentiles), contornos suavizados
    up = upsample_bilinear(dem, UPSAMPLE)
    udx, udy = dx / UPSAMPLE, dy / UPSAMPLE
    cmask = rasterize(campus, *up.shape, x0, y0, udx, udy)
    feats = []
    for sid, pct, sev, htype, name in SCENARIOS:
        thr = float(np.percentile(up[cmask], pct))
        poly = mask_to_polygons((up <= thr) & cmask, x0, y0, udx, udy)
        if poly is None:
            sys.exit(f"Escenario {sid}: sin áreas. Relieve insuficiente.")
        parts = [p for p in (poly.geoms if hasattr(poly, "geoms") else [poly])
                 if p.area * M2_PER_DEG2 >= MIN_AREA_M2]
        if not parts:
            sys.exit(f"Escenario {sid}: sin áreas > {MIN_AREA_M2:.0f} m². Relieve insuficiente.")
        geom = unary_union([p.simplify(5e-6) for p in parts]).intersection(campus)
        feats.append({"type": "Feature", "geometry": mapping(geom), "properties": {
            "scenario_id": sid, "zone_name": name, "hazard_type": htype, "severity": sev,
            "description": (f"Sectores del campus con cota por debajo del percentil {pct} (≤ {thr:.1f} m s.n.m., "
                            "DEM Copernicus GLO-30). Estimación experimental de relieve relativo; "
                            "no modela lluvia ni drenaje y no está validada."),
            "data_nature": "sintetico_experimental_dem", "method": f"percentil_{pct}_elevacion_DEM",
            "threshold_m": round(thr, 2)}})
    out = {"type": "FeatureCollection",
           "metadata": {"data_nature": "sintetico_experimental_dem",
                        "source": "Copernicus GLO-30 DEM (ESA/Copernicus), análisis propio",
                        "disclaimer": ("Zonas EXPERIMENTALES de cota relativamente baja derivadas de un DEM de 30 m. "
                                       "No son un estudio hidrológico ni reemplazan mapas de CENEPRED/SIGRID/INDECI.")},
           "features": feats}
    HAZARDS.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print("Escenarios escritos en", HAZARDS)


if __name__ == "__main__":
    main()
