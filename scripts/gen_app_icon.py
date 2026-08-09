"""Generate the app icon, favicon, splash mark, and Android adaptive-icon
layers from FREQ's own waveform mark — the same sine curve
`components/ui/waveform.tsx` draws as a section divider, at icon scale.

Dark, on-brand, no external asset pipeline: everything here is drawn
procedurally with Pillow so the mark is pixel-identical in shape everywhere
it appears, and regenerating after a brand-token change is one command.

    python3 scripts/gen_app_icon.py
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "assets" / "images"

INK = (16, 15, 13, 255)       # #100F0D — brand dark background
SIGNAL = (230, 169, 158, 255)  # #E6A99E — brand accent (signal rose)
WHITE = (255, 255, 255, 255)  # Android monochrome layer — the OS applies its own tint


def wave_points(width, height, periods=2.5, amplitude_ratio=0.16, steps=200, phase=0.0):
    """The exact curve waveform.tsx draws: a sine wave, mid-line at height/2."""
    mid_y = height / 2
    amplitude = height * amplitude_ratio
    points = []
    for i in range(steps + 1):
        x = (i / steps) * width
        y = mid_y + math.sin((i / steps) * periods * 2 * math.pi + phase) * amplitude
        points.append((x, y))
    return points


def draw_wave(draw, canvas_size, margin_ratio, stroke_ratio, color, periods=2.5, amplitude_ratio=0.16):
    """Draws the waveform centered on a canvas_size x canvas_size area, inset by margin_ratio.

    Stamps a filled circle at every sample point rather than using
    `ImageDraw.line(..., joint="curve")` — the latter leaves visible seam
    artifacts at high curvature with many short segments. Circle-stamping a
    dense enough path is seamless by construction: every gap between samples
    is smaller than the stroke radius, so consecutive circles always overlap.
    """
    margin = canvas_size * margin_ratio
    wave_w = canvas_size - margin * 2
    stroke = max(2, round(canvas_size * stroke_ratio))
    r = stroke / 2
    # Dense enough that consecutive points never step further than the
    # stroke radius, so the stamped circles always overlap with no gaps.
    steps = max(400, round(wave_w / r * 3))
    points = wave_points(wave_w, canvas_size, periods=periods, amplitude_ratio=amplitude_ratio, steps=steps)
    for x, y in points:
        x += margin
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color)


def make_icon(size, margin_ratio=0.30, stroke_ratio=0.045, out_name=None, downsample_to=None):
    """Ink background, centered signal-colored wave — the main app icon shape."""
    img = Image.new("RGBA", (size, size), INK)
    draw = ImageDraw.Draw(img)
    draw_wave(draw, size, margin_ratio, stroke_ratio, SIGNAL)
    if downsample_to:
        img = img.resize((downsample_to, downsample_to), Image.LANCZOS)
    if out_name:
        img.save(OUT / out_name)
    return img


def make_transparent_mark(size, margin_ratio, stroke_ratio, color, out_name):
    """Mark only, transparent background — for splash and Android's layered adaptive icon."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw_wave(draw, size, margin_ratio, stroke_ratio, color)
    img.save(OUT / out_name)
    return img


def make_solid(size, color, out_name):
    img = Image.new("RGBA", (size, size), color)
    img.save(OUT / out_name)
    return img


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)

    # Main app icon — 1024, per Expo/App Store convention. OS applies its own
    # corner mask, so full-bleed ink background is correct here.
    make_icon(1024, margin_ratio=0.28, stroke_ratio=0.042, out_name="icon.png")

    # Favicon — generated at 4x and downsampled for crisp small-size edges,
    # bolder stroke and tighter margin since detail is lost below ~32px.
    make_icon(192, margin_ratio=0.22, stroke_ratio=0.07, out_name="favicon.png", downsample_to=48)

    # Splash mark — transparent, shown centered over expo-splash-screen's own
    # backgroundColor (set to brand ink in app.json), sized generously since
    # there's no icon frame competing with it.
    make_transparent_mark(640, margin_ratio=0.08, stroke_ratio=0.05, color=SIGNAL, out_name="splash-icon.png")

    # Android adaptive icon: background + foreground composited by the OS,
    # which also masks to a circle/squircle/rounded-square depending on
    # launcher — foreground content has to survive being cropped to roughly
    # the center 66%, hence the larger margin here than the flat icon.
    make_solid(512, INK, "android-icon-background.png")
    make_transparent_mark(512, margin_ratio=0.32, stroke_ratio=0.05, color=SIGNAL, out_name="android-icon-foreground.png")
    # Monochrome (Android 13+ themed icons) — single-color silhouette, transparent bg; the OS tints it.
    make_transparent_mark(432, margin_ratio=0.32, stroke_ratio=0.05, color=WHITE, out_name="android-icon-monochrome.png")

    print(f"wrote icon.png, favicon.png, splash-icon.png, android-icon-*.png to {OUT}")
