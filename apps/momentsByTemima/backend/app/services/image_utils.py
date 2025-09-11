# app/services/image_utils.py
from __future__ import annotations
from pathlib import Path
from typing import List, Dict
from PIL import Image

from ..settings import settings

MEDIA_ROOT = Path(settings.MEDIA_ROOT)
DERIV_ROOT = Path(settings.MEDIA_DERIV_ROOT)

try:
    import pillow_avif  # registers AVIF with Pillow
    AVIF_OK = True
except Exception:
    AVIF_OK = False

def _ensure_parent(p: Path):
    p.parent.mkdir(parents=True, exist_ok=True)

def generate_derivatives(original_rel_path: str) -> Dict[str, List[str]]:
    """
    Create resized WebP (and AVIF if available) variants at configured widths.
    Returns {"webp": [...], "avif": [...]}
    """
    widths = [int(x) for x in settings.DERIV_WIDTHS.split(",") if x.strip().isdigit()]
    quality = int(settings.DERIV_QUALITY)

    src = MEDIA_ROOT / original_rel_path
    if not src.exists() or not src.is_file():
        return {"webp": [], "avif": []}

    raster_exts = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".tif", ".tiff"}
    if src.suffix.lower() not in raster_exts:
        return {"webp": [], "avif": []}

    im = Image.open(src).convert("RGB")
    w0, h0 = im.size

    rel_no_ext = Path(original_rel_path).with_suffix("")
    out_dir = DERIV_ROOT / rel_no_ext.parent
    _ensure_parent(out_dir)

    webp_paths: List[str] = []
    avif_paths: List[str] = []

    for w in widths:
        w_eff = w0 if w >= w0 else w
        h_eff = round(h0 * (w_eff / w0))
        resized = im.resize((w_eff, h_eff), Image.LANCZOS)

        # WEBP
        webp_abs = out_dir / f"{rel_no_ext.name}_w{w_eff}.webp"
        resized.save(webp_abs, "WEBP", quality=quality, method=6)
        webp_paths.append(webp_abs.relative_to(DERIV_ROOT).as_posix())

        # AVIF (optional)
        if AVIF_OK:
            avif_abs = out_dir / f"{rel_no_ext.name}_w{w_eff}.avif"
            resized.save(avif_abs, "AVIF", quality=quality)
            avif_paths.append(avif_abs.relative_to(DERIV_ROOT).as_posix())

    return {"webp": webp_paths, "avif": avif_paths if AVIF_OK else []}
