#!/usr/bin/env python3
"""Generate the Still brandbook as a polished, reproducible PDF."""

from __future__ import annotations

import os
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "still-brandbook.pdf"
W, H = 960, 540

PAPER = HexColor("#F3F0E8")
PAPER_RAISED = HexColor("#FFFDF8")
INK = HexColor("#171814")
SOFT = HexColor("#3D3E39")
MUTED = HexColor("#5D5E58")
RULE = HexColor("#C9C5BA")
SIGNAL = HexColor("#FF5C35")
IMPACT = HexColor("#C9F36B")
RECORD = HexColor("#9CB8FF")
WARNING = HexColor("#F6D67A")
SUCCESS = HexColor("#21633B")

FONT_ROOT = ROOT / "node_modules" / ".pnpm"
FAMILJEN = FONT_ROOT / "@expo-google-fonts+familjen-grotesk@0.4.2" / "node_modules" / "@expo-google-fonts" / "familjen-grotesk"
PLEX = FONT_ROOT / "@expo-google-fonts+ibm-plex-mono@0.4.1" / "node_modules" / "@expo-google-fonts" / "ibm-plex-mono"


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("Familjen", str(FAMILJEN / "400Regular" / "FamiljenGrotesk_400Regular.ttf")))
    pdfmetrics.registerFont(TTFont("Familjen-Medium", str(FAMILJEN / "500Medium" / "FamiljenGrotesk_500Medium.ttf")))
    pdfmetrics.registerFont(TTFont("Familjen-Semibold", str(FAMILJEN / "600SemiBold" / "FamiljenGrotesk_600SemiBold.ttf")))
    pdfmetrics.registerFont(TTFont("Familjen-Bold", str(FAMILJEN / "700Bold" / "FamiljenGrotesk_700Bold.ttf")))
    pdfmetrics.registerFont(TTFont("Plex", str(PLEX / "400Regular" / "IBMPlexMono_400Regular.ttf")))
    pdfmetrics.registerFont(TTFont("Plex-Medium", str(PLEX / "500Medium" / "IBMPlexMono_500Medium.ttf")))
    pdfmetrics.registerFont(TTFont("Plex-Semibold", str(PLEX / "600SemiBold" / "IBMPlexMono_600SemiBold.ttf")))


def text(c: canvas.Canvas, value: str, x: float, y: float, size: float, font: str = "Familjen", color=INK, tracking: float = 0) -> None:
    c.setFillColor(color)
    c.setFont(font, size)
    t = c.beginText(x, y)
    if tracking:
        t.setCharSpace(tracking)
    t.textLine(value)
    c.drawText(t)


def wrap(value: str, font: str, size: float, width: float) -> list[str]:
    lines: list[str] = []
    for paragraph in value.split("\n"):
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
        line = words[0]
        for word in words[1:]:
            test = f"{line} {word}"
            if pdfmetrics.stringWidth(test, font, size) <= width:
                line = test
            else:
                lines.append(line)
                line = word
        lines.append(line)
    return lines


def paragraph(c: canvas.Canvas, value: str, x: float, y: float, width: float, size: float = 18, leading: float | None = None, font: str = "Familjen", color=SOFT) -> float:
    leading = leading or size * 1.28
    for line in wrap(value, font, size, width):
        text(c, line, x, y, size, font, color)
        y -= leading
    return y


def label(c: canvas.Canvas, value: str, x: float, y: float, color=MUTED) -> None:
    text(c, value.upper(), x, y, 10, "Plex-Semibold", color, 1.1)


def rule(c: canvas.Canvas, x1: float, y: float, x2: float, color=INK, width: float = 1) -> None:
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y, x2, y)


def mark(c: canvas.Canvas, x: float, y: float, scale: float = 1, stroke=INK) -> None:
    c.setStrokeColor(stroke)
    c.setLineWidth(12 * scale)
    c.setLineCap(2)
    p = c.beginPath()
    p.moveTo(x + 94 * scale, y + 96 * scale)
    p.lineTo(x + 45 * scale, y + 96 * scale)
    p.curveTo(x + 28 * scale, y + 96 * scale, x + 20 * scale, y + 88 * scale, x + 20 * scale, y + 77 * scale)
    p.curveTo(x + 20 * scale, y + 66 * scale, x + 29 * scale, y + 60 * scale, x + 45 * scale, y + 60 * scale)
    p.lineTo(x + 50 * scale, y + 60 * scale)
    c.drawPath(p)
    p = c.beginPath()
    p.moveTo(x + 70 * scale, y + 60 * scale)
    p.lineTo(x + 76 * scale, y + 60 * scale)
    p.curveTo(x + 92 * scale, y + 60 * scale, x + 100 * scale, y + 54 * scale, x + 100 * scale, y + 43 * scale)
    p.curveTo(x + 100 * scale, y + 32 * scale, x + 92 * scale, y + 24 * scale, x + 75 * scale, y + 24 * scale)
    p.lineTo(x + 26 * scale, y + 24 * scale)
    c.drawPath(p)


def section_start(c: canvas.Canvas, number: str, title_value: str, subtitle: str | None = None, invert: bool = False) -> None:
    bg = INK if invert else PAPER
    fg = PAPER if invert else INK
    muted = RULE if invert else MUTED
    c.setFillColor(bg)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    label(c, number, 54, H - 52, SIGNAL if invert else MUTED)
    text(c, title_value, 54, H - 112, 45, "Familjen-Semibold", fg)
    if subtitle:
        paragraph(c, subtitle, 54, H - 153, 560, 17, 23, "Familjen", muted)
    rule(c, 54, H - 196, W - 54, RULE if invert else INK)


def footer(c: canvas.Canvas, page: int, section: str, invert: bool = False) -> None:
    color = RULE if invert else MUTED
    label(c, "STILL / BRAND SYSTEM 01.0", 54, 26, color)
    value = f"{section.upper()} / {page:02d}"
    width = pdfmetrics.stringWidth(value.upper(), "Plex-Semibold", 10)
    label(c, value, W - 54 - width, 26, color)


def next_page(c: canvas.Canvas, page: int, section: str, invert: bool = False) -> int:
    footer(c, page, section, invert)
    c.showPage()
    return page + 1


def card(c: canvas.Canvas, x: float, y: float, w: float, h: float, fill=PAPER_RAISED, stroke=INK, line=1) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(line)
    c.rect(x, y, w, h, fill=1, stroke=1)


def draw_phone(c: canvas.Canvas, x: float, y: float, w: float, h: float, variant: str) -> None:
    c.setStrokeColor(INK)
    c.setLineWidth(2)
    c.setFillColor(PAPER)
    c.roundRect(x, y, w, h, 22, fill=1, stroke=1)
    c.setFillColor(INK)
    c.roundRect(x + w * 0.34, y + h - 14, w * 0.32, 6, 3, fill=1, stroke=0)
    pad = 18
    if variant == "pause":
        label(c, "PAUSA / 00:10", x + pad, y + h - 48)
        c.setFillColor(INK)
        c.rect(x + pad, y + h - 130, 5, 54, fill=1, stroke=0)
        c.setFillColor(SIGNAL)
        c.rect(x + pad, y + h - 153, 5, 13, fill=1, stroke=0)
        text(c, "Una pausa", x + pad, y + h - 194, 25, "Familjen-Semibold")
        text(c, "antes de entrar.", x + pad, y + h - 221, 25, "Familjen-Semibold")
        label(c, "12 ENTRADAS EVITADAS", x + pad, y + 56)
        c.setFillColor(SIGNAL)
        c.roundRect(x + pad, y + 18, w - pad * 2, 28, 4, fill=1, stroke=0)
        text(c, "No entrar", x + pad + 12, y + 27, 11, "Familjen-Semibold")
    else:
        label(c, "HOY / REGISTRO", x + pad, y + h - 48)
        text(c, "02:14", x + pad, y + h - 113, 40, "Plex-Medium")
        label(c, "TIEMPO EN PANTALLA", x + pad, y + h - 135)
        rule(c, x + pad, y + h - 160, x + w - pad)
        bars = [28, 44, 34, 62, 39, 24, 51]
        for index, height in enumerate(bars):
            c.setFillColor(SIGNAL if index == 6 else INK)
            c.rect(x + pad + index * 21, y + 78, 11, height, fill=1, stroke=0)
        label(c, "18 ENTRADAS EVITADAS", x + pad, y + 43)


def build() -> None:
    register_fonts()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
    c.setTitle("Still - Brandbook")
    c.setAuthor("Still")
    page = 1

    # Cover
    c.setFillColor(SIGNAL)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    mark(c, 54, H - 200, 1.35)
    text(c, "still.", 54, 210, 104, "Familjen-Bold")
    text(c, "Una pausa que cuenta.", 58, 164, 29, "Familjen-Medium")
    label(c, "SISTEMA DE MARCA Y PRODUCTO / 2026", 58, 72, INK)
    page = next_page(c, page, "Portada")

    # Foundation
    section_start(c, "01 / FUNDAMENTO", "El intervalo registrado", "Still convierte un impulso automático en una decisión visible, medible y privada.")
    text(c, "UNA PAUSA QUE CUENTA.", 54, 300, 18, "Plex-Semibold", INK, 1)
    paragraph(c, "No promete eliminar el teléfono. Crea un intervalo breve antes de entrar, deja la salida en un toque y registra el resultado sin juzgarlo.", 54, 258, 480, 24, 31, "Familjen-Medium", INK)
    c.setFillColor(SIGNAL)
    c.rect(634, 84, 4, 232, fill=1, stroke=0)
    c.setFillColor(INK)
    c.rect(634, 334, 4, 54, fill=1, stroke=0)
    label(c, "FIRMA VISUAL", 680, 362)
    paragraph(c, "El Still cut interrumpe una línea, una palabra o una secuencia. No decora: representa el instante en que aparece una elección.", 680, 330, 220, 15, 21)
    page = next_page(c, page, "Fundamento")

    # Audience and positioning
    section_start(c, "02 / POSICIONAMIENTO", "Sereno, no complaciente")
    columns = [
        ("PARA", "Personas que sienten el gesto automático de abrir una app, pero no quieren otro sistema de culpa o productividad."),
        ("STILL ES", "Una capa de decisión que pausa, ofrece una salida clara y registra el efecto local y colectivo."),
        ("A DIFERENCIA DE", "Bloqueadores punitivos, rituales de bienestar genéricos o mecánicas de racha que sustituyen un hábito por otro."),
    ]
    for i, (head, body) in enumerate(columns):
        x = 54 + i * 290
        rule(c, x, 310, x + 242, [SIGNAL, RECORD, IMPACT][i], 6)
        label(c, head, x, 278)
        paragraph(c, body, x, 246, 242, 16, 22)
    text(c, "ELECCIÓN", 54, 90, 42, "Familjen-Semibold")
    text(c, "+ REGISTRO", 282, 90, 42, "Familjen-Semibold", SIGNAL)
    text(c, "+ PRUEBA", 559, 90, 42, "Familjen-Semibold")
    page = next_page(c, page, "Posicionamiento")

    # Landscape
    section_start(c, "03 / MERCADO", "Un territorio demasiado pulido")
    competitors = [
        ("FRICCIÓN", "one sec / Clearspace", "Respiración, demora y decisión."),
        ("BLOQUEO", "Opal / ScreenZen / Jomo", "Límites, sesiones y disciplina."),
        ("OBJETO", "Brick", "Una acción física para cambiar estado."),
        ("JUEGO", "Forest / Roots", "Crecimiento, rachas y recompensa."),
    ]
    for i, (kind, names, desc) in enumerate(competitors):
        y = 320 - i * 67
        label(c, f"0{i+1} / {kind}", 54, y)
        text(c, names, 240, y - 2, 18, "Familjen-Semibold")
        paragraph(c, desc, 510, y, 380, 14, 18)
        rule(c, 54, y - 27, 906, RULE)
    c.setFillColor(INK)
    c.rect(54, 58, 852, 52, fill=1, stroke=0)
    label(c, "HUECO DE MARCA", 72, 89, SIGNAL)
    text(c, "Decisión no punitiva + registro público del impacto.", 250, 84, 19, "Familjen-Medium", PAPER)
    page = next_page(c, page, "Mercado")

    # Anti slop
    section_start(c, "04 / DIRECCIÓN DE ARTE", "Humano por construcción", "La singularidad proviene de una regla que atraviesa producto, lenguaje y composición.", invert=True)
    left = ["Tipografía con tensión editorial", "Líneas, cortes y secuencias", "Datos honestos y fechados", "Color usado como función"]
    right = ["Glows y gradientes atmosféricos", "Orbes, hojas y metáforas zen", "Cuadrículas de tarjetas clonadas", "Promesas de transformación total"]
    label(c, "HACER", 54, 304, IMPACT)
    label(c, "EVITAR", 520, 304, SIGNAL)
    for i, item in enumerate(left):
        text(c, f"0{i+1}", 54, 266 - i * 44, 12, "Plex-Semibold", IMPACT)
        text(c, item, 92, 264 - i * 44, 17, "Familjen-Medium", PAPER)
    for i, item in enumerate(right):
        text(c, "×", 520, 266 - i * 44, 16, "Plex-Semibold", SIGNAL)
        text(c, item, 552, 264 - i * 44, 17, "Familjen-Medium", PAPER)
    page = next_page(c, page, "Dirección de arte", True)

    # Logo
    section_start(c, "05 / LOGO", "Interval S")
    mark(c, 54, 90, 2.15)
    paragraph(c, "Dos trazos forman una S. El vacío central es el intervalo: pequeño, deliberado y siempre visible.", 360, 314, 450, 23, 31, "Familjen-Medium", INK)
    label(c, "ÁREA DE RESPETO", 360, 205)
    paragraph(c, "Mantener al menos el ancho del corte alrededor de la marca. Tamaño mínimo recomendado: 20 px digital / 7 mm impreso.", 360, 176, 450, 15, 21)
    label(c, "VERSIONES", 360, 104)
    text(c, "Tinta / papel", 360, 76, 15, "Plex-Medium")
    text(c, "Papel / tinta", 535, 76, 15, "Plex-Medium")
    text(c, "Tinta / signal", 710, 76, 15, "Plex-Medium")
    page = next_page(c, page, "Logo")

    # Color
    section_start(c, "06 / COLOR", "Una paleta de estados")
    swatches = [
        ("PAPER", "F3F0E8", PAPER, INK), ("INK", "171814", INK, PAPER), ("SIGNAL", "FF5C35", SIGNAL, INK),
        ("IMPACT", "C9F36B", IMPACT, INK), ("RECORD", "9CB8FF", RECORD, INK), ("WARNING", "F6D67A", WARNING, INK),
    ]
    for i, (name, value, fill, fg) in enumerate(swatches):
        x = 54 + (i % 3) * 284
        y = 226 if i < 3 else 76
        c.setFillColor(fill)
        c.rect(x, y, 250, 118, fill=1, stroke=0)
        label(c, name, x + 16, y + 84, fg)
        text(c, f"#{value}", x + 16, y + 22, 18, "Plex-Medium", fg)
    label(c, "CONTRASTE", 54, 374)
    text(c, "Tinta/papel 15.66:1   Muted/papel 5.75:1   Tinta/signal 5.81:1", 176, 372, 13, "Plex", MUTED)
    page = next_page(c, page, "Color")

    # Typography
    section_start(c, "07 / TIPOGRAFÍA", "Familjen + Plex Mono")
    text(c, "Una pausa", 54, 298, 76, "Familjen-Semibold")
    text(c, "que cuenta.", 54, 232, 76, "Familjen-Semibold", SIGNAL)
    label(c, "FAMILJEN GROTESK / 400 500 600 700", 58, 194)
    text(c, "00:10 / 18 ENTRADAS / 80%", 54, 128, 28, "Plex-Medium")
    label(c, "IBM PLEX MONO / 400 500 600", 58, 92)
    paragraph(c, "Familjen lleva la voz humana y editorial. Plex Mono registra tiempo, estados, importes y procedencia. No usar una serif como atajo de calma.", 590, 304, 315, 17, 23)
    page = next_page(c, page, "Tipografía")

    # Composition
    section_start(c, "08 / COMPOSICIÓN", "Ritmo antes que contenedor")
    label(c, "RETÍCULA", 54, 328)
    for i in range(7):
        c.setStrokeColor(RULE)
        c.line(54 + i * 68, 84, 54 + i * 68, 302)
    for i in range(5):
        c.line(54, 84 + i * 54, 462, 84 + i * 54)
    c.setStrokeColor(SIGNAL)
    c.setLineWidth(6)
    c.line(258, 84, 258, 180)
    c.line(258, 198, 258, 302)
    label(c, "PRINCIPIOS", 540, 328)
    rules = ["Una idea dominante por pantalla", "Divisores en lugar de tarjetas", "Radios de 4-8 px, no píldoras", "Alineación óptica, no simetría automática", "El corte marca una decisión"]
    for i, value in enumerate(rules):
        text(c, f"0{i+1}", 540, 286 - i * 42, 11, "Plex-Semibold", SIGNAL)
        text(c, value, 578, 284 - i * 42, 16, "Familjen-Medium")
    page = next_page(c, page, "Composición")

    # UI components
    section_start(c, "09 / SISTEMA DE PRODUCTO", "Controles que declaran su función")
    label(c, "ACCIÓN PRIMARIA / SALIDA", 54, 325)
    c.setFillColor(SIGNAL)
    c.roundRect(54, 260, 360, 52, 4, fill=1, stroke=0)
    text(c, "No entrar", 72, 278, 17, "Familjen-Semibold")
    label(c, "ACCIÓN SECUNDARIA / EXCEPCIÓN", 54, 218)
    card(c, 54, 152, 360, 52, PAPER, INK)
    text(c, "Usar 1 pase · 10 min", 72, 170, 15, "Plex-Medium")
    label(c, "REGISTRO", 520, 325)
    rule(c, 520, 306, 890)
    text(c, "18", 520, 229, 62, "Plex-Medium")
    label(c, "ENTRADAS EVITADAS", 650, 260)
    rule(c, 520, 210, 890)
    text(c, "04:26", 520, 158, 31, "Plex-Medium", SIGNAL)
    label(c, "TIEMPO ESTIMADO", 650, 171)
    label(c, "ICONOGRAFÍA", 520, 108)
    paragraph(c, "Trazos de 1.75 px, extremos rectos y significado literal. El estado nunca depende sólo del icono.", 520, 84, 370, 12, 16, "Familjen", MUTED)
    page = next_page(c, page, "Sistema de producto")

    # Mobile
    section_start(c, "10 / APP", "La pausa es el producto")
    draw_phone(c, 54, 60, 220, 350, "today")
    draw_phone(c, 324, 60, 220, 350, "pause")
    label(c, "01 / REGISTRAR", 610, 330)
    paragraph(c, "Hoy presenta hechos, no una nota de conducta.", 610, 302, 270, 18, 24)
    label(c, "02 / INTERRUMPIR", 610, 226)
    paragraph(c, "No entrar es la acción principal y requiere un solo toque.", 610, 198, 270, 18, 24)
    label(c, "03 / EXPLICAR", 610, 122)
    paragraph(c, "Cada estimación, pase e importe declara origen, duración y estado.", 610, 94, 270, 18, 24)
    page = next_page(c, page, "App")

    # Web
    section_start(c, "11 / WEB", "Demostrar, no prometer")
    c.setStrokeColor(INK)
    c.setLineWidth(2)
    c.rect(54, 82, 548, 300, fill=0, stroke=1)
    c.setFillColor(INK)
    c.rect(54, 346, 548, 36, fill=1, stroke=0)
    mark(c, 70, 344, .28, PAPER)
    label(c, "UNA PAUSA QUE CUENTA", 80, 310)
    text(c, "Elige antes de entrar.", 80, 260, 33, "Familjen-Semibold")
    paragraph(c, "Una secuencia de 10 segundos. Una salida en un toque. Un registro que permanece local.", 80, 224, 330, 13, 18)
    c.setFillColor(SIGNAL)
    c.rect(80, 126, 190, 38, fill=1, stroke=0)
    label(c, "VER ESTADO DE LA BETA", 95, 140, INK)
    label(c, "ARQUITECTURA", 660, 345)
    for i, value in enumerate(["PROMESA", "MECÁNICA", "REGISTRO", "IMPACTO", "PRIVACIDAD"]):
        rule(c, 660, 310 - i * 48, 895, SIGNAL if i == 1 else RULE, 4 if i == 1 else 1)
        label(c, f"0{i+1} / {value}", 660, 290 - i * 48)
    page = next_page(c, page, "Web")

    # Voice
    section_start(c, "12 / VOZ", "Clara, precisa, sin sermón")
    pairs = [
        ("DECIR", "Una pausa antes de entrar.", "NO DECIR", "¿De verdad vas a perder el tiempo?"),
        ("DECIR", "No entrar", "NO DECIR", "Sé fuerte"),
        ("DECIR", "Tiempo estimado", "NO DECIR", "Tiempo recuperado"),
        ("DECIR", "El pase sigue disponible.", "NO DECIR", "Fallaste al desbloquear."),
    ]
    for i, (a, b, d, e) in enumerate(pairs):
        y = 322 - i * 67
        label(c, a, 54, y, SUCCESS)
        text(c, b, 130, y - 2, 18, "Familjen-Medium")
        label(c, d, 510, y, SIGNAL)
        text(c, e, 595, y - 2, 16, "Familjen-Medium", MUTED)
        rule(c, 54, y - 29, 906, RULE)
    label(c, "ESPAÑOL", 54, 68)
    text(c, "Internacional, tuteo, verbos directos y estados verificables.", 154, 66, 15, "Plex", MUTED)
    page = next_page(c, page, "Voz")

    # Imagery
    section_start(c, "13 / IMAGEN Y MOVIMIENTO", "Evidencia en vez de atmósfera")
    card(c, 54, 82, 260, 250, IMPACT, IMPACT, 0)
    label(c, "IMPACTO / PRUEBA", 72, 306, INK)
    text(c, "$1.248", 72, 224, 50, "Plex-Medium")
    label(c, "ASIGNADO / SEMANA 34", 72, 194, INK)
    paragraph(c, "Recibos, fechas, totales y manos haciendo. Nunca naturaleza genérica como sustituto de evidencia.", 72, 148, 214, 14, 19, "Familjen", INK)
    label(c, "MOVIMIENTO", 380, 306)
    motions = [("ENTRADA", "180 ms", "Opacity + 8 px"), ("CORTE", "240 ms", "La línea se separa"), ("DATO", "320 ms", "Conteo una sola vez"), ("REDUCIDO", "0 ms", "Cambio inmediato")]
    for i, (a, b, d) in enumerate(motions):
        y = 266 - i * 48
        text(c, a, 380, y, 11, "Plex-Semibold", MUTED)
        text(c, b, 500, y, 15, "Plex-Medium", SIGNAL)
        text(c, d, 600, y, 15, "Familjen-Medium")
        rule(c, 380, y - 18, 900, RULE)
    page = next_page(c, page, "Imagen y movimiento")

    # Campaign
    section_start(c, "14 / CAMPAÑA", "La pausa, puesta en escena")
    campaigns = [
        (SIGNAL, "10 segundos.\nUna decisión.", "INTERVENCIÓN"),
        (INK, "Tu día,\nsin puntuación.", "REGISTRO"),
        (IMPACT, "Cada semana,\nuna prueba.", "IMPACTO"),
    ]
    for i, (fill, headline, tag) in enumerate(campaigns):
        x = 54 + i * 286
        fg = PAPER if fill == INK else INK
        c.setFillColor(fill)
        c.rect(x, 80, 252, 270, fill=1, stroke=0)
        mark(c, x + 14, 260, .42, fg)
        yy = 205
        for line in headline.split("\n"):
            text(c, line, x + 18, yy, 29, "Familjen-Semibold", fg)
            yy -= 34
        label(c, tag, x + 18, 105, fg)
    page = next_page(c, page, "Campaña")

    # Governance and sources
    section_start(c, "15 / GOBERNANZA", "Una regla antes de publicar")
    checks = ["¿La pieza muestra una elección o sólo decora?", "¿Los datos indican fecha, estado y procedencia?", "¿La salida principal es clara y no punitiva?", "¿La jerarquía funciona sin tarjetas ni efectos?", "¿El contraste y el movimiento respetan accesibilidad?", "¿El Still cut aparece con intención?"]
    for i, item in enumerate(checks):
        y = 322 - i * 42
        c.setStrokeColor(SIGNAL)
        c.setLineWidth(2)
        c.rect(54, y - 8, 14, 14, fill=0, stroke=1)
        text(c, item, 86, y - 6, 17, "Familjen-Medium")
    label(c, "FUENTES PRINCIPALES", 566, 322)
    sources = [
        "one-sec.app / opalapp.com / screenzen.co",
        "jomo.so / getroots.app / getbrick.com",
        "forestapp.cc / ecosia.org/transparency",
        "w3.org/TR/WCAG22 / Apple HIG Accessibility",
        "Creative Bloq - Graphic design trends 2026",
    ]
    for i, source in enumerate(sources):
        paragraph(c, source, 566, 292 - i * 39, 336, 11, 15, "Plex", MUTED)
    c.setFillColor(SIGNAL)
    c.rect(0, 0, W, 52, fill=1, stroke=0)
    text(c, "STILL / UNA PAUSA QUE CUENTA.", 54, 18, 15, "Plex-Semibold", INK)
    label(c, "GOBERNANZA / 16", 786, 20, INK)
    c.save()


if __name__ == "__main__":
    build()
    print(OUT)
