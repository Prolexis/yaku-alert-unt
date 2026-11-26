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

BG_NAVY = RGBColor(11, 31, 51)       # #0B1F33
CARD_BG = RGBColor(18, 45, 74)       # #122D4A
CARD_BORDER = RGBColor(36, 75, 115)  # #244B73
ACCENT_CYAN = RGBColor(56, 189, 248) # #38BDF8
ACCENT_BLUE = RGBColor(37, 99, 235)  # #2563EB
ACCENT_GREEN = RGBColor(16, 185, 129)# #10B981
ACCENT_AMBER = RGBColor(245, 158, 11)# #F59E0B
TEXT_WHITE = RGBColor(248, 250, 252) # #F8FAFC
TEXT_LIGHT = RGBColor(203, 213, 225) # #CBD5E1
TEXT_MUTED = RGBColor(148, 163, 184) # #94A3B8

ROOT = Path(__file__).resolve().parents[1]
EVIDENCIAS_DIR = ROOT / "docs" / "evidencias"
FOOTER_TEXT = "YAKU ALERT — UNT · Hackathon Innova Norte 3G 2026 · Desafío 3 (TRL 3–4)"


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
    badge = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.7), Inches(0.28), Inches(5.6), Inches(0.32))
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
    tb = slide.shapes.add_textbox(Inches(0.7), Inches(0.68), Inches(11.9), Inches(0.62))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(27)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE

    # Subtitle
    sb = slide.shapes.add_textbox(Inches(0.7), Inches(1.26), Inches(11.9), Inches(0.4))
    stf = sb.text_frame
    stf.word_wrap = True
    stf.margin_left = stf.margin_top = stf.margin_right = stf.margin_bottom = 0
    sp = stf.paragraphs[0]
    sp.text = subtitle
    sp.font.size = Pt(14)
    sp.font.color.rgb = TEXT_LIGHT

    # Footer
    fb = slide.shapes.add_textbox(Inches(0.7), Inches(7.02), Inches(10.5), Inches(0.32))
    fp = fb.text_frame.paragraphs[0]
    fp.text = FOOTER_TEXT
    fp.font.size = Pt(10)
    fp.font.color.rgb = TEXT_MUTED

    nb = slide.shapes.add_textbox(Inches(11.6), Inches(7.02), Inches(1.0), Inches(0.32))
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
    body_pt: float = 13.5,
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
    hp.font.size = Pt(15.5)
    hp.font.bold = True
    hp.font.color.rgb = accent
    hp.space_after = Pt(8)

    for item in bullets:
        bp = tf.add_paragraph()
        bp.text = f"•  {item}"
        bp.font.size = Pt(body_pt)
        bp.font.color.rgb = TEXT_WHITE
        bp.space_after = Pt(7)


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
    # Frame
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
    cp.font.size = Pt(10.5)
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
        4.75,
        "El problema real en la Ciudad Universitaria UNT",
        [
            "Antecedentes documentados en marzo 2017 y 10 de marzo 2023 evidencian ingreso de agua y anegamientos internos.",
            "Zonas críticas identificadas: Puerta 4 (Av. Jesús de Nazareth), estacionamientos CIDUNT/Derecho, Comedor, Puerta 3 y pabellones en cota baja (SO).",
            "Las plataformas oficiales (SENAMHI, SIGRID, GEOQUEBRADAS) operan a escala nacional/distrital, sin microescala de campus.",
            "Falta una herramienta clara que traduzca lluvia en acciones preventivas sin generar pánico ni rumores.",
        ],
        accent=ACCENT_AMBER,
        body_pt=14,
    )
    _add_card(
        s1,
        6.8,
        1.85,
        5.8,
        4.75,
        "Comunidad afectada y brecha de decisión",
        [
            "Estudiantes: incertidumbre sobre qué accesos evitar, dónde resguardarse y si habrá clases o laboratorios.",
            "Docentes: necesidad de criterios tempranos para migrar sesiones teóricas al aula virtual y reprogramar prácticas.",
            "Personal administrativo: urgencia de proteger expedientes físicos y equipos en primer nivel y activar Mesa de Partes virtual.",
            "Brecha crítica: ante cortes de Wi-Fi o datos móviles en lluvia extrema, las apps dependientes de la nube fallan.",
        ],
        accent=ACCENT_CYAN,
        body_pt=14,
    )

    # ------------------------------------------------------------------
    # SLIDE 2: Propuesta de valor e innovación (15 pts)
    # ------------------------------------------------------------------
    s2 = prs.slides.add_slide(blank)
    _set_bg(s2)
    _add_chrome(
        s2,
        "PROPUESTA DE VALOR E INNOVACIÓN (15 PTS)",
        "Dos roles diseñados a medida + Motor Preventivo Explicable",
        "No solo mostramos mapas: explicamos qué datos y reglas sustentan cada orientación",
        2,
    )
    _add_card(
        s2,
        0.7,
        1.85,
        5.8,
        3.55,
        "Rol 1 · Estudiante / Visitante (< 10 segundos)",
        [
            "Inicio 75/25: pronóstico 24 h protagonista + buscador inmediato de facultad.",
            "Mapa de monitoreo claro con 5 puntos seguros y 5 rutas referenciales en cota alta.",
            "Simulación en 1 clic (Escenario tipo 2017 y tipo 2023) con resalte de rutas alternas.",
            "Cero sobrecarga técnica: sensores virtuales y controles complejos ocultos por diseño.",
        ],
        accent=ACCENT_GREEN,
        body_pt=13.5,
    )
    _add_card(
        s2,
        6.8,
        1.85,
        5.8,
        3.55,
        "Rol 2 · Gestión / Administrador UNT",
        [
            "Autómata celular determinista 10 m + escenarios espaciales Shapely (A/B/C/D).",
            "Reglas transparentes R-MET / R-ACU / R-ESP / R-COND / R-EXT / R-HID.",
            "Red conceptual YAKU SENSE (S01–S06) rotulada como propuesta futura no operativa.",
            "Generador de avisos simulados por perfil (Estudiantes, Docentes, Administrativos) y canal (WhatsApp/Telegram y Correo UNT).",
        ],
        accent=ACCENT_CYAN,
        body_pt=13.5,
    )
    _add_card(
        s2,
        0.7,
        5.6,
        11.9,
        1.15,
        "Innovación clave: rigor científico y trazabilidad total",
        [
            "Separa explícitamente Peligro meteorológico, Exposición espacial y Estado preventivo; nunca convierte probabilidad de lluvia en probabilidad de huaico.",
        ],
        accent=ACCENT_AMBER,
        body_pt=13.5,
    )

    # ------------------------------------------------------------------
    # SLIDE 3: Arquitectura técnica y demostración del MVP (25 pts)
    # ------------------------------------------------------------------
    s3 = prs.slides.add_slide(blank)
    _set_bg(s3)
    _add_chrome(
        s3,
        "ARQUITECTURA TÉCNICA Y DEMOSTRACIÓN DEL MVP (25 PTS)",
        "Simulación en malla 10 m, blindaje 100 % offline y continuidad integral",
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
            "Escenarios históricos 2017 (27,5 mm) y 2023 (35 mm) + pronóstico horario 48 h con balance de masa verificado.",
            "Modo 100 % offline: mapa base Solo vectorial (sin internet) automático + caché meteorológica local (OFFLINE_FALLBACK).",
            "Continuidad académica y administrativa: fases Antes/Durante/Después (aulas virtuales, reprogramación, Mesa de Partes virtual y trabajo remoto).",
            "Software verificado: 70/70 pruebas pytest + build de producción Vite limpio.",
        ],
        accent=ACCENT_CYAN,
        body_pt=13.2,
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
    # SLIDE 4: Validación y aprendizaje con usuarios (15 pts)
    # ------------------------------------------------------------------
    s4 = prs.slides.add_slide(blank)
    _set_bg(s4)
    _add_chrome(
        s4,
        "VALIDACIÓN Y APRENDIZAJE CON USUARIOS (15 PTS)",
        "Pivote real de UX: de panel técnico sobrecargado a 2 experiencias claras",
        "Ciclo Construir → Medir → Aprender con evidencia verificable y cero cifras inventadas",
        4,
    )
    _add_card(
        s4,
        0.7,
        1.85,
        6.5,
        4.85,
        "Hallazgos, pivote ejecutado y verificación real",
        [
            "Hallazgo UX: en la versión inicial, los controles hidrológicos, capas sintéticas y sensores saturaban al estudiante que solo busca orientación rápida.",
            "Pivote aplicado: separación estricta Estudiante vs. Gestión; se ocultaron sensores y parámetros técnicos en vista pública (virtual_sensors: null).",
            "Resultado en interfaz: mapa estudiantil claro con 5 puntos seguros y 5 rutas referenciales + simulación en 1 clic (2017 / 2023).",
            "Verificación técnica real: 70/70 pruebas automatizadas pytest (API, offline, Shapely, conservación de masa, límites UNT y términos prohibidos).",
            "Validación en campo protocolizada (Entregable 4): 5 tareas (T1–T5) listas para 5–10 participantes UNT — sin reportar encuestas ficticias.",
        ],
        accent=ACCENT_GREEN,
        body_pt=13.2,
    )
    _add_evidence_image(
        s4,
        "15_estudiante_mapa.png",
        7.55,
        2.05,
        5.05,
        "Pivote UX: Mapa de monitoreo Estudiante limpio y directo",
    )

    # ------------------------------------------------------------------
    # SLIDE 5: Escalabilidad IoT responsable — YAKU SENSE (15 pts)
    # ------------------------------------------------------------------
    s5 = prs.slides.add_slide(blank)
    _set_bg(s5)
    _add_chrome(
        s5,
        "VIABILIDAD, ESCALABILIDAD E IMPACTO (15 PTS)",
        "Escalabilidad IoT responsable: YAKU SENSE + Hoja de Ruta",
        "Arquitectura preparada para telemetría real sin prometer sensores inexistentes hoy",
        5,
    )
    _add_card(
        s5,
        0.7,
        1.85,
        6.5,
        4.85,
        "Red conceptual YAKU SENSE y destino del incentivo (S/ 1,500)",
        [
            "Red virtual S01–S06 (Puerta 4, CIDUNT, Derecho, Comedor, Puerta 3, pluviómetro) bajo estándar LoRaWAN AU915 + MQTT.",
            "Declaración explícita en UI y API: PROPUESTA_FUTURA_NO_OPERATIVA (telemetría determinista simulada; cero hardware instalado hoy).",
            "Destino concreto del premio (S/ 1,500): levantamiento en campo de las canaletas nuevas de la UNT y microdrenajes (hito clave para pasar a TRL 5–6).",
            "Piloto institucional con Defensa Civil y Servicios Generales UNT + ejecución de sesiones T1–T5 con comunidad universitaria.",
            "Escalabilidad regional: arquitectura GeoJSON intercambiable para El Porvenir, Alto Trujillo y Víctor Larco (licenciamiento S/ 0).",
        ],
        accent=ACCENT_CYAN,
        body_pt=13.2,
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
            "No reemplaza alertas oficiales de SENAMHI, COEN, INDECI ni Defensa Civil UNT.",
        ],
        accent=ACCENT_CYAN,
        body_pt=13.5,
    )
    _add_card(
        s6,
        6.8,
        1.85,
        5.8,
        2.25,
        "Privacidad por diseño (Ley N.° 29733)",
        [
            "Cero recopilación de PII: no solicita cuentas, DNI ni correo personal.",
            "Cero rastreo ni geolocalización GPS del dispositivo del estudiante.",
            "Sin conexión ni escritura en sistemas productivos universitarios.",
        ],
        accent=ACCENT_GREEN,
        body_pt=13.5,
    )
    _add_card(
        s6,
        0.7,
        4.35,
        5.8,
        2.3,
        "Ética científica y rotulado (TRL 3–4)",
        [
            "Distinción visual y en API entre pronóstico real y escenarios sintéticos.",
            "Puntos seguros y rutas marcados con reference_only: true y descargo visible.",
            "Canaletas nuevas UNT declaradas como no modeladas hasta inventario en campo.",
        ],
        accent=ACCENT_AMBER,
        body_pt=13.5,
    )
    _add_card(
        s6,
        6.8,
        4.35,
        5.8,
        2.3,
        "Seguridad de software y difusión responsable",
        [
            "Validación estricta Pydantic (HTTP 422) y cabeceras HTTP (nosniff, DENY).",
            "Difusión por perfil 100 % simulada (borrador copiable; no envía SMS/correos).",
            "Lenguaje preventivo auditado automáticamente por tests para evitar falsas alarmas.",
        ],
        accent=ACCENT_BLUE,
        body_pt=13.5,
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
        ("100 % OFFLINE", "Mapa solo vectorial automático + caché meteorológica local", ACCENT_CYAN),
        ("70 / 70 TESTS", "Suite pytest verificada + build de producción limpio", ACCENT_GREEN),
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
            "Hoy demostramos una plataforma funcional que orienta a estudiantes en <10 s y apoya a Gestión UNT con simulación 10 m, rutas referenciales, avisos por perfil y continuidad académica y administrativa.",
            "Siguiente paso inmediato con DITT, Defensa Civil y Servicios Generales UNT: levantar en campo las canaletas nuevas del campus, calibrar umbrales y activar el piloto universitario.",
            "Visión regional: replicar esta base open-source junto a la RUI para proteger campus y distritos vulnerables de La Libertad ante el próximo Fenómeno El Niño.",
        ],
        accent=ACCENT_CYAN,
        body_pt=14.5,
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
