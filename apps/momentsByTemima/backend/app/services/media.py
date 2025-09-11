# app/services/media.py
from __future__ import annotations
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import mimetypes

from fastapi import UploadFile, HTTPException
from ..settings import settings

MEDIA_ROOT = Path(settings.MEDIA_ROOT)
DERIV_ROOT = Path(settings.MEDIA_DERIV_ROOT)

CHUNK_SIZE = 1024 * 1024  # 1 MB chunks


def _unique_dest(root: Path, filename: str) -> Path:
    dest = root / filename
    i = 1
    while dest.exists():
        dest = root / f"{Path(filename).stem}_{i}{Path(filename).suffix}"
        i += 1
    return dest


def build_public_url(rel: str) -> str:
    """
    Return the URL the frontend should use to fetch the original.
    MEDIA_BASE_URL is a path mounted by StaticFiles (e.g. '/media').
    The frontend should prefix it with the backend origin.
    """
    rel = rel.lstrip("/")
    return f"{settings.MEDIA_BASE_URL}/{rel}"


def build_derivative_url(rel_deriv: str) -> str:
    """
    URL for a derivative (mounted at /media-deriv via StaticFiles).
    """
    rel_deriv = rel_deriv.lstrip("/")
    return f"/media-deriv/{rel_deriv}"


async def save_upload(file: UploadFile) -> Tuple[str, str]:
    """
    Streams upload to disk, enforces MAX_UPLOAD_MB, returns (relative_path, public_url).
    """
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    bytes_seen = 0

    dest = _unique_dest(MEDIA_ROOT, file.filename)

    with dest.open("wb") as out:
        while True:
            chunk = await file.read(CHUNK_SIZE)
            if not chunk:
                break
            bytes_seen += len(chunk)
            if bytes_seen > max_bytes:
                try:
                    dest.unlink(missing_ok=True)
                except Exception:
                    pass
                raise HTTPException(status_code=413, detail="File too large")
            out.write(chunk)

    rel = dest.relative_to(MEDIA_ROOT).as_posix()
    url = build_public_url(rel)
    return rel, url


def list_originals(prefix: Optional[str] = None) -> List[str]:
    """
    Return a list of relative paths for originals under MEDIA_ROOT (optionally filtered by prefix).
    """
    root = MEDIA_ROOT if not prefix else (MEDIA_ROOT / prefix)
    if not root.exists():
        return []
    results: List[str] = []
    for p in root.rglob("*"):
        if p.is_file():
            results.append(p.relative_to(MEDIA_ROOT).as_posix())
    return results


def list_derivatives(prefix: Optional[str] = None) -> List[str]:
    """
    Return a list of relative paths for derivatives under DERIV_ROOT.
    """
    root = DERIV_ROOT if not prefix else (DERIV_ROOT / prefix)
    if not root.exists():
        return []
    results: List[str] = []
    for p in root.rglob("*"):
        if p.is_file():
            results.append(p.relative_to(DERIV_ROOT).as_posix())
    return results


def file_metadata(rel: str) -> Dict:
    """
    Return metadata for an original file (size, mime, url), plus any derivatives discovered.
    """
    rel = rel.lstrip("/")
    abs_path = MEDIA_ROOT / rel
    if not abs_path.exists() or not abs_path.is_file():
        raise HTTPException(status_code=404, detail="Not found")

    size = abs_path.stat().st_size
    mime = mimetypes.guess_type(abs_path.name)[0] or "application/octet-stream"

    # discover derivatives that share the same base name (…_w{width}.{ext})
    base_no_ext = Path(rel).with_suffix("")
    d_dir = DERIV_ROOT / base_no_ext.parent
    deriv_urls: List[str] = []
    if d_dir.exists():
        stem = base_no_ext.name
        for p in d_dir.glob(f"{stem}_w*.*"):
            deriv_urls.append(build_derivative_url(p.relative_to(DERIV_ROOT).as_posix()))

    return {
        "rel": rel,
        "url": build_public_url(rel),
        "size": size,
        "mime": mime,
        "derivatives": deriv_urls,
    }


def delete_original_and_derivatives(rel: str) -> None:
    """
    Dev helper: delete an original and all its derivatives.
    """
    rel = rel.lstrip("/")
    abs_path = MEDIA_ROOT / rel
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="Not found")
    abs_path.unlink()

    base_no_ext = Path(rel).with_suffix("")
    d_dir = DERIV_ROOT / base_no_ext.parent
    if d_dir.exists():
        stem = base_no_ext.name
        for p in d_dir.glob(f"{stem}_w*.*"):
            try:
                p.unlink()
            except Exception:
                pass


def pick_best_derivative(rel: str, max_width: int, prefer: str = "avif") -> Optional[str]:
    """
    Given an original relative path, choose the 'best' derivative URL
    not exceeding max_width. prefer: 'avif' | 'webp'
    Returns URL string or None if none found.
    """
    rel = rel.lstrip("/")
    base_no_ext = Path(rel).with_suffix("")
    d_dir = DERIV_ROOT / base_no_ext.parent
    if not d_dir.exists():
        return None

    # Collect candidates like: (width:int, ext:str, path:Path)
    candidates: List[Tuple[int, str, Path]] = []
    stem = base_no_ext.name
    for p in d_dir.glob(f"{stem}_w*.*"):
        name = p.name  # e.g., foo_w1280.webp
        try:
            w_str = name.split("_w", 1)[1].split(".", 1)[0]
            w = int(w_str)
        except Exception:
            continue
        candidates.append((w, p.suffix.lower().lstrip("."), p))

    if not candidates:
        return None

    # Filter by width <= max_width if possible, else take the smallest > max_width
    under = [c for c in candidates if c[0] <= max_width]
    chosen: Optional[Tuple[int, str, Path]] = None
    if under:
        # sort by width desc, then preferred ext first
        under.sort(key=lambda t: (t[0], t[1] == prefer), reverse=True)
        # After sorting reverse=True, the first has highest width and ext==prefer boosted by sort key
        chosen = under[0]
    else:
        # pick the smallest available (closest above)
        candidates.sort(key=lambda t: t[0])
        # Reorder by preferred ext among the smallest width set
        smallest_w = candidates[0][0]
        smallest = [c for c in candidates if c[0] == smallest_w]
        # prefer format if present
        preferred = [c for c in smallest if c[1] == prefer] or smallest
        chosen = preferred[0]

    if not chosen:
        return None
    rel_deriv = chosen[2].relative_to(DERIV_ROOT).as_posix()
    return build_derivative_url(rel_deriv)
