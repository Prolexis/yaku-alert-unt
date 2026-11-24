from pathlib import Path
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

BG_DARK = RGBColor(15, 23, 42)       # #0f172a
ACCENT_CYAN = RGBColor(6, 182, 212)  # #06b6d4
ACCENT_AMBER = RGBColor(245, 158, 11)
TEXT_WHITE = RGBColor(248, 250, 252)
TEXT_MUTED = RGBColor(148, 163, 184)


def add_dark_slide(prs: Presentation, title: str, subtitle: str, bullets: list[str], footer: str):
    slide = prs.slides.add_slide(prs.slide_layouts[6])  # Blank
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = BG_DARK

    # Top accent bar
    bar = slide.shapes.add_shape(1, Inches(0), Inches(0), Inches(13.333), Inches(0.12))
    bar.fill.solid()
    bar.fill.fore_color.rgb = ACCENT_CYAN
    bar.line.fill.background()

    # Title
    tb = slide.shapes.add_textbox(Inches(0.8), Inches(0.45), Inches(11.7), Inches(0.9))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(32)
    p.font.bold = True
    p.font.color.rgb = TEXT_WHITE

    # Subtitle
    sb = slide.shapes.add_textbox(Inches(0.8), Inches(1.25), Inches(11.7), Inches(0.5))
    stf = sb.text_frame
    stf.word_wrap = True
    sp = stf.paragraphs[0]
    sp.text = subtitle
    sp.font.size = Pt(16)
    sp.font.color.rgb = ACCENT_CYAN

    # Bullets
    bb = slide.shapes.add_textbox(Inches(0.9), Inches(2.0), Inches(11.5), Inches(4.6))
    btf = bb.text_frame
    btf.word_wrap = True
    for i, item in enumerate(bullets):
        bp = btf.paragraphs[0] if i == 0 else btf.add_paragraph()
        bp.text = f"•  {item}"
        bp.font.size = Pt(20)
        bp.font.color.rgb = TEXT_WHITE
        bp.space_after = Pt(14)

    # Footer
    fb = slide.shapes.add_textbox(Inches(0.8), Inches(6.9), Inches(11.7), Inches(0.4))
    ftf = fb.text_frame
    fp = ftf.paragraphs[0]
    fp.text = footer
    fp.font.size = Pt(11)
    fp.font.color.rgb = TEXT_MUTED
    fp.alignment = PP_ALIGN.RIGHT


def main():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    footer = "YAKU ALERT — UNT | Hackathon Innova Norte 3G 2026 | Desafío 3: Fenómeno El Niño"

    # Slide 1: Portada
    add_dark_slide(
        prs,
        "YAKU ALERT — UNT",
        "Plataforma Inteligente de Monitoreo, Análisis Espacial y Prevención Explicable ante Lluvias Intensas y FEN",
        [
            "Desafío 3: Gestión de riesgos y desastres ante el Fenómeno El Niño (UNT — DITT / VIN / RUI).",
            "Transformamos datos meteorológicos y geográficos en orientaciones preventivas claras para estudiantes, docentes y personal UNT.",
            "Prototipo funcional TRL 3–4 con respaldo offline, análisis espacial real (Shapely) y cumplimiento SINAGERD (Ley N.° 29664).",
        ],
        footer,
    )

    # Slide 2: El Problema
    add_dark_slide(
        prs,
        "1. El Problema en la Comunidad Universitaria",
        "Brecha entre el pronóstico técnico y la decisión preventiva cotidiana",
        [
            "Dificultad para interpretar pronósticos numéricos (mm/h, probabilidad %, acumulados) frente a lluvias intensas.",
            "Desconocimiento de qué accesos o pabellones del campus UNT podrían verse expuestos en un evento extremo.",
            "Plataformas oficiales (SENAMHI ISAAC/ARES, SIGRID, GEOQUEBRADAS, CENDEHUA) operan a escala nacional/distrital o en otras cuencas, sin foco en microescala ni continuidad académica.",
            "Necesidad de alternativas claras para sostener clases y laboratorios sin generar pánico ni falsas alarmas.",
        ],
        footer,
    )

    # Slide 3: Solución e Innovación
    add_dark_slide(
        prs,
        "2. Propuesta de Valor e Innovación: Motor Explicable",
        "No solo mostramos mapas: explicamos qué datos sustentan cada orientación",
        [
            "Motor de Decisiones Preventivas Explicables: Pronóstico -> Contexto Geográfico -> Reglas Transparentes -> Exposición -> Orientación.",
            "Cada ficha preventiva detalla: reglas activadas, fuentes, hora de actualización, limitaciones e incertidumbre.",
            "Rigor científico: separa Peligro, Exposición y Estado Preventivo; nunca convierte probabilidad de lluvia en probabilidad de huaico.",
            "Etiquetado permanente y visible entre DATOS REALES (Open-Meteo) y ESCENARIOS SIMULADOS SINTÉTICOS.",
        ],
        footer,
    )

    # Slide 4: Cómo Funciona y Arquitectura
    add_dark_slide(
        prs,
        "3. ¿Cómo Funciona? Arquitectura Modular (TRL 3–4)",
        "Stack ligero, mantenible y resiliente ante fallos de conectividad",
        [
            "Vista 1 — Monitoreo: API real Open-Meteo (forzado IPv4 + caché local offline), pronóstico 24–48h, intensidad, acumulados y humedad.",
            "Vista 2 — Mapa y Simulador Offline: Leaflet + FastAPI + Shapely 2.x calculando intersecciones reales sobre GeoJSON del campus UNT.",
            "Vista 3 — Prevención y Respuesta: Ficha explicable, protocolos preventivos, contexto informativo de quebradas de Trujillo y continuidad académica.",
            "Privacidad por diseño (Ley N.° 29733): cero registro de usuarios, cero recopilación de datos personales o GPS.",
        ],
        footer,
    )

    # Slide 5: Demostración y Pruebas Técnicas
    add_dark_slide(
        prs,
        "4. Demostración en Vivo y Verificación Técnica",
        "Software funcional ejecutable y probado con suite automatizada",
        [
            "Demo en vivo (90 s): Monitoreo real -> Simulación Escenario B — Ingreso reportado (28 mm/h de referencia, drenaje obstruido) -> Ficha Preventiva y Continuidad.",
            "9 pruebas automatizadas (pytest) aprobadas: API en vivo, fallback offline, rechazo de datos inválidos, intersección Shapely y seguridad HTTP.",
            "Plan de validación en campo listo (14–24 nov 2026): protocolo de 4 tareas con 12–20 usuarios UNT para medir comprensión y usabilidad real.",
        ],
        footer,
    )

    # Slide 6: Beneficios e Impacto
    add_dark_slide(
        prs,
        "5. Beneficios e Impacto Universitario y Regional",
        "De la Ciudad Universitaria UNT hacia comunidades vulnerables de Trujillo",
        [
            "Estudiantes y docentes: comprensión inmediata de riesgos locales, puntos de encuentro referenciales y continuidad académica virtual.",
            "Gestión universitaria: herramienta de capacitación y preparación alineada al PLANAGERD 2022–2030 y Ley N.° 29664 (SINAGERD).",
            "Escalabilidad regional: arquitectura GeoJSON intercambiable para distritos vulnerables (El Porvenir, Alto Trujillo, Víctor Larco).",
        ],
        footer,
    )

    # Slide 7: Viabilidad, Sostenibilidad y Hoja de Ruta
    add_dark_slide(
        prs,
        "6. Viabilidad, Sostenibilidad y Próximos Pasos",
        "Bajo costo operativo, código abierto y articulación institucional",
        [
            "Viabilidad técnica y económica: 100% software libre y APIs abiertas; desplegable en infraestructura existente de la UNT (DITT/OTI).",
            "Ética y límites: herramienta informativa de apoyo; no sustituye alertas oficiales de Defensa Civil UNT, SENAMHI, COEN o INDECI.",
            "Hoja de ruta post-hackathon: calibración hidrológica con especialistas UNT, validación con usuarios y piloto con Defensa Civil UNT.",
        ],
        footer,
    )

    out_path = Path(__file__).resolve().parent / "YAKU_ALERT_UNT_PITCH.pptx"
    prs.save(out_path)
    print(f"Pitch generado exitosamente en: {out_path} ({len(prs.slides)} diapositivas)")


if __name__ == "__main__":
    main()
