from typing import Annotated, Any, Literal, Optional
from pydantic import BaseModel, Field


class HourlyForecastPoint(BaseModel):
    time: str
    precipitation_mm: float = Field(ge=0.0)
    precipitation_probability_pct: Optional[int] = Field(default=None, ge=0, le=100)
    rain_mm: float = Field(default=0.0, ge=0.0)
    relative_humidity_2m_pct: Optional[int] = Field(default=None, ge=0, le=100)
    wind_speed_10m_kmh: Optional[float] = Field(default=None, ge=0.0)
    wind_direction_10m_deg: Optional[int] = Field(default=None, ge=0, le=360)
    wind_direction_cardinal: Optional[str] = None
    temperature_2m_c: Optional[float] = None
    apparent_temperature_c: Optional[float] = None
    surface_pressure_hpa: Optional[float] = Field(default=None, ge=800.0, le=1100.0)


class WeatherSummary(BaseModel):
    max_intensity_mm_h: float
    accumulated_24h_mm: float
    accumulated_48h_mm: float
    estimated_event_duration_h: int
    max_probability_pct: Optional[int] = None
    max_probability_24h_pct: Optional[int] = None
    max_probability_48h_pct: Optional[int] = None
    avg_humidity_pct: Optional[float] = None
    current_surface_pressure_hpa: Optional[float] = None
    min_surface_pressure_24h_hpa: Optional[float] = None
    current_wind_speed_kmh: Optional[float] = None
    current_wind_direction_deg: Optional[int] = None
    current_wind_direction_cardinal: Optional[str] = None
    current_apparent_temperature_c: Optional[float] = None
    forecast_confidence_label: str = "Pronóstico probabilístico 48 h — Open-Meteo"


class WeatherResponse(BaseModel):
    location_name: str
    latitude: float
    longitude: float
    timezone: str
    data_status: Literal["LIVE_API", "OFFLINE_FALLBACK"]
    data_nature: str
    observation_vs_forecast: str
    source_name: str
    source_url: str
    fetched_at_utc: str
    units: dict[str, str]
    summary: WeatherSummary
    hourly: list[HourlyForecastPoint]
    limitations: list[str]
    fallback_reason: Optional[str] = None  # solo si data_status == OFFLINE_FALLBACK
    cache_period: Optional[str] = None  # rango de fechas de los datos en caché


class SimulationRequest(BaseModel):
    scenario_id: Literal[
        "lluvia_moderada",
        "lluvia_intensa_fen",
        "escenario_extremo_fen",
        "personalizado",
    ] = "lluvia_intensa_fen"
    intensity_mm_h: float = Field(default=25.0, ge=0.0, le=200.0)
    duration_hours: int = Field(default=4, ge=1, le=72)
    drainage_obstructed: bool = False
    antecedent_soil_saturated: bool = False
    hazard_zone_id: Literal[
        "lluvia_moderada",
        "lluvia_intensa_fen",
        "escenario_extremo_fen",
        "condiciones_externas",
    ] = "lluvia_intensa_fen"
    synthetic_reach_m: Optional[float] = Field(default=None, ge=20.0, le=150.0)
    # Condiciones externas declaradas (sí/no). Solo se usan con hazard_zone_id="condiciones_externas".
    external_conditions: list[str] = Field(default_factory=list, max_length=20)


class RainfallReference(BaseModel):
    source: str
    event_id: Optional[str] = None
    label: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    max_hourly_mm_h: Optional[float] = None
    max_rolling_24h_mm: Optional[float] = None
    hours_ge_0_1mm: Optional[int] = None
    is_historical_reanalysis: bool
    note: Optional[str] = None
    demo_assumption_mm_h: Optional[float] = None
    reanalysis_near_zero: bool = False


class ExposedElement(BaseModel):
    id: str
    name: str
    category: str
    criticality: Optional[str] = None
    inside_hazard_zone: bool  # True si la geometría toca la zona (cualquier traslape)
    overlap_pct: float = 0.0  # % de huella; para puntos expresa intersección geométrica (0 o 100)
    exposure_level: Optional[str] = None  # ninguna | marginal | parcial | alta | total
    status_in_scenario: str
    osm_id: Optional[str] = None


class WatchedBuilding(BaseModel):
    """Edificio con agua reportada en un evento previo. Se vigila aunque quede fuera del polígono."""
    id: str
    name: str
    event_id: str
    event_date: Optional[str] = None
    source: str
    confidence: str
    inside_hazard_zone: bool
    overlap_pct: float = 0.0
    status_in_scenario: str


class SyntheticExposureAnalysis(BaseModel):
    data_nature: str = "sintetico_demostrativo"
    reach_m: float
    azimuth_deg: float
    azimuth_assumption: bool = False
    buildings: list[ExposedElement]
    accesses: list[ExposedElement]
    building_counts: dict[str, int]
    access_counts: dict[str, int]
    total_buildings_exposed: int
    total_accesses_inside: int
    description: str


class SpatialAnalysisResult(BaseModel):
    hazard_zone_id: str
    hazard_zone_name: str
    hazard_severity: str
    exposed_buildings: list[ExposedElement]
    restricted_accesses: list[ExposedElement]
    meeting_points_status: list[ExposedElement]
    total_exposed_buildings: int  # edificios con exposición parcial, alta o total (>= 5 % de la huella)
    total_restricted_accesses: int
    exposure_counts: dict[str, int] = {}  # {"marginal": n, "parcial": n, "alta": n, "total": n}
    synthetic_exposure: Optional[SyntheticExposureAnalysis] = None
    watch_buildings: list[WatchedBuilding] = []
    spatial_engine: str


class RuleTrigger(BaseModel):
    rule_id: str
    description: str
    observed_value: str
    threshold_note: str


class PreventiveEvaluation(BaseModel):
    is_synthetic: bool
    data_nature: str
    preventive_level: Literal[
        "INFORMATIVO",
        "VIGILANCIA_PREVENTIVA",
        "ATENCION_PREVENTIVA",
        "PREPARACION_CRITICA",
    ]
    level_label: str
    level_color: str
    hazard_assessment: str
    exposure_assessment: str
    risk_distinction_note: str
    rules_triggered: list[RuleTrigger]
    guidance: list[str]
    academic_continuity: list[str]
    sources_and_timestamps: list[str]
    uncertainty_and_limits: list[str]
    legal_disclaimer: str


class SimulationResponse(BaseModel):
    simulation_id: str
    is_synthetic: Literal[True] = True
    data_nature: str = "ESCENARIO_SIMULADO_SINTETICO"
    parameters: SimulationRequest
    simulated_accumulated_mm: float
    synthetic_reach_m_effective: Optional[float] = None
    rainfall_reference: Optional[RainfallReference] = None
    spatial_analysis: SpatialAnalysisResult
    preventive_evaluation: PreventiveEvaluation
    hazard_geojson: dict[str, Any]
    synthetic_geojson: Optional[dict[str, Any]] = None


# ---------------------------------------------------------------------------
# FASE 1 — simulación dinámica de agua (capa NUEVA; los escenarios A-D no cambian)
# ---------------------------------------------------------------------------
HydroDrainageState = Literal["normal", "obstruido", "pendiente_deficiente"]
HydroDrainageScenario = Literal["obstruido", "base", "canaletas_nuevas"]
HydroInflowLevel = Literal["ninguno", "bajo", "medio", "alto"]


class HydroRunRequest(BaseModel):
    """Serie horaria de lluvia (mm/h) + estado de drenaje + nivel de ingreso P4."""

    rainfall_mm_h: list[Annotated[float, Field(ge=0.0, le=200.0)]] = Field(
        min_length=1,
        max_length=48,
        description="Lluvia horaria en mm/h. Máximo 48 h para cumplir el presupuesto de tiempo.",
    )
    drainage_state: HydroDrainageState = Field(
        default="normal",
        description="normal | obstruido | pendiente_deficiente (esta última es una hipótesis no verificada).",
    )
    drainage_scenario: HydroDrainageScenario = Field(
        default="base",
        description="Escenario paramétrico hipotético de alcantarillado/canaletas: obstruido | base | canaletas_nuevas.",
    )
    inflow_p4: HydroInflowLevel = Field(
        default="medio",
        description="Nivel de ingreso externo por la Puerta 4 (parámetro graduable, nunca un caudal medido).",
    )
    secondary_inflow: bool = Field(
        default=False,
        description="Activa el ingreso secundario débil e incierto por P1-P3 (Av. Juan Pablo II).",
    )
    use_reported_sinks: bool = Field(
        default=False,
        description=(
            "Activa los sumideros locales reportados por el equipo (CIDUNT, Derecho, Puerta 4 y "
            "Av. Juan Pablo II) con una profundidad de almacenamiento SUPUESTA. Apagado por defecto."
        ),
    )


class HydroFrame(BaseModel):
    """Un hora de simulación: resumen + GeoJSON con las clases leve/moderada/alta."""

    hour: int
    label: str
    max_depth_cm: float
    wet_area_m2: float
    campus_edge_wet_cells: int
    geojson: dict[str, Any]


class HydroElementImpact(BaseModel):
    """Agua modelada sobre la huella (o el anillo) de un elemento del catálogo."""

    id: str
    name: str
    category: str
    scope: str
    max_depth_cm: float
    first_hour_affected: Optional[int] = None
    first_hour_depth_cm: Optional[float] = None
    hours_with_water_above_threshold: int = 0


class HydroRoleGuidance(BaseModel):
    role: str
    text: str


class HydroAffectedElement(BaseModel):
    id: str
    name: str
    category: str
    first_hour_affected: int
    depth_class: str


class HydroActionWindow(BaseModel):
    hour: int
    time_label: str
    affected_elements: list[HydroAffectedElement]
    recommendation: str
    role_guidance: list[HydroRoleGuidance]
    academic_continuity: list[str]


class HydroEvaluationSheet(BaseModel):
    what: str
    where: str
    when: str
    what_to_do: str
    who_informs: str
    rules_triggered: list[RuleTrigger]
    action_windows: list[HydroActionWindow]
    sources: list[str]
    updated_at_utc: str
    uncertainty: list[str]
    notice: str


class HydroRunResponse(BaseModel):
    run_id: str
    is_simulation: Literal[True] = True
    data_nature: str
    parameters: dict[str, Any]
    frames: list[HydroFrame]
    elements: list[HydroElementImpact]
    summary: dict[str, Any]
    metadata: dict[str, Any]
    assumptions: list[str]
    limitations: list[str]
    avisos: list[str]
    weather: Optional[dict[str, Any]] = None
    evaluation: Optional[HydroEvaluationSheet] = None
    virtual_sensors: Optional[list[dict[str, Any]]] = None
    drainage_impact: Optional[dict[str, Any]] = None


class HydroPreset(BaseModel):
    id: str
    label: str
    total_mm: float
    hours: int
    start_hour: int
    window_hours: int
    data_nature: str
    source: str
    note: str
    defaults: dict[str, Any]
    rainfall_mm_h: list[float]


class HydroPresetsResponse(BaseModel):
    is_simulation: Literal[True] = True
    data_nature: str
    assumptions: list[str]
    limitations: list[str]
    avisos: list[str]
    hyetogram_note: str
    presets: list[HydroPreset]
