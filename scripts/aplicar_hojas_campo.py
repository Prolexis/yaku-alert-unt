"""Aplica hoja_edificios_sin_nombre (.xlsx o .csv) a scripts/campus_curation.json.

Uso (desde la raíz del proyecto):
    python scripts/aplicar_hojas_campo.py scripts/hojas_campo/hoja_edificios_sin_nombre.xlsx
Luego: python scripts/build_campus_geojson.py   (regenera el mapa)

- Solo se aplican filas con osm_id y nombre_correcto no vacío.
- Los nombres quedan verified=false: los indicó el equipo, sin evidencia de campo.
  Para marcar verified=true, use --verificado n1,n2,... (números de la hoja con foto/documento).
- Es idempotente: volver a ejecutarlo actualiza, no duplica.
"""
import argparse, csv, json, re, sys
from pathlib import Path

CUR = Path(__file__).with_name("campus_curation.json")


def leer(path):
    p = Path(path)
    if p.suffix.lower() == ".xlsx":
        try:
            import openpyxl
        except ImportError:
            sys.exit("Falta openpyxl: pip install openpyxl  (o guarde la hoja como CSV UTF-8)")
        ws = openpyxl.load_workbook(p, read_only=True, data_only=True).worksheets[0]
        rows = list(ws.iter_rows(values_only=True))
        head = [str(h or "").strip() for h in rows[0]]
        return [dict(zip(head, r)) for r in rows[1:]]
    with open(p, encoding="utf-8-sig", newline="") as fh:
        txt = fh.read()
    delim = ";" if txt.split("\n", 1)[0].count(";") > txt.split("\n", 1)[0].count(",") else ","
    return list(csv.DictReader(txt.splitlines(), delimiter=delim))


def col(row, prefix):
    for k, v in row.items():
        if str(k).startswith(prefix):
            return v
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("hoja")
    ap.add_argument("--verificado", default="", help="n de filas con foto/documento, separados por coma")
    a = ap.parse_args()
    ver = {s.strip() for s in a.verificado.split(",") if s.strip()}
    cur = json.loads(CUR.read_text(encoding="utf-8"))
    ov = cur.setdefault("overrides", {})
    aplicados = 0
    for r in leer(a.hoja):
        oid = str(col(r, "osm_id") or "").strip()
        nombre = re.sub(r"\s+", " ", str(col(r, "nombre_correcto") or "")).strip()
        if not oid or not nombre or nombre.lower() == "none":
            continue
        n = str(col(r, "n") or "").strip().removesuffix(".0")
        v = n in ver
        o = {"name": nombre, "verified": v,
             "source": "Nombre confirmado con evidencia de campo" if v
             else "Nombre indicado por el equipo (sin verificación en campo); geometría OSM"}
        pisos = str(col(r, "pisos") or "").strip().removesuffix(".0")
        if pisos.isdigit():
            o["floors"] = int(pisos)
        ov.setdefault(oid, {}).update(o)
        aplicados += 1
    CUR.write_text(json.dumps(cur, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Nombres aplicados: {aplicados}. Ahora ejecute: python scripts/build_campus_geojson.py")


if __name__ == "__main__":
    main()
