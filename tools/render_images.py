"""Draws the READMEs' illustrations from tools/image_scenes.py. Run: python tools/render_images.py"""

import os
import re

from PIL import Image, ImageDraw, ImageFont

from image_scenes import SCENES

FONT_DIR = "C:/Windows/Fonts"
SCALE = 2
FONT_SIZE = 15 * SCALE
LINE_GAP = 6 * SCALE
PADDING = 18 * SCALE
TITLE_BAR = 34 * SCALE
CORNER = 10 * SCALE

BACKGROUND = "#1e1f24"
TITLE_BACKGROUND = "#2a2c33"
COLORS = {
    "t": "#d8dae0",  # text
    "d": "#878b96",  # dim
    "b": "#ffffff",  # bold
    "g": "#7ec699",  # success
    "y": "#e5c07b",  # warning
    "r": "#e06c75",  # error
    "c": "#79b8ff",  # suggestion and links
    "m": "#c792ea",  # a second category colour
    "o": "#d97757",  # a third category colour
}
BUTTON_FILL = "#3a3d47"
# Glyphs Consolas lacks; drawn from the symbol font, centred in their cell.
SYMBOLS = set("⎇⏎✓✗●▸↻")

MARKUP = re.compile(r"\{([a-z]):([^{}]*)\}|\[\[([^\]]*)\]\]")

mono = ImageFont.truetype(f"{FONT_DIR}/consola.ttf", FONT_SIZE)
bold = ImageFont.truetype(f"{FONT_DIR}/consolab.ttf", FONT_SIZE)
symbol = ImageFont.truetype(f"{FONT_DIR}/seguisym.ttf", FONT_SIZE - 4)
title_font = ImageFont.truetype(f"{FONT_DIR}/consola.ttf", FONT_SIZE - 4)

CELL = mono.getlength("M")
LINE = FONT_SIZE + LINE_GAP


def spans(line):
    """Reads `{g:green}` colour runs and `[[Button]]` labels; the rest is plain text."""
    at = 0
    for match in MARKUP.finditer(line):
        if match.start() > at:
            yield ("t", line[at : match.start()])
        if match.group(3) is not None:
            yield ("button", match.group(3))
        else:
            yield (match.group(1), match.group(2))
        at = match.end()
    if at < len(line):
        yield ("t", line[at:])


def width_of(line):
    return sum(len(text) + (2 if kind == "button" else 0) for kind, text in spans(line))


def draw_text(draw, x, y, text, color, font):
    for char in text:
        if char in SYMBOLS:
            offset = (CELL - symbol.getlength(char)) / 2
            draw.text((x + offset, y + 2), char, fill=color, font=symbol)
        else:
            draw.text((x, y), char, fill=color, font=font)
        x += CELL
    return x


def draw_line(draw, x, y, line):
    for kind, text in spans(line):
        if kind == "button":
            box_width = (len(text) + 2) * CELL
            draw.rounded_rectangle(
                (x, y - 2, x + box_width - 4, y + FONT_SIZE + 2), radius=4 * SCALE, fill=BUTTON_FILL
            )
            draw_text(draw, x + CELL, y, text, COLORS["t"], mono)
            x += box_width
        else:
            font = bold if kind == "b" else mono
            x = draw_text(draw, x, y, text, COLORS[kind], font)


def render(scene):
    lines = scene["lines"]
    columns = max(width_of(line) for line in lines)
    width = int(columns * CELL) + PADDING * 2
    height = TITLE_BAR + PADDING * 2 + LINE * len(lines)

    image = Image.new("RGB", (width, height), BACKGROUND)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, width, TITLE_BAR), fill=TITLE_BACKGROUND)
    draw.text((PADDING, (TITLE_BAR - FONT_SIZE) / 2 + 2), scene["title"], fill=COLORS["d"], font=title_font)

    for index, line in enumerate(lines):
        draw_line(draw, PADDING, TITLE_BAR + PADDING + index * LINE, line)

    mask = Image.new("L", (width, height), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, height - 1), radius=CORNER, fill=255)
    framed = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    framed.paste(image, mask=mask)
    return framed


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for scene in SCENES:
        path = os.path.join(root, scene["path"])
        os.makedirs(os.path.dirname(path), exist_ok=True)
        render(scene).save(path, optimize=True)
        print(scene["path"])


if __name__ == "__main__":
    main()
