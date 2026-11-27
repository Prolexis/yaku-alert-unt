"""Generador oficial del Pitch Deck YAKU ALERT — UNT (estrictamente 7 diapositivas).

Hackathon Innova Norte 3G 2026 — Desafío 3: Gestión de riesgos y desastres ante el Fenómeno El Niño.
"""
from __future__ import annotations

from pathlib import Path
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

BG_NAVY = RGBColor(11, 37, 69)       # #0B2545
CARD_BG = RGBColor(18, 50, 90)       # #12325A
CARD_BORDER = RGBColor(36, 82, 130)  # #245282
ACCENT_CYAN = RGBColor(0, 180, 216)  # #00B4D8
ACCENT_BLUE = RGBColor(3, 105, 161)  # #0369A1
ACCENT_GREEN = RGBColor(5, 150, 105) # #059669
ACCENT_AMBER = RGBColor(245, 158, 11)# #F59E0B
TEXT_WHITE = RGBColor(248, 250, 252) # #F8FAFC
TEXT_LIGHT = RGBColor(203, 213, 225) # #CBD5E1
TEXT_MUTED = RGBColor(148, 163, 184) # #94A3B8
PURE_WHITE = RGBColor(255, 255, 255) # #FFFFFF

ROOT = Path(__file__).resolve().parents[1]
EVIDENCIAS_DIR = ROOT / "docs" / "evidencias"
FOOTER_TEXT = "Yaku Alert — UNT · Desarrollado por NexoRisk · Hackathon Innova Norte 3G 2026 (TRL 3–4)"


def _resolve_brand_asset(filename: str) -> Path | None:
    for candidate in (
        Path(__file__).resolve().parent / "assets" / filename,
        ROOT / "frontend" / "public" / "assets" / filename,
    ):
        if candidate.exists():
            return candidate
    return None


def _add_logo_badge(slide, filename: str, left: float, top: float, size: float) -> None:
    asset = _resolve_brand_asset(filename)
    if not asset:
        return
    pad = 0.06
    bg = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE,
        Inches(left),
        Inches(top),
        Inches(size),
        Inches(size),
    )
    bg.fill.solid()
    bg.fill.fore_color.rgb = PURE_WHITE
    bg.line.color.rgb = ACCENT_CYAN
    bg.line.width = Pt(1.0)
    slide.shapes.add_picture(
        str(asset),
        Inches(left + pad),
        Inches(top + pad),
        width=Inches(size - 2 * pad),
        height=Inches(size - 2 * pad),
    )


def _add_nexorisk_signature(slide, left: float = 9.55, top: float = 6.9) -> None:
    asset = _resolve_brand_asset("nexorisk-icon.png")
    pill = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE,
        Inches(left),
        Inches(top),
        Inches(2.15),
        Inches(0.42),
    )
    pill.fill.solid()
    pill.fill.fore_color.rgb = CARD_BG
    pill.line.color.rgb = CARD_BORDER
    pill.line.width = Pt(1.0)

    if asset:
        icon_bg = slide.shapes.add_shape(
            MSO_SHAPE.ROUNDED_RECTANGLE,
            Inches(left + 0.08),
            Inches(top + 0.06),
            Inches(0.30),
            Inches(0.30),
        )
        icon_bg.fill.solid()
        icon_bg.fill.fore_color.rgb = PURE_WHITE
        icon_bg.line.fill.background()
        slide.shapes.add_picture(
            str(asset),
            Inches(left + 0.11),
            Inches(top + 0.09),
            width=Inches(0.24),
            height=Inches(0.24),
        )

    tb = slide.shapes.add_textbox(
        Inches(left + 0.44),
        Inches(top + 0.08),
        Inches(1.65),
        Inches(0.28),
    )
    tf = tb.text_frame
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.text = "by NexoRisk"
    p.font.size = Pt(10.5)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE


def _set_bg(slide) -> None:
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = BG_NAVY


def _add_chrome(slide, badge_text: str, title: str, subtitle: str, slide_num: int) -> None:
    # Top accent bar
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), Inches(13.333), Inches(0.1))
    bar.fill.solid()
    bar.fill.fore_color.rgb = ACCENT_CYAN
    bar.line.fill.background()

    # Rubric badge
    badge = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.7), Inches(0.28), Inches(6.2), Inches(0.32))
    badge.fill.solid()
    badge.fill.fore_color.rgb = CARD_BG
    badge.line.color.rgb = ACCENT_CYAN
    badge.line.width = Pt(1)
    btf = badge.text_frame
    btf.margin_left = Inches(0.12)
    btf.margin_top = Inches(0.03)
    bp = btf.paragraphs[0]
    bp.text = badge_text
    bp.font.size = Pt(10.5)
    bp.font.bold = True
    bp.font.color.rgb = ACCENT_CYAN

    # Title
    tb = slide.shapes.add_textbox(Inches(0.7), Inches(0.68), Inches(10.9), Inches(0.62))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(26)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE

    # Subtitle
    sb = slide.shapes.add_textbox(Inches(0.7), Inches(1.26), Inches(10.9), Inches(0.4))
    stf = sb.text_frame
    stf.word_wrap = True
    stf.margin_left = stf.margin_top = stf.margin_right = stf.margin_bottom = 0
    sp = stf.paragraphs[0]
    sp.text = subtitle
    sp.font.size = Pt(13.5)
    sp.font.color.rgb = TEXT_LIGHT

    # Yaku Alert brand isotipo in header (top-right, zero overlap)
    _add_logo_badge(slide, "yaku-alert-icon.png", left=11.88, top=0.32, size=0.72)

    # Footer
    fb = slide.shapes.add_textbox(Inches(0.7), Inches(7.02), Inches(8.6), Inches(0.32))
    fp = fb.text_frame.paragraphs[0]
    fp.text = FOOTER_TEXT
    fp.font.size = Pt(10)
    fp.font.color.rgb = TEXT_MUTED

    if slide_num in (1, 7):
        _add_nexorisk_signature(slide, left=9.45, top=6.92)

    nb = slide.shapes.add_textbox(Inches(11.7), Inches(7.02), Inches(0.9), Inches(0.32))
    np_ = nb.text_frame.paragraphs[0]
    np_.text = f"{slide_num} / 7"
    np_.font.size = Pt(10.5)
    np_.font.bold = True
    np_.font.color.rgb = ACCENT_CYAN
    np_.alignment = PP_ALIGN.RIGHT


def _add_card(
    slide,
    left: float,
    top: float,
    width: float,
    height: float,
    heading: str,
    bullets: list[str],
    accent: RGBColor = ACCENT_CYAN,
    body_pt: float = 13.0,
) -> None:
    card = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height)
    )
    card.fill.solid()
    card.fill.fore_color.rgb = CARD_BG
    card.line.color.rgb = CARD_BORDER
    card.line.width = Pt(1.2)

    # Left accent stripe
    stripe = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(left), Inches(top + 0.12), Inches(0.08), Inches(height - 0.24)
    )
    stripe.fill.solid()
    stripe.fill.fore_color.rgb = accent
    stripe.line.fill.background()

    tb = slide.shapes.add_textbox(
        Inches(left + 0.22), Inches(top + 0.14), Inches(width - 0.34), Inches(height - 0.24)
    )
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

    hp = tf.paragraphs[0]
    hp.text = heading
    hp.font.size = Pt(15.0)
    hp.font.bold = True
    hp.font.color.rgb = accent
    hp.space_after = Pt(7)

    for item in bullets:
        bp = tf.add_paragraph()
        bp.text = f"•  {item}"
        bp.font.size = Pt(body_pt)
        bp.font.color.rgb = TEXT_WHITE
        bp.space_after = Pt(6)


def _add_evidence_image(
    slide,
    filename: str,
    left: float,
    top: float,
    width: float,
    caption: str,
) -> None:
    img_path = EVIDENCIAS_DIR / filename
    if not img_path.exists():
        return
    height = width * (860.0 / 1280.0)
    frame = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE,
        Inches(left - 0.08),
        Inches(top - 0.08),
        Inches(width + 0.16),
        Inches(height + 0.5),
    )
    frame.fill.solid()
    frame.fill.fore_color.rgb = CARD_BG
    frame.line.color.rgb = CARD_BORDER
    frame.line.width = Pt(1.2)

    slide.shapes.add_picture(str(img_path), Inches(left), Inches(top), width=Inches(width))

    cb = slide.shapes.add_textbox(Inches(left), Inches(top + height + 0.06), Inches(width), Inches(0.32))
    ctf = cb.text_frame
    ctf.word_wrap = True
    ctf.margin_left = ctf.margin_top = ctf.margin_right = ctf.margin_bottom = 0
    cp = ctf.paragraphs[0]
    cp.text = caption
    cp.font.size = Pt(10.0)
    cp.font.color.rgb = TEXT_MUTED
    cp.alignment = PP_ALIGN.CENTER


def build_deck() -> Presentation:
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank = prs.slide_layouts[6]

    # ------------------------------------------------------------------
    # SLIDE 1: Portada + Problema real en la UNT (15 pts)
    # ------------------------------------------------------------------
    s1 = prs.slides.add_slide(blank)
    _set_bg(s1)
    _add_chrome(
        s1,
        "DESAFÍO 3: FENÓMENO EL NIÑO · PROBLEMA REAL EN LA UNT (15 PTS)",
        "YAKU ALERT — UNT",
        "Plataforma explicable de prevención, simulación 10 m y continuidad universitaria ante lluvias intensas",
        1,
    )
    _add_card(
        s1,
        0.7,
        1.85,
        5.8,
        4.85,
        "El problema real en la Ciudad Universitaria UNT",
        [
            "Antecedentes documentados en marzo 2017 y 10 de marzo 2023 evidencian ingreso de agua por Puerta 4 y anegamientos internos severos.",
            "Zonas críticas identificadas: Puerta 4 (Av. Jesús de Nazareth), estacionamientos CIDUNT/Derecho, Comedor, Puerta 3 y pabellones de cota baja.",
            "Las plataformas oficiales (SENAMHI, SIGRID, GEOQUEBRADAS) operan a escala nacional/distrital, sin microescala de campus.",
            "Falta una herramienta que traduzca lluvia en decisiones sin generar pánico ni falsas alarmas que paralicen la universidad.",
        ],
        accent=ACCENT_AMBER,
        body_pt=13.5,
    )
    _add_card(
        s1,
        6.8,
        1.85,
        5.8,
        4.85,
        "Comunidad afectada y brecha de decisión",
        [
            "Directivos y Decanos: necesitan semáforos claros para ordenar virtualidad, resguardo de laboratorios y reprogramaciones sin improvisar.",
            "Estudiantes: requieren saber qué accesos evitar, qué ruta segura tomar y qué hacer ahora en menos de 10 segundos.",
            "Personal administrativo: urgencia de proteger expedientes físicos y equipos en primer nivel y activar Mesa de Partes virtual.",
            "Brecha crítica: ante cortes de Wi-Fi o datos móviles en lluvia extrema, las apps dependientes de la nube fallan.",
        ],
        accent=ACCENT_CYAN,
        body_pt=13.5,
    )

    # ------------------------------------------------------------------
    # SLIDE 2: Propuesta de valor e innovación (15 pts)
    # ------------------------------------------------------------------
    s2 = prs.slides.add_slide(blank)
    _set_bg(s2)
    _add_chrome(
        s2,
        "PROPUESTA DE VALOR E INNOVACIÓN (15 PTS)",
        "Semáforo Ejecutivo + Experiencia Estudiante + Contexto Territorial",
        "No solo mostramos mapas: explicamos qué datos y reglas sustentan cada orientación preventiva",
        2,
    )
    _add_card(
        s2,
        0.7,
        1.85,
        5.8,
        3.55,
        "Rol 1 · Estudiante / Comunidad (< 10 segundos)",
        [
            "Inicio 75/25 con probabilidad máxima de lluvia (%) y confianza probabilística (Open-Meteo).",
            "Mapa estudiantil con nombres completos de facultades y pabellones (0 edificios sin nombre), 5 puntos seguros verdes y 5 rutas referenciales.",
            "Distinción visual tajante: Estado actual (pronóstico 48 h) vs. Simulación histórica educativa (2017/2023).",
            "Módulo de Acción Comunitaria: brigadas universitarias articuladas con territorios vecinales y checklist de Mochila de Emergencia (sin PII).",
        ],
        accent=ACCENT_GREEN,
        body_pt=12.8,
    )
    _add_card(
        s2,
        6.8,
        1.85,
        5.8,
        3.55,
        "Rol 2 · Gestión / Directivos UNT y Municipio",
        [
            "Semáforo Ejecutivo para Directivos (Rojo / Ámbar / Verde) comprensible en < 5 s para decidir virtualidad y resguardo.",
            "Resumen de riesgo en tiempo real: probabilidad %, ventana horaria crítica y top 3 sectores/accesos prioritarios.",
            "Variables sinópticas locales anti-falsas alarmas: presión atmosférica (<1000 hPa), viento (km/h + cardinal), sensación térmica y TSM ENFEN.",
            "Contexto territorial de Trujillo: 4 quebradas (San Ildefonso, San Carlos, León Dormido e Indoamérica) + Ruta del Agua referencial.",
        ],
        accent=ACCENT_CYAN,
        body_pt=12.8,
    )
    _add_card(
        s2,
        0.7,
        5.6,
        11.9,
        1.15,
        "Innovación clave: rigor científico y trazabilidad total",
        [
            "Separa explícitamente Peligro meteorológico, Exposición espacial y Estado preventivo; evita falsas alarmas y nunca confunde lluvia con huaico.",
        ],
        accent=ACCENT_AMBER,
        body_pt=13.0,
    )

    # ------------------------------------------------------------------
    # SLIDE 3: Arquitectura técnica y demostración del MVP (25 pts)
    # ------------------------------------------------------------------
    s3 = prs.slides.add_slide(blank)
    _set_bg(s3)
    _add_chrome(
        s3,
        "ARQUITECTURA TÉCNICA Y DEMOSTRACIÓN DEL MVP (25 PTS)",
        "Simulación 10 m, blindaje 100 % offline y continuidad integral",
        "FastAPI + Shapely 2.x + NumPy + React/Leaflet desplegable con Docker Compose",
        3,
    )
    _add_card(
        s3,
        0.7,
        1.85,
        6.5,
        4.85,
        "Capacidades demostrables hoy (en vivo y sin Wi-Fi)",
        [
            "Autómata celular 10 m (8 vecinos): DEM Copernicus GLO-30 con priority flood, escorrentía, infiltración, drenaje e ingreso por Puerta 4.",
            "Escenarios históricos 2017 (27,5 mm) y 2023 (35 mm) con balance de masa y resalte automático de rutas alternativas al anegarse accesos.",
            "Contexto territorial y canales oficiales: capa referencial Ruta del Agua + Av. Jesús de Nazareth + Urb. San Andrés + enlaces COER/SENAMHI/ENFEN/INDECI.",
            "Modo 100 % offline: mapa base Solo vectorial automático + respaldo Open-Meteo local con variables sinópticas completas.",
            "Software verificado y confiable: 75/75 pruebas pytest aprobadas + build de producción Vite limpio.",
        ],
        accent=ACCENT_CYAN,
        body_pt=13.0,
    )
    _add_evidence_image(
        s3,
        "16_estudiante_simulacion.png",
        7.55,
        2.05,
        5.05,
        "Captura real: Simulación 2017/2023 sobre malla 10 m y capas UNT",
    )

    # ------------------------------------------------------------------
    # SLIDE 4: Validación y aprendizaje con especialistas (15 pts)
    # ------------------------------------------------------------------
    s4 = prs.slides.add_slide(blank)
    _set_bg(s4)
    _add_chrome(
        s4,
        "VALIDACIÓN Y APRENDIZAJE CON USUARIOS (15 PTS)",
        "Iteración con especialistas de gestión de riesgos de Trujillo",
        "Ciclo Construir → Medir → Aprender con retroalimentación territorial verificable",
        4,
    )
    _add_card(
        s4,
        0.7,
        1.85,
        6.5,
        4.85,
        "Hallazgos reales, feedback territorial y mejoras aplicadas",
        [
            "Feedback especialistas Trujillo: exigió evitar mensajes deterministas; se incorporó la probabilidad máxima de lluvia (%) y variables sinópticas de campo.",
            "Geografía del campus corregida: se identificaron y nombraron 38 pabellones que figuraban 'sin nombre', habilitando tooltips y búsqueda completa.",
            "Contexto de quebradas real: se incorporó la Quebrada de Indoamérica (La Esperanza, sin obras de mitigación) junto a San Ildefonso, San Carlos y León Dormido.",
            "Separación tajante de experiencias: Semáforo Ejecutivo para Directivos en <5 s vs. mapa estudiantil simple con 'Qué hacer ahora' y rutas seguras.",
            "Acción comunitaria: módulo de 4 brigadas articuladas a territorios vecinales y checklist de mochila de emergencia 100 % local en memoria React.",
        ],
        accent=ACCENT_GREEN,
        body_pt=12.8,
    )
    _add_evidence_image(
        s4,
        "15_estudiante_mapa.png",
        7.55,
        2.05,
        5.05,
        "Pivote UX: Mapa de monitoreo Estudiante con nombres completos y rutas",
    )

    # ------------------------------------------------------------------
    # SLIDE 5: Viabilidad, escalabilidad e impacto (15 pts)
    # ------------------------------------------------------------------
    s5 = prs.slides.add_slide(blank)
    _set_bg(s5)
    _add_chrome(
        s5,
        "VIABILIDAD, ESCALABILIDAD E IMPACTO (15 PTS)",
        "De piloto universitario UNT a gestión territorial en Trujillo",
        "Arquitectura abierta y validable en malla 10 m con hoja de ruta de escalamiento",
        5,
    )
    _add_card(
        s5,
        0.7,
        1.85,
        6.5,
        4.85,
        "Escalamiento distrital, telemetría responsable e incentivo (S/ 1,500)",
        [
            "Ciudad Universitaria UNT como piloto validable en malla de 10 m: valida flujos en calles perimetrales (Nazareth/Juan Pablo II) y accesos.",
            "Escalamiento a municipalidades distritales y provincial (El Porvenir, La Esperanza, Huanchaco, Laredo): apoyo al despliegue de motobombas y brigadas en puntos críticos.",
            "Evolución futura a app móvil: consulta de rutas seguras, geolocalización opcional y alertas push comunitarias.",
            "Telemetría ética YAKU SENSE: arquitectura LoRaWAN AU915 + MQTT rotulada explícitamente PROPUESTA_FUTURA_NO_OPERATIVA (cero hardware ficticio hoy).",
            "Destino concreto del premio (S/ 1,500): levantamiento en campo de las canaletas nuevas de la UNT con Defensa Civil (hito para TRL 5–6).",
        ],
        accent=ACCENT_CYAN,
        body_pt=12.8,
    )
    _add_evidence_image(
        s5,
        "13_yaku_sense_dinamica.png",
        7.55,
        2.05,
        5.05,
        "YAKU SENSE [SIM] — Rotulado como PROPUESTA_FUTURA_NO_OPERATIVA",
    )

    # ------------------------------------------------------------------
    # SLIDE 6: Seguridad, ética y marco normativo (10 pts)
    # ------------------------------------------------------------------
    s6 = prs.slides.add_slide(blank)
    _set_bg(s6)
    _add_chrome(
        s6,
        "SEGURIDAD, ÉTICA Y MARCO NORMATIVO (10 PTS)",
        "Cumplimiento SINAGERD, PLANAGERD 2022–2030 y Privacidad por Diseño",
        "Alcance TRL 3–4 transparente, sin datos personales ni conexión a sistemas productivos",
        6,
    )
    _add_card(
        s6,
        0.7,
        1.85,
        5.8,
        2.25,
        "Marco normativo completo (Desafío 3)",
        [
            "Ley N.° 29664 (SINAGERD) y D.S. N.° 048-2011-PCM (Reglamento).",
            "D.S. N.° 115-2022-PCM — PLANAGERD 2022–2030.",
            "Canales oficiales diferenciados: COER/COEN, SENAMHI, ENFEN e INDECI.",
        ],
        accent=ACCENT_CYAN,
        body_pt=13.0,
    )
    _add_card(
        s6,
        6.8,
        1.85,
        5.8,
        2.25,
        "Privacidad por diseño (Ley N.° 29733)",
        [
            "Cero recopilación de PII: no solicita cuentas, DNI ni datos personales.",
            "Checklist de mochila interactivo 100 % local en memoria del navegador.",
            "Sin conexión ni escritura en sistemas productivos de la universidad.",
        ],
        accent=ACCENT_GREEN,
        body_pt=13.0,
    )
    _add_card(
        s6,
        0.7,
        4.35,
        5.8,
        2.3,
        "Ética científica y rotulado (TRL 3–4)",
        [
            "Distinción visual entre pronóstico probabilístico y simulaciones educativas.",
            "Puntos seguros y rutas marcados con reference_only: true y descargo visible.",
            "Canaletas nuevas UNT declaradas como no modeladas hasta inventario en campo.",
        ],
        accent=ACCENT_AMBER,
        body_pt=13.0,
    )
    _add_card(
        s6,
        6.8,
        4.35,
        5.8,
        2.3,
        "Seguridad de software y difusión responsable",
        [
            "Validación estricta Pydantic (HTTP 422) y cabeceras de seguridad HTTP.",
            "Generador de avisos por perfil 100 % simulado (borrador copiable sin spam).",
            "Lenguaje preventivo auditado por 75 tests automáticos para evitar alarmismos.",
        ],
        accent=ACCENT_BLUE,
        body_pt=13.0,
    )

    # ------------------------------------------------------------------
    # SLIDE 7: Cierre e impacto en la comunidad UNT (5 pts)
    # ------------------------------------------------------------------
    s7 = prs.slides.add_slide(blank)
    _set_bg(s7)
    _add_chrome(
        s7,
        "CIERRE E IMPACTO EN LA COMUNIDAD UNT (5 PTS)",
        "Preparación inteligente, ética y 100 % offline para nuestra universidad",
        "Software abierto, demostrable hoy y listo para articular con DITT, UNT y RUI",
        7,
    )

    # 3 KPI tiles
    kpis = [
        ("100 % OFFLINE", "Mapa solo vectorial automático + respaldo Open-Meteo local", ACCENT_CYAN),
        ("75 / 75 TESTS", "Suite pytest verificada + build de producción en 2 s", ACCENT_GREEN),
        ("0 PII · TRL 3–4", "Ley N.° 29733 + PLANAGERD 2022–2030 + costo licencia S/ 0", ACCENT_AMBER),
    ]
    for idx, (big, desc, color) in enumerate(kpis):
        x = 0.7 + idx * 4.08
        tile = s7.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(1.9), Inches(3.75), Inches(1.55))
        tile.fill.solid()
        tile.fill.fore_color.rgb = CARD_BG
        tile.line.color.rgb = color
        tile.line.width = Pt(1.8)
        tb = s7.shapes.add_textbox(Inches(x + 0.18), Inches(2.08), Inches(3.4), Inches(1.25))
        tf = tb.text_frame
        tf.word_wrap = True
        p1 = tf.paragraphs[0]
        p1.text = big
        p1.font.size = Pt(22)
        p1.font.bold = True
        p1.font.color.rgb = color
        p1.alignment = PP_ALIGN.CENTER
        p1.space_after = Pt(6)
        p2 = tf.add_paragraph()
        p2.text = desc
        p2.font.size = Pt(12)
        p2.font.color.rgb = TEXT_LIGHT
        p2.alignment = PP_ALIGN.CENTER

    _add_card(
        s7,
        0.7,
        3.75,
        11.9,
        2.9,
        "Llamado a la acción institucional (DITT · UNT · RUI)",
        [
            "Hoy demostramos una plataforma funcional que orienta a estudiantes en <10 s, apoya a directivos con Semáforo Ejecutivo y simulación 10 m, y articula a brigadistas con checklist de mochila sin conexión.",
            "Siguiente paso inmediato con DITT, Defensa Civil y Servicios Generales UNT: levantar en campo las canaletas nuevas del campus (premio S/ 1,500), calibrar umbrales y activar el piloto institucional.",
            "Visión regional: replicar esta base open-source junto a la Red Universitaria de Innovación (RUI) para proteger campus y distritos vulnerables de La Libertad ante el próximo Fenómeno El Niño.",
        ],
        accent=ACCENT_CYAN,
        body_pt=14.0,
    )

    return prs


def main() -> None:
    prs = build_deck()
    assert len(prs.slides) == 7, f"Se esperaban exactamente 7 diapositivas, se generaron {len(prs.slides)}"
    out_path = Path(__file__).resolve().parent / "YAKU_ALERT_UNT_PITCH.pptx"
    prs.save(out_path)
    print(f"Pitch generado exitosamente en: {out_path} ({len(prs.slides)} diapositivas)")


if __name__ == "__main__":
    main()
