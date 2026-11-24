from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


class HourlyForecastPoint(BaseModel):
    time: str
    precipitation_mm: float = Field(ge=0.0)
    precipitation_probability_pct: Optional[int] = Field(default=None, ge=0, le=100)
    rain_mm: float = Field(default=0.0, ge=0.0)
    relative_humidity_2m_pct: Optional[int] = Field(default=None, ge=0, le=100)
    wind_speed_10m_kmh: Optional[float] = Field(default=None, ge=0.0)
    temperature_2m_c: Optional[float] = None


class WeatherSummary(BaseModel):
    max_intensity_mm_h: float
    accumulated_24h_mm: float
    accumulated_48h_mm: float
    estimated_event_duration_h: int
    max_probability_pct: Optional[int] = None
    avg_humidity_pct: Optional[float] = None


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
    ] = "lluvia_intensa_fen"
    synthetic_reach_m: Optional[float] = Field(default=None, ge=20.0, le=150.0)


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
