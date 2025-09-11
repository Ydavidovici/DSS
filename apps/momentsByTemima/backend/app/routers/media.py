# app/routers/media.py
from __future__ import annotations
from typing import Optional, List, Dict

from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException, Query
from ..services.media import (
    save_upload,
    list_originals,
    list_derivatives,
    file_metadata,
    delete_original_and_derivatives,
    pick_best_derivative,
)
from ..services.image_utils import generate_derivatives
from ..settings import settings

router = APIRouter(prefix="", tags=["media"])  # mounted under /api in main.py


@router.post("/upload")
async def upload_image(background: BackgroundTasks, file: UploadFile = File(...)):
    """
    Stream upload, then kick off background derivative generation.
    """
    rel, url = await save_upload(file)
    background.add_task(generate_derivatives, rel)
    return {
        "ok": True,
        "file": {"rel": rel, "url": url, "content_type": file.content_type},
        "derivatives": {
            "base": "/media-deriv",
            "widths": settings.DERIV_WIDTHS,
            "quality": settings.DERIV_QUALITY,
        },
    }


@router.get("/assets")
def list_assets(prefix: Optional[str] = None) -> Dict[str, List[str]]:
    """
    List originals and derivatives. Use for simple galleries or polling after upload.
    """
    return {
        "media_base": settings.MEDIA_BASE_URL,
        "media_deriv_base": "/media-deriv",
        "originals": list_originals(prefix=prefix),
        "derivatives": list_derivatives(prefix=prefix),
    }


@router.get("/assets/meta")
def asset_meta(rel: str):
    """
    Metadata + URLs for a single original (and discovered derivatives).
    """
    return file_metadata(rel)


@router.get("/assets/best")
def best_derivative(
    rel: str,
    max_width: int = Query(..., ge=1, description="Max pixel width desired by the client"),
    prefer: str = Query("avif", pattern="^(avif|webp)$"),
):
    """
    Pick the 'best' derivative URL for the requested width and format hint.
    Returns {url: str} or 404 if none exist.
    """
    url = pick_best_derivative(rel, max_width=max_width, prefer=prefer)
    if not url:
        raise HTTPException(status_code=404, detail="No derivative available")
    return {"url": url}


@router.delete("/assets")
def delete_asset(rel: str):
    """
    Dev helper: delete an original and its derivatives.
    """
    delete_original_and_derivatives(rel)
    return {"ok": True}
