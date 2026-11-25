"""Condiciones externas declaradas (calle inundada sí/no, quebrada activa sí/no).

No hay cálculo de flujo: un catálogo de condiciones y una tabla de reglas.
Una regla se activa cuando TODAS las condiciones de su campo "si" están activas.
Todas las reglas activadas se combinan (se suman puntajes, se unen zonas y listas).
"""
import json
from dataclasses import dataclass, field
from typing import Any

from app.config import DATA_DIR

CONDITIONS_PATH = DATA_DIR / "condiciones_externas.json"
EVIDENCE_PATH = DATA_DIR / "evidencia_inundacion.json"
HAZARD_ZONE_ID = "condiciones_externas"


@dataclass
class ResolvedConditions:
    active: list[str] = field(default_factory=list)
    fired_rules: list[dict[str, Any]] = field(default_factory=list)
    zone_ids: list[str] = field(default_factory=list)
    reach_m: float = 0.0
    watch_events: list[dict[str, Any]] = field(default_factory=list)  # eventos de evidencia a vigilar
    score: int = 0


def load_conditions_catalog() -> dict[str, Any]:
    return json.loads(CONDITIONS_PATH.read_text(encoding="utf-8"))


def load_evidence() -> dict[str, dict[str, Any]]:
    data = json.loads(EVIDENCE_PATH.read_text(encoding="utf-8"))
    return {event["id"]: event for event in data["eventos"]}


def validate_condition_ids(ids: list[str]) -> list[str]:
    """Devuelve los ids sin duplicados, en orden estable. ValueError si alguno no existe."""
    known = {c["id"] for c in load_conditions_catalog()["conditions"]}
    unknown = sorted(set(ids) - known)
    if unknown:
        raise ValueError(
            f"Condición externa desconocida: {', '.join(unknown)}. Disponibles: {', '.join(sorted(known))}"
        )
    return list(dict.fromkeys(ids))


def resolve_conditions(ids: list[str]) -> ResolvedConditions:
    active = validate_condition_ids(ids)
    catalog = load_conditions_catalog()
    evidence = load_evidence()
    resolved = ResolvedConditions(active=active)
    names = {c["id"]: c["name"] for c in catalog["conditions"]}
    seen_events: set[str] = set()
    for rule in catalog["rules"]:
        if not set(rule["si"]) <= set(active):
            continue
        fired = {
            **rule,
            "condiciones_nombres": [names[c] for c in rule["si"]],
        }
        resolved.fired_rules.append(fired)
        resolved.score += int(rule["puntaje"])
        resolved.reach_m = max(resolved.reach_m, float(rule.get("reach_m", 0)))
        for zone_id in rule["zonas"]:
            if zone_id not in resolved.zone_ids:
                resolved.zone_ids.append(zone_id)
        for event_id in rule.get("vigilar", []):
            if event_id not in seen_events:
                seen_events.add(event_id)
                resolved.watch_events.append(evidence[event_id])
    return resolved
