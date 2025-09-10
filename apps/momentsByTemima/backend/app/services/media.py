from pathlib import Path
from fastapi import UploadFile
from ..settings import settings

MEDIA_ROOT = Path(settings.MEDIA_ROOT)
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

async def save_upload(file: UploadFile) -> tuple[str, str]:
    # returns (relative_path, public_url)
    dest = MEDIA_ROOT / file.filename
    # ensure unique
    i = 1
    while dest.exists():
        stem = Path(file.filename).stem
        suffix = Path(file.filename).suffix
        dest = MEDIA_ROOT / f"{stem}_{i}{suffix}"
        i += 1
    data = await file.read()
    dest.write_bytes(data)
    rel = dest.relative_to(MEDIA_ROOT).as_posix()
    url = f"{settings.MEDIA_BASE_URL}/{rel}"
    return rel, url
