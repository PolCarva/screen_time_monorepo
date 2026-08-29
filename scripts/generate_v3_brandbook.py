from pathlib import Path
from textwrap import shorten

from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "Still-Soft-Field-Brandbook.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

W, H = 960, 540
M = 48

C = {
    "chalk": HexColor("#F1EFE8"),
    "raised": HexColor("#F8F6EF"),
    "graphite": HexColor("#242826"),
    "soft": HexColor("#4E5451"),
    "mineral": HexColor("#697F8C"),
    "mineral_light": HexColor("#A7B5BA"),
    "peach": HexColor("#D39A83"),
    "fog": HexColor("#D9DEDC"),
    "success": HexColor("#2F6B4A"),
    "warning": HexColor("#9A6A27"),
    "danger": HexColor("#A9473E"),
    "focus": HexColor("#315CBE"),
    "white": HexColor("#FFFDF8"),
}

FONT_ROOT = ROOT / "apps" / "web" / "node_modules" / "@expo-google-fonts" / "recursive"
pdfmetrics.registerFont(TTFont("Recursive", str(FONT_ROOT / "400Regular" / "Recursive_400Regular.ttf")))
pdfmetrics.registerFont(TTFont("Recursive-Medium", str(FONT_ROOT / "500Medium" / "Recursive_500Medium.ttf")))
pdfmetrics.registerFont(TTFont("Recursive-Bold", str(FONT_ROOT / "700Bold" / "Recursive_700Bold.ttf")))


def bg(c, color):
    c.setFillColor(color)
    c.rect(0, 0, W, H, stroke=0, fill=1)


def set_font(c, size, weight="regular"):
    name = {"regular": "Recursive", "medium": "Recursive-Medium", "bold": "Recursive-Bold"}[weight]
    c.setFont(name, size)


def label(c, x, y, value, color=None, size=9):
    c.setFillColor(color or C["soft"])
    set_font(c, size, "bold")
    c.drawString(x, y, value.upper())


def title(c, x, y, value, color=None, size=42, max_width=None, leading=None):
    return wrapped(c, x, y, value, size, color or C["graphite"], max_width or (W - x - M), leading or size * 0.96, "medium")


def wrapped(c, x, y, value, size=15, color=None, width=360, leading=None, weight="regular", max_lines=None):
    color = color or C["soft"]
    leading = leading or size * 1.35
    words = value.split()
    lines, current = [], ""
    font_name = {"regular": "Recursive", "medium": "Recursive-Medium", "bold": "Recursive-Bold"}[weight]
    for word in words:
        candidate = word if not current else current + " " + word
        if pdfmetrics.stringWidth(candidate, font_name, size) <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    if max_lines and len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = shorten(lines[-1], width=max(6, len(lines[-1]) - 2), placeholder="...")
    c.setFillColor(color)
    set_font(c, size, weight)
    for i, line_text in enumerate(lines):
        c.drawString(x, y - i * leading, line_text)
    return y - len(lines) * leading


def bullets(c, x, y, items, width=360, size=13, color=None, gap=8):
    color = color or C["soft"]
    cursor = y
    for item in items:
        c.setFillColor(C["peach"])
        c.circle(x + 3, cursor + 4, 2.3, stroke=0, fill=1)
        cursor = wrapped(c, x + 16, cursor + 9, item, size, color, width - 16, size * 1.3) - gap
    return cursor


def rule(c, x1, y, x2, color=None, width=0.8):
    c.setStrokeColor(color or C["fog"])
    c.setLineWidth(width)
    c.line(x1, y, x2, y)


def mark(c, x, y, size=58, dark=False):
    unit = size / 12
    ink = C["chalk"] if dark else C["graphite"]
    modules = [
        (0, 0, ink), (5.6, 0, ink),
        (-1.1, 3.15, C["mineral_light"] if dark else C["mineral"]),
        (6.7, 3.15, C["peach"]),
        (0, 6.3, ink), (5.6, 6.3, ink),
    ]
    for dx, dy, fill in modules:
        c.setFillColor(fill)
        c.roundRect(x + dx * unit, y - dy * unit, 4.4 * unit, 1.85 * unit, 0.38 * unit, stroke=0, fill=1)


def field(c, x, y, width, height, dark=False, split=False, impact=False):
    if impact:
        values = [18, 31, 24, 43, 37, 58, 52, 74, 66, 88]
        gap = 7
        bw = (width - gap * 9) / 10
        for i, value in enumerate(values):
            bh = height * value / 100
            c.setFillColor(C["peach"] if i == 9 else C["mineral_light"])
            c.roundRect(x + i * (bw + gap), y, bw, bh, 2, stroke=0, fill=1)
        return
    cols, rows, gap = 7, 5, 7
    cw = (width - gap * (cols - 1)) / cols
    ch = (height - gap * (rows - 1)) / rows
    for row in range(rows):
        for col in range(cols):
            active = row < 3 + (1 if col % 3 == 0 else 0)
            fill = (C["mineral_light"] if dark else C["mineral"]) if active else (C["soft"] if dark else C["fog"])
            if row == 2 and col == 5:
                fill = C["peach"]
            shift = 0
            if split:
                shift = (-10 if col < 3 else 10) * (1.5 if row == 3 else 1)
            c.setFillColor(fill)
            c.roundRect(x + col * (cw + gap) + shift, y + (rows - 1 - row) * (ch + gap), cw, ch, 2.5, stroke=0, fill=1)
    if split:
        c.setStrokeColor(C["mineral_light"] if dark else C["fog"])
        c.line(x + width / 2, y - 10, x + width / 2, y + height + 10)


def image_cover(c, path, x, y, width, height, align="center"):
    image = ImageReader(str(path))
    iw, ih = image.getSize()
    scale = max(width / iw, height / ih)
    dw, dh = iw * scale, ih * scale
    dx = x + (width - dw) / 2
    if align == "top":
        dy = y + height - dh
    elif align == "bottom":
        dy = y
    else:
        dy = y + (height - dh) / 2
    c.saveState()
    clip = c.beginPath()
    clip.rect(x, y, width, height)
    c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(image, dx, dy, width=dw, height=dh, mask="auto")
    c.restoreState()


def image_contain(c, path, x, y, width, height):
    image = ImageReader(str(path))
    iw, ih = image.getSize()
    scale = min(width / iw, height / ih)
    dw, dh = iw * scale, ih * scale
    c.drawImage(image, x + (width - dw) / 2, y + (height - dh) / 2, width=dw, height=dh, mask="auto")


def footer(c, page, dark=False, section="Still / Soft Field v3"):
    color = C["mineral_light"] if dark else C["soft"]
    label(c, M, 24, section, color, 7)
    c.setFillColor(color)
    set_font(c, 8, "bold")
    c.drawRightString(W - M, 24, f"{page:02d}")


def start(c, page, section, dark=False, background=None):
    bg(c, background or (C["graphite"] if dark else C["chalk"]))
    footer(c, page, dark, section)
    label(c, M, H - 42, section, C["mineral_light"] if dark else C["soft"])


def key_value(c, x, y, key, value, width=300, dark=False):
    label(c, x, y, key, C["mineral_light"] if dark else C["soft"], 8)
    return wrapped(c, x, y - 20, value, 15, C["chalk"] if dark else C["graphite"], width, 19, "medium")


def chip(c, x, y, value, fill, ink):
    set_font(c, 9, "bold")
    width = pdfmetrics.stringWidth(value.upper(), "Recursive-Bold", 9) + 22
    c.setFillColor(fill)
    c.roundRect(x, y, width, 24, 4, stroke=0, fill=1)
    c.setFillColor(ink)
    c.drawString(x + 11, y + 8, value.upper())
    return width


def phone(c, x, y, width, height, dark=False, mode="today"):
    c.saveState()
    c.setShadow = lambda *args, **kwargs: None
    c.setFillColor(C["graphite"] if dark else C["raised"])
    c.setStrokeColor(C["graphite"])
    c.roundRect(x, y, width, height, width * 0.08, stroke=1, fill=1)
    c.setFillColor(C["mineral_light"])
    c.roundRect(x + width / 2 - 25, y + height - 17, 50, 4, 2, stroke=0, fill=1)
    px, top = x + 22, y + height - 42
    ink = C["chalk"] if dark else C["graphite"]
    soft = C["mineral_light"] if dark else C["soft"]
    if mode == "intervention":
        label(c, px, top, "Instagram", ink, 7)
        label(c, x + width - 62, top, "00:01", ink, 7)
        field(c, px + 10, y + height - 155, width - 64, 82, dark=True, split=True)
        wrapped(c, px, y + height - 190, "Instagram opened 7 times today.", 19, ink, width - 44, 21, "medium")
        wrapped(c, px, y + height - 248, "What do you want from the next 10 minutes?", 8.5, soft, width - 44, 11)
        c.setFillColor(C["chalk"])
        c.roundRect(px, y + 92, width - 44, 34, 3, stroke=0, fill=1)
        c.setFillColor(C["graphite"])
        set_font(c, 9, "bold")
        c.drawCentredString(x + width / 2, y + 104, "Go back")
        rule(c, px, y + 72, x + width - 22, C["soft"])
        wrapped(c, px, y + 51, "Use 1 pass - 10 min", 9, ink, width - 70, 11, "bold")
    elif mode == "impact":
        label(c, px, top, "Impact / weekly record", soft, 7)
        label(c, px, top - 34, "Available fund", soft, 7)
        wrapped(c, px, top - 62, "$18,421", 29, ink, width - 44, 30, "medium")
        wrapped(c, px, top - 101, "Estimated until weekly close", 8.5, soft, width - 44, 11)
        field(c, px, y + height - 240, width - 44, 70, impact=True)
        rows = [("Amount", "estimated"), ("Allocation", "open vote"), ("Proof", "after transfer")]
        yy = y + height - 278
        for key, value in rows:
            rule(c, px, yy + 13, x + width - 22, C["fog"])
            wrapped(c, px, yy, key, 10, ink, 100, 12, "bold")
            c.setFillColor(soft)
            set_font(c, 9, "regular")
            c.drawRightString(x + width - 22, yy, value)
            yy -= 35
    else:
        label(c, px, top, "29 Aug", soft, 7)
        wrapped(c, px, top - 56, "42", 42, ink, 80, 42, "medium")
        wrapped(c, px + 76, top - 42, "minutes", 10, ink, 100, 12, "bold")
        wrapped(c, px + 76, top - 58, "returned today", 9, soft, 120, 11)
        rule(c, px, top - 90, x + width - 22)
        wrapped(c, px, top - 115, "6 apps protected", 10, ink, 110, 12, "medium")
        wrapped(c, px + 135, top - 115, "14 opens avoided", 10, ink, 120, 12, "medium")
        field(c, px, y + 120, width - 44, 95)
        rule(c, px, y + 95, x + width - 22)
        label(c, px, y + 72, "Next", soft, 7)
        wrapped(c, px, y + 49, "Review protected apps", 10, ink, width - 44, 12, "bold")
    c.restoreState()


c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
c.setTitle("Still - Soft Field v3 Brandbook")
c.setAuthor("Still")

page = 1

# 01 Cover
bg(c, C["graphite"])
mark(c, M, H - 66, 68, True)
title(c, M, 355, "Still", C["chalk"], 104, 420, 92)
label(c, M, 280, "Brandbook / v3.0 / 29 August 2026", C["mineral_light"])
wrapped(c, M, 188, "Quiet technology for the moment before an automatic opening.", 24, C["mineral_light"], 520, 30, "regular")
field(c, 610, 94, 270, 210, dark=True, split=True)
footer(c, page, True, "Still / Brandbook")
c.showPage(); page += 1

# 02 Navigation
start(c, page, "How to use this book")
title(c, M, 445, "One system, four layers.", size=48, max_width=520)
wrapped(c, M, 360, "Use the system from left to right. Strategy decides what belongs. Identity makes it recognizable. Product makes it useful. Communication makes it repeatable.", 18, C["soft"], 520, 26)
items = [("01", "Strategy", "Purpose, position, principles"), ("02", "Identity", "Mark, type, color, field"), ("03", "Experience", "Product, web, motion, access"), ("04", "Expression", "Voice, imagery, campaign, QA")]
for i, (num, name, desc) in enumerate(items):
    x = M + i * 220
    label(c, x, 205, num, C["peach"])
    wrapped(c, x, 172, name, 21, C["graphite"], 180, 23, "medium")
    wrapped(c, x, 137, desc, 12, C["soft"], 170, 16)
footer(c, page)
c.showPage(); page += 1

# 03 Essence
start(c, page, "01 / Strategy", True)
label(c, M, 430, "Brand essence", C["peach"])
title(c, M, 376, "Make the automatic moment visible. Then give the choice back.", C["chalk"], 48, 710, 49)
wrapped(c, M, 214, "Still is not a blocker, a detox ritual, a score or a productivity judge. It is a quiet instrument for noticing what just happened and choosing what happens next.", 17, C["mineral_light"], 590, 24)
mark(c, 760, 188, 92, True)
footer(c, page, True, "01 / Strategy")
c.showPage(); page += 1

# 04 Positioning
start(c, page, "01 / Strategy")
title(c, M, 438, "Positioning that holds up in product.", size=43, max_width=580)
key_value(c, M, 330, "For", "People who open a few apps by reflex and want a brief, non-punitive interruption.")
key_value(c, 360, 330, "Still is", "A quiet attention utility that inserts one conscious second, records the result locally and turns verified revenue into a visible impact record.", 500)
key_value(c, M, 190, "Unlike", "Detox products, streak systems, app blockers and motivational wellness brands.")
key_value(c, 360, 190, "Because", "The intervention preserves agency: go back in one tap or continue intentionally for a clear duration.", 500)
footer(c, page)
c.showPage(); page += 1

# 05 Personality
start(c, page, "01 / Strategy")
title(c, M, 438, "Warm in posture. Precise in evidence.", size=44, max_width=640)
traits = [
    ("Calm", "Never urgent or euphoric", "Not meditative"),
    ("Human", "Respectful, concrete, non-moral", "Not cute"),
    ("Precise", "Measured states and provenance", "Not clinical"),
    ("Contemporary", "Digital, material, reduced", "Not trend-led"),
]
for i, (trait, is_, isnt) in enumerate(traits):
    x = M + i * 220
    c.setFillColor(C["raised"])
    c.rect(x, 152, 190, 180, stroke=0, fill=1)
    label(c, x + 18, 300, f"0{i+1}", C["mineral"])
    wrapped(c, x + 18, 260, trait, 23, C["graphite"], 150, 24, "medium")
    wrapped(c, x + 18, 218, is_, 12, C["soft"], 152, 16)
    label(c, x + 18, 176, isnt, C["peach"], 7)
footer(c, page)
c.showPage(); page += 1

# 06 Market
start(c, page, "01 / Strategy", True)
title(c, M, 438, "Learn from behavior. Refuse the category costume.", C["chalk"], 42, 710)
bullets(c, M, 346, [
    "one sec: brief friction changes automatic behavior; do not copy breathing or dopamine language.",
    "Brick: one clear action explains the product; do not copy the physical object or 'take back your time'.",
    "reMarkable and Teenage Engineering: material restraint plus functional color; do not simulate paper or retro controls.",
], 405, 13, C["mineral_light"])
bullets(c, 510, 346, [
    "Stripe Climate and Watershed: show source, state and proof; avoid climate-tech spectacle.",
    "Dear Data and MIT physicalization: data can feel personal or physical only when every mark is explainable.",
    "Apple HIG: motion is feedback and state change; never loop the interruption.",
], 405, 13, C["mineral_light"])
footer(c, page, True, "01 / Strategy")
c.showPage(); page += 1

# 07 Saturated category
start(c, page, "01 / Strategy")
title(c, M, 438, "What makes attention products look interchangeable.", size=42, max_width=680)
bad = ["Purple-blue glow", "Glass panels", "Rounded cards in cards", "Generic wellness copy", "Scores and streaks", "Leaf or planet shorthand", "Decorative 3D blob", "Hero plus three feature cards"]
for i, item in enumerate(bad):
    x = M + (i % 4) * 220
    y = 306 - (i // 4) * 112
    c.setStrokeColor(C["fog"]); c.setLineWidth(1)
    c.rect(x, y, 190, 78, stroke=1, fill=0)
    c.setFillColor(C["danger"]); c.line(x + 16, y + 56, x + 28, y + 44); c.line(x + 28, y + 56, x + 16, y + 44)
    wrapped(c, x + 42, y + 55, item, 12.5, C["graphite"], 135, 15, "medium")
footer(c, page)
c.showPage(); page += 1

# 08 Explorations
start(c, page, "02 / Art direction")
title(c, M, 438, "Three systems. One selected direction.", size=42, max_width=620)
boards = [
    ("01", "Quiet Instrument", ROOT / "brand/v3/explorations/01-quiet-instrument.png"),
    ("02", "Soft Field / selected", ROOT / "brand/v3/explorations/02-soft-field.png"),
    ("03", "Luminous Threshold", ROOT / "brand/v3/explorations/03-luminous-threshold.png"),
]
for i, (num, name, path) in enumerate(boards):
    x = M + i * 296
    image_cover(c, path, x, 125, 270, 170)
    label(c, x, 102, f"{num} / {name}", C["mineral"] if i == 1 else C["soft"], 7)
    if i == 1:
        c.setStrokeColor(C["peach"]); c.setLineWidth(3); c.rect(x - 3, 122, 276, 176, stroke=1, fill=0)
footer(c, page, section="02 / Art direction")
c.showPage(); page += 1

# 09 Creative concept
start(c, page, "02 / Art direction", True)
field(c, 540, 125, 340, 260, dark=True, split=True)
label(c, M, 430, "Selected concept", C["peach"])
title(c, M, 376, "Soft Field", C["chalk"], 58, 420)
wrapped(c, M, 300, "Automatic behavior is dense. One second opens space. The choice becomes visible without turning the person into a score.", 18, C["mineral_light"], 390, 26)
wrapped(c, M, 176, "The field is never wallpaper. If a module does not encode progress, choice, allocation or transition, remove it.", 14, C["chalk"], 390, 20, "medium")
footer(c, page, True, "02 / Art direction")
c.showPage(); page += 1

# 10 Mark
start(c, page, "02 / Identity")
title(c, M, 438, "Field Aperture / 06", size=44, max_width=510)
mark(c, 94, 238, 156)
wrapped(c, 300, 341, "Six measured modules. The middle pair opens. Mineral records the field; peach records an intentional continuation.", 17, C["soft"], 465, 24)
bullets(c, 300, 246, [
    "12 x 12 unit construction; module 4.4 x 1.85 units.",
    "One-color fallback: all graphite or all chalk.",
    "At 32 px: align to whole pixels and remove optical radius.",
    "Never add clock, leaf, phone, brain, pause bars, shadow or gradient.",
], 500, 12.5)
label(c, 94, 138, "The negative space is the pause", C["mineral"])
footer(c, page, section="02 / Identity")
c.showPage(); page += 1

# 11 Logo rules
start(c, page, "02 / Identity", True)
mark(c, M, 414, 72, True)
wrapped(c, 139, 450, "Still", 45, C["chalk"], 220, 45, "medium")
label(c, M, 340, "Clear space", C["peach"])
wrapped(c, M, 310, "Keep one module height around every side. Minimum digital mark: 24 px. Minimum lockup: 88 px.", 14, C["mineral_light"], 360, 20)
label(c, 510, 340, "Correct", C["mineral_light"])
bullets(c, 510, 310, ["Chalk on graphite", "Graphite on chalk", "Single-color where necessary"], 360, 13, C["chalk"])
label(c, 510, 190, "Never", C["peach"])
bullets(c, 510, 160, ["Stretch or rotate", "Recolor individual modules", "Put inside another tile", "Use the field as decoration"], 360, 13, C["chalk"])
footer(c, page, True, "02 / Identity")
c.showPage(); page += 1

# 12 App icon
start(c, page, "02 / Identity")
title(c, M, 438, "One icon. Native masks only.", size=43, max_width=600)
icon = ROOT / "brand/v3/identity/app-icon-512.png"
image_contain(c, icon, 70, 150, 220, 220)
image_contain(c, ROOT / "brand/v3/identity/app-icon-dark.png", 340, 150, 220, 220)
image_contain(c, ROOT / "brand/v3/identity/icon-study.png", 620, 132, 280, 250)
label(c, 85, 126, "Primary / chalk", C["soft"])
label(c, 355, 126, "Dark surface", C["soft"])
label(c, 635, 126, "12 explored constructions", C["soft"])
footer(c, page, section="02 / Identity")
c.showPage(); page += 1

# 13 Color
start(c, page, "02 / Visual system")
title(c, M, 438, "Warm neutral. Mineral signal. Human exception.", size=40, max_width=760)
swatches = [
    ("Chalk", "#F1EFE8", C["chalk"], C["graphite"]),
    ("Graphite", "#242826", C["graphite"], C["chalk"]),
    ("Mineral", "#697F8C", C["mineral"], C["white"]),
    ("Peach", "#D39A83", C["peach"], C["graphite"]),
    ("Fog", "#D9DEDC", C["fog"], C["graphite"]),
]
for i, (name, value, fill, ink) in enumerate(swatches):
    x = M + i * 174
    c.setFillColor(fill); c.rect(x, 180, 150, 150, stroke=0, fill=1)
    wrapped(c, x + 14, 226, name, 15, ink, 120, 17, "bold")
    wrapped(c, x + 14, 202, value, 10, ink, 120, 12)
label(c, M, 142, "Environmental meaning comes from evidence, never from a green wash.", C["soft"])
footer(c, page, section="02 / Visual system")
c.showPage(); page += 1

# 14 Functional color
start(c, page, "02 / Visual system", True)
title(c, M, 438, "Brand accents do not impersonate system states.", C["chalk"], 40, 750)
states = [("Success", "#2F6B4A", "Confirmed or complete", C["success"]), ("Warning", "#9A6A27", "Pending or expiring", C["warning"]), ("Danger", "#A9473E", "Destructive or error", C["danger"]), ("Focus", "#315CBE", "Focus ring only", C["focus"])]
for i, (name, value, use, fill) in enumerate(states):
    x = M + i * 220
    c.setFillColor(fill); c.rect(x, 220, 190, 82, stroke=0, fill=1)
    wrapped(c, x + 14, 270, name, 16, C["white"], 160, 18, "bold")
    wrapped(c, x + 14, 246, value, 9, C["white"], 160, 11)
    wrapped(c, x, 188, use, 12, C["mineral_light"], 185, 16)
wrapped(c, M, 125, "Never rely on color alone. Pair every state with a word, icon or position. Contrast targets: AA for all UI text and visible focus on web.", 15, C["chalk"], 810, 21, "medium")
footer(c, page, True, "02 / Visual system")
c.showPage(); page += 1

# 15 Typography
start(c, page, "02 / Visual system")
title(c, M, 438, "Recursive is the entire typographic voice.", size=42, max_width=690)
wrapped(c, M, 310, "Aa 42", 76, C["graphite"], 340, 72, "medium")
label(c, M, 232, "Display / MONO 0 / CASL 0.08 / 520-600", C["mineral"])
wrapped(c, M, 198, "Short product statements. Never grandiose marketing claims.", 14, C["soft"], 390, 20)
wrapped(c, 500, 310, "00:01  $1.84  7/14", 31, C["graphite"], 390, 38, "bold")
label(c, 500, 232, "Data / MONO 1 / CASL 0 / 500-650", C["mineral"])
wrapped(c, 500, 198, "Time, money, counts and IDs use tabular alignment.", 14, C["soft"], 390, 20)
rule(c, M, 138, W - M)
wrapped(c, M, 108, "UI stays linear and steady. Human notes may use CASL 0.16 rarely. Never animate axes while text is being read.", 14, C["soft"], 800, 20)
footer(c, page, section="02 / Visual system")
c.showPage(); page += 1

# 16 Type scale
start(c, page, "02 / Visual system", True)
title(c, M, 438, "A scale for hierarchy, not spectacle.", C["chalk"], 42, 620)
rows = [("display-hero", "58 / 72-152", ".92"), ("display", "44 / 48-92", ".98"), ("heading-1", "32 / 52", "1.04"), ("heading-2", "24 / 36", "1.12"), ("body", "16 / 17", "1.50"), ("label", "11 / 11", "1.35"), ("data-hero", "72 / 112", ".92")]
label(c, M, 354, "Token", C["mineral_light"]); label(c, 360, 354, "Mobile / web px", C["mineral_light"]); label(c, 650, 354, "Line height", C["mineral_light"])
yy = 326
for token, sizes, lh in rows:
    rule(c, M, yy + 13, W - M, C["soft"])
    wrapped(c, M, yy, token, 12, C["chalk"], 240, 14, "bold")
    wrapped(c, 360, yy, sizes, 12, C["mineral_light"], 200, 14)
    wrapped(c, 650, yy, lh, 12, C["peach"], 120, 14, "medium")
    yy -= 35
footer(c, page, True, "02 / Visual system")
c.showPage(); page += 1

# 17 Field grammar
start(c, page, "02 / Visual system")
title(c, M, 438, "The ownable visual is a behavior.", size=42, max_width=610)
field(c, M, 220, 390, 150)
field(c, 520, 220, 390, 150, split=True)
label(c, M, 192, "Automatic / dense", C["soft"])
label(c, 520, 192, "Conscious / space opens once", C["soft"])
wrapped(c, M, 144, "Modules encode minutes, decisions, days or allocated value. Every field needs a readable label and disclosed scale.", 14, C["soft"], 790, 20)
footer(c, page, section="02 / Visual system")
c.showPage(); page += 1

# 18 Progress and impact
start(c, page, "02 / Visual system", True)
title(c, M, 438, "Progress without rings, bars or grades.", C["chalk"], 42, 690)
field(c, M, 248, 410, 140, dark=True)
field(c, 520, 248, 390, 140, impact=True)
label(c, M, 220, "7-day attention field", C["mineral_light"])
label(c, 520, 220, "Confirmed value gains depth", C["mineral_light"])
wrapped(c, M, 172, "Peach means an intentional pass, never failure. Today is named in text. Accessibility reads the actual minutes.", 13, C["chalk"], 390, 18)
wrapped(c, 520, 172, "Optional 3D is orthographic and data-bound. Pending value stays flat. No spheres, stones, seeds or decorative depth.", 13, C["chalk"], 390, 18)
footer(c, page, True, "02 / Visual system")
c.showPage(); page += 1

# 19 Motion
start(c, page, "03 / Experience")
title(c, M, 438, "Motion creates an exit, then stops.", size=43, max_width=660)
timeline = [(0, "Dense field"), (120, "Gap begins"), (520, "Field settles"), (521, "Light haptic")]
rule(c, 110, 286, 850, C["mineral"], 2)
for i, (ms, name) in enumerate(timeline):
    x = 110 + i * 245
    c.setFillColor(C["peach"] if i == 3 else C["mineral"])
    c.circle(x, 286, 6, stroke=0, fill=1)
    label(c, x - 24, 320, f"{ms} ms", C["soft"], 7)
    wrapped(c, x - 24, 252, name, 12, C["graphite"], 150, 15, "medium")
wrapped(c, M, 154, "Easing cubic-bezier(.16, 1, .3, 1). No loop. No bounce. Reduced motion renders the final state immediately while keeping the one-second numeric timer.", 15, C["soft"], 820, 21)
footer(c, page, section="03 / Experience")
c.showPage(); page += 1

# 20 Material and photo
start(c, page, "03 / Experience", True)
image_cover(c, ROOT / "brand/v3/photography/repair-chair-wide.png", 0, 0, 540, H, "center")
c.setFillColor(C["graphite"]); c.rect(540, 0, 420, H, stroke=0, fill=1)
label(c, 580, 470, "Photography", C["peach"])
title(c, 580, 420, "Show what attention makes room for.", C["chalk"], 37, 330, 38)
bullets(c, 580, 305, [
    "Natural window light and ordinary color temperature.",
    "Hands making, repairing, writing, cooking or waiting.",
    "Phone absent or peripheral; no staged detox relief.",
    "Keep environmental evidence in the crop.",
], 320, 12.5, C["mineral_light"])
footer(c, page, True, "03 / Experience")
c.showPage(); page += 1

# 21 Material rules
start(c, page, "03 / Experience")
title(c, M, 438, "Tactility lives in edges, rhythm and restraint.", size=41, max_width=710)
key_value(c, M, 330, "Texture", "1-2% monochrome noise only inside a measured module, campaign numeral or confirmed extrusion.")
key_value(c, 360, 330, "Surfaces", "Flat by default. Elevation only when a layer physically floats over another.", 450)
key_value(c, M, 204, "Radius", "2-5 px for modules; 8 px maximum for surfaces; native system masks remain native.")
key_value(c, 360, 204, "Avoid", "Global grain, paper fibers, glass, clay, pebbles, inflated blobs, soft cards and atmospheric glow.", 450)
footer(c, page, section="03 / Experience")
c.showPage(); page += 1

# 22 Composition
start(c, page, "03 / Experience", True)
title(c, M, 438, "One protagonist. Open groups. Shared baselines.", C["chalk"], 41, 720)
for i, (name, value) in enumerate([("Base", "4 px"), ("Rhythm", "8 / 12 / 16 / 24 / 32 / 48 / 72 / 96"), ("Mobile edge", "24 px"), ("Web max", "1320 px"), ("Copy", "34-46 characters")]):
    x = M + (i % 3) * 290
    y = 300 - (i // 3) * 115
    label(c, x, y, name, C["mineral_light"])
    wrapped(c, x, y - 30, value, 20, C["chalk"], 250, 23, "medium")
wrapped(c, M, 110, "Use alignment, whitespace, rules and type before adding a container. Cards are reserved for true grouped objects or elevated native surfaces.", 15, C["mineral_light"], 780, 21)
footer(c, page, True, "03 / Experience")
c.showPage(); page += 1

# 23 Tokens
start(c, page, "03 / Design system")
title(c, M, 438, "Central tokens, shared logic, native expression.", size=40, max_width=700)
token_groups = [
    ("Color", "brand.*, surface.*, text.*, border.*, state.*"),
    ("Type", "display, heading, body, label, data"),
    ("Space", "1=4, 2=8, 3=12, 4=16, 6=24, 8=32, 12=48"),
    ("Shape", "module 2-5, surface 8, native mask system-owned"),
    ("Motion", "fast 160, open 520, slow 720; standard and exit easing"),
    ("Elevation", "none, overlay, native-modal; never decorative"),
]
for i, (name, value) in enumerate(token_groups):
    x = M + (i % 2) * 440
    y = 330 - (i // 2) * 93
    label(c, x, y, name, C["mineral"])
    wrapped(c, x, y - 26, value, 13, C["soft"], 390, 17)
footer(c, page, section="03 / Design system")
c.showPage(); page += 1

# 24 Components
start(c, page, "03 / Design system", True)
title(c, M, 438, "Controls are plain. State is explicit.", C["chalk"], 42, 650)
states = ["Default", "Hover", "Focus", "Active", "Selected", "Disabled", "Loading", "Error", "Success"]
x = M
for i, state in enumerate(states):
    if i == 5:
        x = M
    y = 290 if i < 5 else 205
    fill = C["chalk"] if state in ["Default", "Focus", "Selected"] else C["soft"]
    ink = C["graphite"] if fill == C["chalk"] else C["chalk"]
    if state == "Error": fill = C["danger"]
    if state == "Success": fill = C["success"]
    w = chip(c, x, y, state, fill, ink)
    if state == "Focus":
        c.setStrokeColor(C["focus"]); c.setLineWidth(2); c.roundRect(x - 3, y - 3, w + 6, 30, 6, stroke=1, fill=0)
    x += w + 14
wrapped(c, M, 142, "Button: text plus action, 44 pt iOS / 48 dp Android minimum. Inputs: visible label, hint and error. Lists: rules before cards. Progress: field plus readable summary. Dialogs: one decision, one exit.", 14, C["mineral_light"], 825, 20)
footer(c, page, True, "03 / Design system")
c.showPage(); page += 1

# 25 Product map
start(c, page, "03 / Product")
title(c, M, 438, "The product starts with the moment of choice.", size=41, max_width=720)
flow = [("Onboard", "permission + apps"), ("Intervene", "fact + two paths"), ("Record", "today without score"), ("Pass", "10 min, explicit"), ("Impact", "amount to proof"), ("Adjust", "settings + privacy")]
for i, (name, desc) in enumerate(flow):
    x = M + i * 146
    c.setFillColor(C["graphite"] if i == 1 else C["raised"])
    c.rect(x, 232, 126, 112, stroke=0, fill=1)
    label(c, x + 12, 316, f"0{i+1}", C["peach"] if i == 1 else C["mineral"], 7)
    wrapped(c, x + 12, 284, name, 15, C["chalk"] if i == 1 else C["graphite"], 100, 17, "bold")
    wrapped(c, x + 12, 252, desc, 10, C["mineral_light"] if i == 1 else C["soft"], 100, 13)
wrapped(c, M, 160, "Preserve existing permissions, native restrictions, timed passes, wallet, impact states and settings. Redesign hierarchy and feedback without inventing functionality.", 14, C["soft"], 820, 20)
footer(c, page, section="03 / Product")
c.showPage(); page += 1

# 26 Today
start(c, page, "03 / Product", True)
phone(c, 615, 72, 250, 400, False, "today")
label(c, M, 430, "Today", C["peach"])
title(c, M, 378, "Five answers in the first viewport.", C["chalk"], 42, 460)
items = ["1. Minutes returned today", "2. Apps protected", "3. Seven-day progress", "4. Impact amount and state", "5. Next meaningful action"]
bullets(c, M, 285, items, 430, 14, C["mineral_light"], 8)
wrapped(c, M, 116, "No greeting, quote, score, streak or motivational card. One metric leads; the rest form a compact reading sequence.", 13, C["chalk"], 470, 18, "medium")
footer(c, page, True, "03 / Product")
c.showPage(); page += 1

# 27 Intervention
start(c, page, "03 / Product")
phone(c, 610, 72, 250, 400, True, "intervention")
label(c, M, 430, "Most important screen", C["peach"])
title(c, M, 378, "Automatic becomes conscious without punishment.", C["graphite"], 38, 480, 38)
bullets(c, M, 238, ["App context plus 00:01", "Observed fact, never diagnosis", "Question names the next 10 minutes", "Primary: Go back", "Secondary: Use 1 pass - 10 min", "One motion, one haptic, no loop"], 440, 13, C["soft"], 6)
footer(c, page, section="03 / Product")
c.showPage(); page += 1

# 28 Impact
start(c, page, "03 / Product", True)
phone(c, 610, 72, 250, 400, False, "impact")
label(c, M, 430, "Impact record", C["peach"])
title(c, M, 378, "Evidence before emotion.", C["chalk"], 44, 470)
bullets(c, M, 290, ["Amount and calculation source", "State: estimated, reconciled, donated or published", "Allocation criteria and vote", "Selected project and publication date", "Transfer proof only after publication"], 450, 13.5, C["mineral_light"], 8)
wrapped(c, M, 115, "Never imply donation before transfer. Campaign examples must say illustrative; public numbers must come from the live ledger.", 13, C["chalk"], 470, 18, "medium")
footer(c, page, True, "03 / Product")
c.showPage(); page += 1

# 29 Web narrative
start(c, page, "03 / Website")
image_cover(c, ROOT / "brand/v3/qa/web-home-desktop.png", 430, 80, 480, 330, "top")
title(c, M, 438, "A story, not a SaaS stack.", size=42, max_width=350)
steps = ["1. The interruption", "2. The observed problem", "3. Automatic -> conscious", "4. The five-answer home", "5. Impact and evidence", "6. Result of attention", "7. Privacy", "8. One CTA"]
bullets(c, M, 340, steps, 310, 12.5, C["soft"], 3)
label(c, 430, 54, "Responsive verified at 1440 px and 390 px", C["mineral"])
footer(c, page, section="03 / Website")
c.showPage(); page += 1

# 30 Voice
start(c, page, "04 / Voice", True)
title(c, M, 438, "Specific facts. Quiet questions. Clear states.", C["chalk"], 41, 720)
columns = [
    ("Use", ["returned", "opened", "selected", "estimated", "recorded", "published", "10 minutes", "go back"]),
    ("Avoid", ["unlock", "transform", "reclaim your life", "dopamine detox", "better you", "mindful journey", "save the planet", "supercharge"]),
]
for i, (heading, words) in enumerate(columns):
    x = M + i * 450
    label(c, x, 334, heading, C["peach"] if i else C["mineral_light"])
    yy = 298
    for word in words:
        wrapped(c, x, yy, word, 14, C["chalk"] if i == 0 else C["mineral_light"], 390, 17, "medium")
        yy -= 31
footer(c, page, True, "04 / Voice")
c.showPage(); page += 1

# 31 Copy matrix
start(c, page, "04 / Voice")
title(c, M, 438, "The same organization in every state.", size=41, max_width=700)
examples = [
    ("Onboarding", "Choose the apps you tend to open automatically."),
    ("Intervention", "Instagram opened 7 times today."),
    ("Empty", "No apps selected yet. Choose the ones you open on reflex."),
    ("Error", "Still could not refresh this record. Your restriction remains active."),
    ("Success", "Pass ready. It ends in 10 minutes."),
    ("Notification", "Your pass ended. The one-second pause is back."),
    ("Impact pending", "This amount is estimated until the weekly close."),
    ("Commercial", "One second before the app."),
]
yy = 350
for i, (state, copy) in enumerate(examples):
    x = M if i % 2 == 0 else 505
    if i % 2 == 0 and i > 0:
        yy -= 76
    label(c, x, yy, state, C["mineral"], 7)
    wrapped(c, x, yy - 24, copy, 12.5, C["soft"], 390, 16, "medium")
footer(c, page, section="04 / Voice")
c.showPage(); page += 1

# 32 Campaign
start(c, page, "04 / Communication", True)
assets = [ROOT / "brand/v3/campaign/exports/launch-post.png", ROOT / "brand/v3/campaign/exports/feature-intervention.png", ROOT / "brand/v3/campaign/exports/impact-report.png"]
for i, path in enumerate(assets):
    image_cover(c, path, 55 + i * 302, 72, 270, 338, "top")
label(c, M, 450, "Campaign system", C["peach"])
title(c, M, 414, "One claim per frame.", C["chalk"], 30, 600)
footer(c, page, True, "04 / Communication")
c.showPage(); page += 1

# 33 App store and social
start(c, page, "04 / Communication")
image_contain(c, ROOT / "brand/v3/campaign/exports/app-store-01-intervention.png", 55, 60, 250, 310)
image_contain(c, ROOT / "brand/v3/campaign/exports/app-store-02-today.png", 355, 60, 250, 310)
image_contain(c, ROOT / "brand/v3/campaign/exports/app-store-03-impact.png", 655, 60, 250, 310)
label(c, M, 468, "App Store", C["mineral"])
title(c, M, 430, "Intervention. Record. Evidence.", size=34, max_width=680)
label(c, M, 48, "Illustrative values must be replaced by a verified ledger snapshot before publication.", C["warning"], 7)
footer(c, page, section="04 / Communication")
c.showPage(); page += 1

# 34 Social proof
start(c, page, "04 / Communication", True)
image_contain(c, ROOT / "brand/v3/campaign/exports/verified-quote-template.png", 570, 54, 300, 410)
title(c, M, 430, "No testimonial without evidence and permission.", C["chalk"], 40, 450)
bullets(c, M, 290, ["Verify exact words", "Verify identity and role", "Record explicit publishing permission", "Preserve context", "Date the approval"], 420, 14, C["mineral_light"], 7)
wrapped(c, M, 112, "Until all five conditions are met, the social-proof template remains blocked by design.", 14, C["chalk"], 430, 20, "medium")
footer(c, page, True, "04 / Communication")
c.showPage(); page += 1

# 35 Do / don't
start(c, page, "04 / Governance")
title(c, M, 438, "Recognition comes from disciplined repetition.", size=41, max_width=720)
label(c, M, 342, "Do", C["success"])
bullets(c, M, 310, ["Use the field only for data or transition", "Name the observed fact", "Keep one protagonist metric", "Show impact state and proof", "Let photography show the result of attention"], 380, 13)
label(c, 505, 342, "Do not", C["danger"])
bullets(c, 505, 310, ["Add leaves, rocks, planets or eco symbols", "Use beige plus sage as a shortcut", "Add decorative 3D or global grain", "Stack rounded cards", "Use grandiose wellness copy"], 390, 13)
footer(c, page, section="04 / Governance")
c.showPage(); page += 1

# 36 Accessibility
start(c, page, "04 / Governance", True)
title(c, M, 438, "Calm cannot come at the cost of access.", C["chalk"], 42, 660)
checks = ["WCAG AA text contrast", "44 pt iOS / 48 dp Android targets", "Visible web focus", "Reduced-motion final state", "Dynamic Type keeps CTA order", "Field has readable summary", "State never color-only", "Native intervention preserves context and two paths"]
for i, check in enumerate(checks):
    x = M + (i % 2) * 450
    y = 330 - (i // 2) * 63
    c.setStrokeColor(C["mineral_light"]); c.rect(x, y - 7, 15, 15, stroke=1, fill=0)
    wrapped(c, x + 28, y + 3, check, 13, C["chalk"], 390, 16, "medium")
footer(c, page, True, "04 / Governance")
c.showPage(); page += 1

# 37 Anti-slop gate
start(c, page, "04 / Governance")
title(c, M, 438, "If any answer is yes, redesign it.", size=43, max_width=620)
questions = ["Is nature carrying the concept?", "Is a blob or 3D object only decorative?", "Are there more containers than groups?", "Could the copy belong to any wellness app?", "Does motion loop or perform?", "Does impact lead with sentiment?", "Is texture reducing legibility?", "Is the field present without data?"]
for i, q in enumerate(questions):
    x = M + (i % 2) * 450
    y = 330 - (i // 2) * 67
    label(c, x, y, f"0{i+1}", C["peach"], 7)
    wrapped(c, x + 34, y + 2, q, 13, C["graphite"], 375, 16, "medium")
footer(c, page, section="04 / Governance")
c.showPage(); page += 1

# 38 Handoff
start(c, page, "04 / Governance", True)
title(c, M, 438, "The system is ready to continue, not to drift.", C["chalk"], 42, 720)
paths = [
    ("Identity", "brand/v3/identity"), ("Explorations", "brand/v3/explorations"),
    ("Photography", "brand/v3/photography"), ("Campaign", "brand/v3/campaign"),
    ("System docs", "docs/brand/v3"), ("Mobile tokens", "apps/mobile/src/theme/tokens.ts"),
    ("Web tokens", "apps/web/app/tokens.css"), ("Generators", "scripts/generate_v3_*.mjs"),
]
yy = 338
for i, (name, path) in enumerate(paths):
    x = M if i % 2 == 0 else 505
    if i % 2 == 0 and i > 0:
        yy -= 64
    label(c, x, yy, name, C["peach"] if i % 3 == 0 else C["mineral_light"], 7)
    wrapped(c, x, yy - 23, path, 11.5, C["chalk"], 390, 15, "medium")
wrapped(c, M, 76, "Owner rule: no new visual motif enters product until it can be explained by behavior, data, hierarchy or evidence.", 14, C["chalk"], 810, 19, "medium")
footer(c, page, True, "04 / Governance")
c.showPage(); page += 1

# 39 Closing
bg(c, C["chalk"])
mark(c, M, H - 72, 82)
label(c, M, 390, "Still / Soft Field v3", C["mineral"])
title(c, M, 335, "One second before the app.", size=58, max_width=720, leading=57)
wrapped(c, M, 200, "Automatic becomes visible. Choice stays human. Impact leaves a record.", 20, C["soft"], 630, 28)
label(c, M, 80, "End / working brand system / 29 August 2026", C["soft"])
footer(c, page, False, "Still / Brandbook")
c.showPage()

c.save()
print(OUT)
