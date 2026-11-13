import json
from typing import Optional

from app.config import PROTOCOLS_JSON_PATH
from app.models import (
    PreventiveEvaluation,
    RuleTrigger,
    SpatialAnalysisResult,
    WeatherResponse,
)


def load_protocols() -> dict:
    with PROTOCOLS_JSON_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def evaluate_preventive_rules(
    *,
    max_intensity_mm_h: float,
    accumulated_mm: float,
    duration_hours: int,
    drainage_obstructed: bool,
    antecedent_soil_saturated: bool,
    spatial: Optional[SpatialAnalysisResult],
    is_synthetic: bool,
    weather_meta: Optional[WeatherResponse] = None,
) -> PreventiveEvaluation:
    """
    Motor de reglas transparentes y explicables (TRL 3-4).
    Distingue explícitamente peligro meteorológico, exposición espacial y orientación preventiva.
    """
    protocols = load_protocols()
    levels_map = {item["level"]: item for item in protocols["preventive_levels"]}

    rules: list[RuleTrigger] = []
    score = 0

    # Regla 1: Intensidad horaria máxima (umbrales experimentales de demostración)
    if max_intensity_mm_h >= 30.0:
        score += 3
        rules.append(
            RuleTrigger(
                rule_id="R-MET-01",
                description="Intensidad horaria muy elevada en escenario/pronóstico",
                observed_value=f"{max_intensity_mm_h:.1f} mm/h",
                threshold_note="Umbral experimental >= 30.0 mm/h (no validado hidrológicamente en campus)",
            )
        )
    elif max_intensity_mm_h >= 10.0:
        score += 2
        rules.append(
            RuleTrigger(
                rule_id="R-MET-02",
                description="Intensidad horaria moderada-fuerte",
                observed_value=f"{max_intensity_mm_h:.1f} mm/h",
                threshold_note="Umbral experimental 10.0–29.9 mm/h",
            )
        )
    elif max_intensity_mm_h >= 2.0:
        score += 1
        rules.append(
            RuleTrigger(
                rule_id="R-MET-03",
                description="Lluvia ligera detectada",
                observed_value=f"{max_intensity_mm_h:.1f} mm/h",
                threshold_note="Umbral experimental 2.0–9.9 mm/h",
            )
        )
    else:
        rules.append(
            RuleTrigger(
                rule_id="R-MET-00",
                description="Sin precipitación significativa prevista",
                observed_value=f"{max_intensity_mm_h:.1f} mm/h",
                threshold_note="Umbral experimental < 2.0 mm/h",
            )
        )

    # Regla 2: Acumulado en ventana analizada
    if accumulated_mm >= 60.0:
        score += 3
        rules.append(
            RuleTrigger(
                rule_id="R-ACU-01",
                description="Acumulado elevado en el evento",
                observed_value=f"{accumulated_mm:.1f} mm en {duration_hours}h",
                threshold_note="Umbral experimental >= 60.0 mm",
            )
        )
    elif accumulated_mm >= 20.0:
        score += 2
        rules.append(
            RuleTrigger(
                rule_id="R-ACU-02",
                description="Acumulado moderado en el evento",
                observed_value=f"{accumulated_mm:.1f} mm en {duration_hours}h",
                threshold_note="Umbral experimental 20.0–59.9 mm",
            )
        )

    # Regla 3: Condiciones agravantes locales
    if drainage_obstructed:
        score += 1
        rules.append(
            RuleTrigger(
                rule_id="R-COND-01",
                description="Condición de drenaje pluvial obstruido considerada",
                observed_value="Sí (parámetro de escenario)",
                threshold_note="Incrementa probabilidad de anegamiento superficial local",
            )
        )

    if antecedent_soil_saturated:
        score += 1
        rules.append(
            RuleTrigger(
                rule_id="R-COND-02",
                description="Suelo/superficie con saturación previa",
                observed_value="Sí (parámetro de escenario)",
                threshold_note="Reduce infiltración y acelera escorrentía superficial",
            )
        )

    # Regla 4: Exposición espacial calculada con Shapely
    exposed_count = spatial.total_exposed_buildings if spatial else 0
    restricted_acc = spatial.total_restricted_accesses if spatial else 0
    if exposed_count >= 3 or restricted_acc >= 2:
        score += 2
        rules.append(
            RuleTrigger(
                rule_id="R-ESP-01",
                description="Múltiples edificaciones o accesos intersectan zona de peligro",
                observed_value=f"{exposed_count} edificios, {restricted_acc} accesos",
                threshold_note="Calculado geométricamente con Shapely",
            )
        )
    elif exposed_count >= 1 or restricted_acc >= 1:
        score += 1
        rules.append(
            RuleTrigger(
                rule_id="R-ESP-02",
                description="Exposición espacial localizada en el campus",
                observed_value=f"{exposed_count} edificios, {restricted_acc} accesos",
                threshold_note="Calculado geométricamente con Shapely",
            )
        )

    # Mapeo transparente de puntaje experimental a nivel preventivo
    if score >= 7:
        level_key = "PREPARACION_CRITICA"
    elif score >= 4:
        level_key = "ATENCION_PREVENTIVA"
    elif score >= 2:
        level_key = "VIGILANCIA_PREVENTIVA"
    else:
        level_key = "INFORMATIVO"

    level_info = levels_map[level_key]

    hazard_text = (
        f"Peligro meteorológico {'simulado' if is_synthetic else 'pronosticado'}: "
        f"intensidad máxima {max_intensity_mm_h:.1f} mm/h, acumulado {accumulated_mm:.1f} mm."
    )
    if spatial:
        exposure_text = (
            f"Exposición espacial (Shapely): {exposed_count} edificaciones y {restricted_acc} accesos "
            f"intersectan '{spatial.hazard_zone_name}'."
        )
    else:
        exposure_text = (
            "Sin escenario espacial activo; la evaluación refleja únicamente el pronóstico meteorológico."
        )

    sources: list[str] = []
    if weather_meta is not None:
        sources.append(
            f"Meteorología: {weather_meta.source_name} | Estado: {weather_meta.data_status} | Actualizado: {weather_meta.fetched_at_utc}"
        )
    else:
        sources.append("Meteorología: Parámetros sintéticos ingresados en el simulador offline.")
    sources.append("Geografía: GeoJSON referencial UNT + escenarios sintéticos procesados con Shapely 2.x.")

    return PreventiveEvaluation(
        is_synthetic=is_synthetic,
        data_nature="ESCENARIO_SIMULADO_SINTETICO" if is_synthetic else "EVALUACION_SOBRE_PRONOSTICO_REAL",
        preventive_level=level_key,  # type: ignore[arg-type]
        level_label=level_info["label"],
        level_color=level_info["color"],
        hazard_assessment=hazard_text,
        exposure_assessment=exposure_text,
        risk_distinction_note=(
            "Peligro = intensidad/acumulado de lluvia o escorrentía; "
            "Exposición = infraestructura UNT dentro del área analizada; "
            "Estado preventivo = orientación experimental basada en reglas. "
            "No se convierte la probabilidad de lluvia en probabilidad de huaico."
        ),
        rules_triggered=rules,
        guidance=level_info["guidance"],
        academic_continuity=level_info["continuity"],
        sources_and_timestamps=sources,
        uncertainty_and_limits=[
            "Los umbrales de precipitación son experimentales de demostración (TRL 3-4) y requieren calibración hidrológica local.",
            "No existen sensores en tiempo real conectados en campus ni en las quebradas de Trujillo en este MVP.",
            "Las rutas y puntos de encuentro mostrados son referenciales y no garantizan seguridad operativa.",
        ],
        legal_disclaimer=(
            "Cumplimiento Ley N.° 29664 (SINAGERD) y D.S. N.° 048-2011-PCM: "
            "este aviso es informativo/preventivo y no reemplaza las alertas ni decisiones de Defensa Civil UNT, SENAMHI, COEN o INDECI."
        ),
    )
