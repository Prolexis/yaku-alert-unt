import json
import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import Optional

from app.config import PROTOCOLS_JSON_PATH
from app.models import (
    HydroActionWindow,
    HydroAffectedElement,
    HydroEvaluationSheet,
    HydroRoleGuidance,
    HydroRunResponse,
    PreventiveEvaluation,
    RuleTrigger,
    SpatialAnalysisResult,
    WeatherResponse,
)
from app.services.hydro import load_hydro_params


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
    external_rules: Optional[list[dict]] = None,
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
                threshold_note="Condición declarada del escenario; no modifica el polígono ni modela drenaje",
            )
        )

    if antecedent_soil_saturated:
        score += 1
        rules.append(
            RuleTrigger(
                rule_id="R-COND-02",
                description="Suelo/superficie con saturación previa",
                observed_value="Sí (parámetro de escenario)",
                threshold_note="Condición declarada del escenario; no modifica el polígono ni modela escorrentía",
            )
        )

    # Regla 3b: Condiciones externas declaradas por el usuario (calle/quebrada, sí/no)
    for ext in external_rules or []:
        score += int(ext["puntaje"])
        rules.append(
            RuleTrigger(
                rule_id=f"R-EXT-{ext['id']}",
                description=ext["descripcion"],
                observed_value="Declarado: " + "; ".join(ext["condiciones_nombres"]),
                threshold_note=(
                    "Condición declarada por el usuario (sí/no), no verificada por sensores; "
                    f"puntaje experimental +{int(ext['puntaje'])}. No depende de la lluvia."
                ),
            )
        )

    # Regla 4: Exposición espacial calculada con Shapely
    exposed_count = spatial.total_exposed_buildings if spatial else 0
    restricted_acc = spatial.total_restricted_accesses if spatial else 0
    counts = spatial.exposure_counts if spatial else {}
    high_count = counts.get("alta", 0) + counts.get("total", 0)
    breakdown = (
        f"{exposed_count} edificios ({counts.get('total', 0)} total, {counts.get('alta', 0)} alta, "
        f"{counts.get('parcial', 0)} parcial), {restricted_acc} accesos"
    )
    if exposed_count >= 3 or restricted_acc >= 2 or high_count >= 2:
        score += 2
        rules.append(
            RuleTrigger(
                rule_id="R-ESP-01",
                description="Múltiples edificaciones o accesos intersectan la zona experimental analizada",
                observed_value=breakdown,
                threshold_note="Calculado geométricamente con Shapely; niveles por % de huella dentro de la zona (umbrales experimentales)",
            )
        )
    elif exposed_count >= 1 or restricted_acc >= 1:
        score += 1
        rules.append(
            RuleTrigger(
                rule_id="R-ESP-02",
                description="Exposición espacial localizada en el campus",
                observed_value=breakdown,
                threshold_note="Calculado geométricamente con Shapely; niveles por % de huella dentro de la zona (umbrales experimentales)",
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
            f"Exposición espacial (Shapely): {exposed_count} edificaciones con exposición parcial o mayor "
            f"({high_count} con exposición alta o total) y {restricted_acc} accesos "
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
    if external_rules:
        sources.append(
            "Condiciones externas: declaradas por el usuario (sí/no) y reglas experimentales basadas en "
            "prensa y testimonio no verificados (condiciones_externas.json)."
        )
    sources.append("Geografía: GeoJSON referencial UNT + escenarios experimentales por mecanismo procesados con Shapely 2.x.")

    return PreventiveEvaluation(
        is_synthetic=is_synthetic,
        data_nature="ESCENARIO_SIMULADO_SINTETICO" if is_synthetic else "EVALUACION_SOBRE_PRONOSTICO_REAL",
        preventive_level=level_key,  # type: ignore[arg-type]
        level_label=level_info["label"],
        level_color=level_info["color"],
        hazard_assessment=hazard_text,
        exposure_assessment=exposure_text,
        risk_distinction_note=(
            "Peligro meteorológico = intensidad/acumulado de lluvia (alimenta las reglas preventivas, "
            "no el polígono); Exposición = infraestructura UNT dentro de la zona experimental analizada; "
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
        ] + (
            [
                "Las condiciones externas (calle inundada, quebrada activa) las declara el usuario: no hay "
                "sensores en calles ni quebradas, y las reglas se basan en muy pocos eventos de prensa y testimonio.",
            ]
            if external_rules else []
        ),
        legal_disclaimer=(
            "Cumplimiento Ley N.° 29664 (SINAGERD), D.S. N.° 048-2011-PCM y D.S. N.° 115-2022-PCM "
            "(PLANAGERD 2022–2030): este aviso es informativo/preventivo y no reemplaza las alertas "
            "ni decisiones de Defensa Civil UNT, SENAMHI, COEN o INDECI."
        ),
    )


def evaluate_hydro_rules(hydro_run: HydroRunResponse) -> list[RuleTrigger]:
    """Evalúa reglas R-HID aisladas de los puntajes preventivos existentes."""
    thresholds = load_hydro_params()["reglas_preventivas_hidro"]
    elements = [
        element
        for element in hydro_run.elements
        if element.category in {"acceso", "estacionamiento", "edificio"}
    ]
    rules: list[RuleTrigger] = []

    def depth_class(depth_cm: float) -> str:
        classes = load_hydro_params()["clases_profundidad_m"]
        for class_name in ("leve", "moderada", "alta"):
            lower_m, upper_m = classes[class_name]["range"]
            if depth_cm / 100.0 >= float(lower_m) and (
                upper_m is None or depth_cm / 100.0 < float(upper_m)
            ):
                lower_cm = round(float(lower_m) * 100)
                range_text = (
                    f"≈ {lower_cm} cm o más"
                    if upper_m is None
                    else f"≈ {lower_cm}–{round(float(upper_m) * 100)} cm"
                )
                return f"{class_name} ({range_text})"
        return "sin agua visible"

    def concise_observation(items: list[str], total: int) -> str:
        preview = "; ".join(items[:5])
        remaining = total - min(total, 5)
        suffix = f"; +{remaining} elementos" if remaining else ""
        return f"{total} elementos; {preview}{suffix}" if preview else f"{total} elementos"

    gate_accesses = [
        element
        for element in elements
        if element.category == "acceso"
        and re.search(r"\bPuerta\s*[1-4]\b", element.name, re.IGNORECASE)
    ]
    r_hid_01 = thresholds["R-HID-01"]
    access_depth_limit = float(r_hid_01["depth_cm"]["value"])
    above_access_limit = [
        element for element in gate_accesses if element.max_depth_cm >= access_depth_limit
    ]
    if above_access_limit:
        observed = "; ".join(
            f"{element.name}: {depth_class(element.max_depth_cm)}"
            for element in above_access_limit
        )
        rules.append(
            RuleTrigger(
                rule_id="R-HID-01",
                description="Profundidad máxima modelada en accesos nominales P1–P4 supera el umbral experimental",
                observed_value=observed,
                threshold_note=(
                    f"Umbral experimental: profundidad máxima ≥ {access_depth_limit:g} cm en P1–P4; "
                    "umbral no validado."
                ),
            )
        )

    r_hid_02 = thresholds["R-HID-02"]
    minimum_first_hour = int(r_hid_02["first_hour"]["value"])
    first_affected = [
        element
        for element in elements
        if element.first_hour_affected is not None
        and element.first_hour_affected >= minimum_first_hour
    ]
    if first_affected:
        ordered_first = sorted(
            first_affected,
            key=lambda element: (element.first_hour_affected, element.name, element.id),
        )
        observed = concise_observation(
            [
                f"{element.name}: h+{element.first_hour_affected}, "
                f"{depth_class(element.first_hour_depth_cm or 0.0)}"
                for element in ordered_first
            ],
            len(ordered_first),
        )
        rules.append(
            RuleTrigger(
                rule_id="R-HID-02",
                description="Primera hora modelada de afectación en accesos, estacionamientos o edificios",
                observed_value=observed,
                threshold_note=(
                    f"Umbral experimental: primera hora modelada ≥ {minimum_first_hour} h; "
                    "umbral no validado."
                ),
            )
        )

    r_hid_03 = thresholds["R-HID-03"]
    persistence_depth_limit = float(r_hid_03["depth_cm"]["value"])
    persistence_hours_limit = int(r_hid_03["hours"]["value"])
    persistent_elements = [
        element
        for element in elements
        if element.hours_with_water_above_threshold >= persistence_hours_limit
    ]
    if persistent_elements:
        ordered_persistent = sorted(
            persistent_elements,
            key=lambda element: (-element.hours_with_water_above_threshold, element.name, element.id),
        )
        observed = concise_observation(
            [
                f"{element.name}: {element.hours_with_water_above_threshold} h"
                for element in ordered_persistent
            ],
            len(ordered_persistent),
        )
        rules.append(
            RuleTrigger(
                rule_id="R-HID-03",
                description="Persistencia de agua modelada sobre el mismo elemento",
                observed_value=observed,
                threshold_note=(
                    f"Umbral experimental: agua ≥ {persistence_depth_limit:g} cm durante "
                    f"≥ {persistence_hours_limit} h; umbral no validado."
                ),
            )
        )

    r_hid_04 = thresholds["R-HID-04"]
    inactive_level = str(r_hid_04["inactive_level"]["value"])
    inflow_level = str(hydro_run.parameters.get("inflow_p4", inactive_level))
    if inflow_level != inactive_level:
        rules.append(
            RuleTrigger(
                rule_id="R-HID-04",
                description="Ingreso externo por Puerta 4 activo en el escenario",
                observed_value=f"Nivel {inflow_level} seleccionado (escenario; no es caudal medido)",
                threshold_note=(
                    f"Umbral experimental: nivel distinto de '{inactive_level}'; "
                    "umbral no validado."
                ),
            )
        )
    return rules


def _hydro_time_label(hydro_run: HydroRunResponse, hour: int) -> str:
    weather = hydro_run.weather or {}
    hourly = weather.get("hourly") or []
    if hour <= len(hourly):
        raw_time = str(hourly[hour - 1].get("time", ""))
        try:
            parsed = datetime.fromisoformat(raw_time.replace("Z", "+00:00"))
            zone = ZoneInfo(str(weather.get("timezone") or "America/Lima"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=zone)
            else:
                parsed = parsed.astimezone(zone)
            return f"{parsed:%d/%m %H:%M} (Lima)"
        except (ValueError, KeyError, ZoneInfoNotFoundError):
            pass
    return f"h+{hour} del escenario"


def build_hydro_evaluation(hydro_run: HydroRunResponse) -> HydroEvaluationSheet:
    """Construye ficha y ventanas de acción sin cambiar el nivel preventivo tradicional."""
    protocols = load_protocols()
    guidance = protocols.get("hydro_action_guidance", {})
    role_guidance = [
        HydroRoleGuidance(**item) for item in guidance.get("role_guidance", [])
    ]
    academic_continuity = list(guidance.get("academic_continuity", []))
    relevant_elements = [
        element
        for element in hydro_run.elements
        if element.category in {"acceso", "estacionamiento", "edificio", "area_deportiva"}
        and element.first_hour_affected is not None
    ]
    thresholds = load_hydro_params()
    classes = thresholds["clases_profundidad_m"]
    windows_by_hour: dict[int, list[HydroAffectedElement]] = {}
    for element in relevant_elements:
        first_hour = int(element.first_hour_affected)
        depth_cm = element.first_hour_depth_cm or 0.0
        depth_class = "sin agua visible"
        for class_name in ("leve", "moderada", "alta"):
            lower_m, upper_m = classes[class_name]["range"]
            if depth_cm / 100.0 >= float(lower_m) and (
                upper_m is None or depth_cm / 100.0 < float(upper_m)
            ):
                lower_cm = round(float(lower_m) * 100)
                range_text = (
                    f"≈ {lower_cm} cm o más"
                    if upper_m is None
                    else f"≈ {lower_cm}–{round(float(upper_m) * 100)} cm"
                )
                depth_class = f"{class_name} ({range_text})"
                break
        windows_by_hour.setdefault(first_hour, []).append(
            HydroAffectedElement(
                id=element.id,
                name=element.name,
                category=element.category,
                first_hour_affected=first_hour,
                depth_class=depth_class,
            )
        )

    action_windows: list[HydroActionWindow] = []
    for hour, affected in sorted(windows_by_hour.items()):
        affected_names = ", ".join(item.name for item in affected)
        alternatives = list(dict.fromkeys(
            item.name
            for item in hydro_run.elements
            if item.category == "acceso"
            and re.search(r"\bPuerta\s*[1-4]\b", item.name, re.IGNORECASE)
            and (item.first_hour_affected is None or item.first_hour_affected > hour)
        ))
        if alternatives:
            alternate_text = (
                "El modelo no muestra agua en estos otros puntos de acceso hasta esta ventana: "
                + ", ".join(alternatives)
                + "; esto no confirma transitabilidad ni define una ruta."
            )
        else:
            alternate_text = (
                "El modelo no permite proponer un acceso alternativo para esta ventana ni evalúa rutas."
            )
        time_label = _hydro_time_label(hydro_run, hour)
        action_windows.append(
            HydroActionWindow(
                hour=hour,
                time_label=time_label,
                affected_elements=affected,
                recommendation=(
                    f"Desde {time_label}, el modelo representa agua por primera vez en "
                    f"{affected_names}. {alternate_text}"
                ),
                role_guidance=role_guidance,
                academic_continuity=academic_continuity,
            )
        )

    first_time = action_windows[0].time_label if action_windows else "sin primera afectación modelada"
    if action_windows:
        what_to_do = " ".join(window.recommendation for window in action_windows)
    else:
        what_to_do = (
            "No se registró primera afectación de los elementos considerados en este horizonte. "
            "La ausencia de agua modelada no acredita condiciones reales."
        )

    weather = hydro_run.weather or {}
    updated_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    if weather:
        source_text = (
            f"Lluvia: {weather.get('source_name', 'fuente meteorológica no identificada')} "
            f"({weather.get('data_status', 'estado no indicado')})"
        )
        source_date = weather.get("fetched_at_utc")
    else:
        source_text = str(hydro_run.metadata.get("source", "Serie horaria indicada para el escenario"))
        source_date = updated_at
    sources = [
        source_text,
        f"Actualización de la fuente: {source_date or updated_at}",
        f"Motor y parámetros locales: hydro_params.json v{thresholds.get('version', 'sin versión')}",
    ]
    uncertainty = [
        "Los umbrales de las reglas R-HID son experimentales; umbral no validado.",
        "El DEM de 30 m tiene error vertical ±4 m; la resolución de la cuadrícula no añade detalle topográfico.",
        "La clase describe agua modelada, no tránsito, daño ni estado real del elemento.",
        *hydro_run.limitations,
    ]
    return HydroEvaluationSheet(
        what="Lectura exploratoria de agua superficial modelada por hora; no es un aviso oficial.",
        where="Accesos, estacionamientos y edificios del catálogo referencial del campus UNT.",
        when=(
            f"Primera ventana con afectación modelada: {first_time}."
            if action_windows
            else "No se identificó primera afectación modelada en los elementos considerados."
        ),
        what_to_do=what_to_do,
        who_informs=(
            "Los avisos oficiales corresponden a Defensa Civil UNT, SENAMHI, INDECI y COEN; "
            "este modelo no emite alertas."
        ),
        rules_triggered=evaluate_hydro_rules(hydro_run),
        action_windows=action_windows,
        sources=sources,
        updated_at_utc=updated_at,
        uncertainty=uncertainty,
        notice=(
            "orientación experimental, no reemplaza avisos de Defensa Civil UNT, SENAMHI, "
            "INDECI ni COEN"
        ),
    )
