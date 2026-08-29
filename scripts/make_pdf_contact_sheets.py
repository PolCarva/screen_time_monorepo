from pathlib import Path
from PIL import Image, ImageDraw


root = Path(__file__).resolve().parents[1]
source = root / "tmp" / "pdfs" / "still-brandbook-render"
output = root / "tmp" / "pdfs" / "still-brandbook-sheets"
output.mkdir(parents=True, exist_ok=True)

pages = sorted(source.glob("page-*.png"))
per_sheet = 8
thumb_w = 480
thumb_h = 270
gutter = 22
label_h = 25

for sheet_index in range((len(pages) + per_sheet - 1) // per_sheet):
    batch = pages[sheet_index * per_sheet:(sheet_index + 1) * per_sheet]
    canvas = Image.new("RGB", (thumb_w * 2 + gutter * 3, (thumb_h + label_h) * 4 + gutter * 5), "#b8bbb8")
    draw = ImageDraw.Draw(canvas)
    for index, page_path in enumerate(batch):
        page = Image.open(page_path).convert("RGB")
        page.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        col, row = index % 2, index // 2
        x = gutter + col * (thumb_w + gutter)
        y = gutter + row * (thumb_h + label_h + gutter)
        canvas.paste(page, (x, y))
        draw.text((x, y + thumb_h + 4), page_path.stem, fill="#242826")
    canvas.save(output / f"sheet-{sheet_index + 1:02d}.png", optimize=True)

print(output)
