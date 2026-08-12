#!/usr/bin/env python3
"""
Procedural "photos" for the six mock profiles.

Why these are abstract rather than faces: the mocks are fictional people on a
dating app, and generating realistic human likenesses for them would produce
exactly the artefact that fake-profile abuse is made of — plausible strangers
whose photos could be mistaken for real people. These are unmistakably
illustrations: a soft gradient field, a stylised head-and-shoulders form, film
grain. Enough to prove the feature (a real image, in private storage, unsealing
only at a match) without fabricating anybody's face.

They are also deliberately unlike `AlbumArt`, which is the sealed state's
bands-and-circle motif. The unseal has to look like a change, so these lean
portrait: vertical crop, single subject, depth.

Generate only:
    python3 scripts/gen_mock_photos.py

Generate and upload to the private bucket, registering each as primary:
    SUPABASE_URL=... SERVICE_ROLE_KEY=... python3 scripts/gen_mock_photos.py --upload
"""

from __future__ import annotations

import hashlib
import json
import os
import random
import sys
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

W, H = 900, 1200
OUT = Path("assets/mock-photos")

SLUGS = ["odessa", "rune", "marlowe", "thea", "juno", "vesper"]

# Brand palette. Backgrounds stay in the dark half so the images sit inside the
# app's world rather than punching a bright hole in it.
INK = (16, 15, 13)
CHARCOAL = (27, 24, 21)
IVORY = (243, 236, 225)
ASH = (139, 133, 122)
SIGNAL = (230, 169, 158)
CHAMPAGNE = (201, 183, 156)

# One accent per person, so six reveals look like six different people.
ACCENTS = {
    "odessa": SIGNAL,
    "rune": ASH,
    "marlowe": CHAMPAGNE,
    "thea": (168, 149, 173),   # muted lilac — still in the dusty family
    "juno": (196, 132, 116),   # deeper rose
    "vesper": (146, 160, 154),  # cool sage
}


def seeded(slug: str) -> random.Random:
    """Deterministic per slug, so regenerating does not reshuffle the set."""
    digest = hashlib.sha256(slug.encode()).hexdigest()
    return random.Random(int(digest[:16], 16))


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))  # type: ignore[return-value]


def gradient(accent: tuple[int, int, int], rng: random.Random) -> Image.Image:
    """A soft vertical wash, darkest at the bottom so the form reads against it."""
    img = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(img)
    top = lerp(CHARCOAL, accent, 0.22 + rng.random() * 0.14)
    for y in range(H):
        t = y / H
        draw.line([(0, y), (W, y)], fill=lerp(top, INK, t ** 0.85))
    return img


# Three compositions rather than one.
#
# Two earlier attempts failed for the same reason in different ways: a soft
# silhouette read as the generic "no avatar" placeholder, and a disc-on-
# trapezoid read as six identical pictograms in six colours. Abstract
# compositions also survive the reveal's circular crop, which clips the bottom
# of any centred figure. Each profile gets a different one, so the six reveals
# do not look like a set.
STYLES = ("horizon", "planes", "rings")


def add_horizon(img, accent, rng) -> None:
    """A large disc breaking a banded horizon — the widest, calmest of the three."""
    draw = ImageDraw.Draw(img, "RGBA")
    cx = round(W * (0.38 + rng.random() * 0.24))
    cy = round(H * (0.40 + rng.random() * 0.10))
    r = round(W * (0.30 + rng.random() * 0.10))
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*lerp(accent, IVORY, 0.45), 255))

    for _ in range(rng.randint(4, 7)):
        by = rng.randint(round(H * 0.30), round(H * 0.92))
        bh = rng.randint(14, 44)
        tone = rng.choice([INK, CHARCOAL, accent])
        draw.rectangle([0, by, W, by + bh], fill=(*tone, rng.randint(70, 140)))


def add_planes(img, accent, rng) -> None:
    """Intersecting translucent planes — the most graphic, most 'poster' one."""
    draw = ImageDraw.Draw(img, "RGBA")
    for i in range(rng.randint(3, 4)):
        x1 = rng.randint(-round(W * 0.3), round(W * 0.7))
        x2 = x1 + rng.randint(round(W * 0.4), round(W * 1.1))
        skew = rng.randint(-round(W * 0.35), round(W * 0.35))
        tone = lerp(accent, IVORY if i % 2 else INK, 0.25 + rng.random() * 0.35)
        draw.polygon(
            [(x1, 0), (x2, 0), (x2 + skew, H), (x1 + skew, H)],
            fill=(*tone, rng.randint(60, 120)),
        )


def add_rings(img, accent, rng) -> None:
    """Concentric rings, echoing the seal that had to be broken to see this."""
    draw = ImageDraw.Draw(img, "RGBA")
    cx = round(W * (0.42 + rng.random() * 0.16))
    cy = round(H * (0.40 + rng.random() * 0.12))
    r = round(W * 0.62)
    step = rng.randint(34, 52)
    i = 0
    while r > 20:
        tone = lerp(accent, IVORY if i % 2 else CHARCOAL, 0.35)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(*tone, 190), width=rng.randint(8, 18))
        r -= step
        i += 1


def add_form(img: Image.Image, accent, rng: random.Random, style: str) -> None:
    {"horizon": add_horizon, "planes": add_planes, "rings": add_rings}[style](img, accent, rng)

    # A single soft highlight, on its own layer, so nothing reads as flat fill.
    glow = Image.new("L", (W, H), 0)
    gx, gy = rng.randint(0, W), rng.randint(0, round(H * 0.6))
    ImageDraw.Draw(glow).ellipse([gx - W // 2, gy - W // 2, gx + W // 2, gy + W // 2], fill=54)
    img.paste(
        Image.new("RGB", (W, H), lerp(accent, IVORY, 0.6)),
        (0, 0),
        glow.filter(ImageFilter.GaussianBlur(radius=110)),
    )


def add_grain(img: Image.Image, rng: random.Random) -> Image.Image:
    """A little noise, so the gradients do not look like a CSS background."""
    noise = Image.effect_noise((W, H), 22).convert("L")
    noise = noise.point(lambda v: 128 + (v - 128) * 0.5)
    return Image.blend(img, Image.merge("RGB", (noise, noise, noise)), 0.055)


def make(slug: str) -> Image.Image:
    rng = seeded(slug)
    accent = ACCENTS[slug]
    # Assigned by position rather than at random, so the six are guaranteed to
    # spread across all three compositions instead of happening to collide.
    style = STYLES[SLUGS.index(slug) % len(STYLES)]
    img = gradient(accent, rng)
    add_form(img, accent, rng, style)
    img = add_grain(img, rng)
    return img.filter(ImageFilter.SMOOTH)


def api(path: str, method: str = "GET", body: bytes | None = None,
        content_type: str = "application/json") -> tuple[int, bytes]:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SERVICE_ROLE_KEY"]
    req = urllib.request.Request(f"{base}{path}", method=method, data=body)
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", content_type)
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, res.read()
    except urllib.error.HTTPError as e:  # noqa: PERF203 — the status is the point
        return e.code, e.read()


def upload(slug: str, path: Path) -> None:
    status, raw = api(f"/rest/v1/profiles?select=id&slug=eq.{slug}")
    rows = json.loads(raw or b"[]")
    if not rows:
        print(f"  {slug}: no profile row, skipped")
        return
    profile_id = rows[0]["id"]

    object_path = f"{profile_id}/mock-primary.jpg"

    # Replace rather than accumulate, so re-running does not add a seventh photo.
    api(f"/rest/v1/profile_photos?path=eq.{object_path}", method="DELETE")
    api(f"/storage/v1/object/profile-photos/{object_path}", method="DELETE")

    status, raw = api(
        f"/storage/v1/object/profile-photos/{object_path}",
        method="POST",
        body=path.read_bytes(),
        content_type="image/jpeg",
    )
    if status not in (200, 201):
        print(f"  {slug}: upload failed ({status}) {raw[:120]!r}")
        return

    status, raw = api(
        "/rest/v1/profile_photos",
        method="POST",
        body=json.dumps(
            {"profile_id": profile_id, "path": object_path, "position": 0, "is_primary": True}
        ).encode(),
    )
    if status not in (200, 201):
        print(f"  {slug}: row insert failed ({status}) {raw[:120]!r}")
        return

    print(f"  {slug}: uploaded and set primary")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for slug in SLUGS:
        img = make(slug)
        dest = OUT / f"{slug}.jpg"
        img.save(dest, "JPEG", quality=88, optimize=True)
        print(f"wrote {dest}")

    if "--upload" in sys.argv:
        if not os.environ.get("SUPABASE_URL") or not os.environ.get("SERVICE_ROLE_KEY"):
            sys.exit("--upload needs SUPABASE_URL and SERVICE_ROLE_KEY in the environment")
        print("uploading to the private bucket…")
        for slug in SLUGS:
            upload(slug, OUT / f"{slug}.jpg")


if __name__ == "__main__":
    main()
