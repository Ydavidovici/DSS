from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from ..deps import get_db, require_admin
from ..services.media import save_upload
from .. import models, schemas

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

@router.post("/images", response_model=schemas.ImageOut)
async def upload_image(
    file: UploadFile = File(...),
    alt: str = "",
    category: str = "",
    featured: bool = False,
    db: Session = Depends(get_db)
):
    rel, url = await save_upload(file)
    img = models.Image(file_path=rel, url=url, alt=alt, category=category, featured=featured)
    db.add(img)
    db.commit()
    db.refresh(img)
    return schemas.ImageOut.model_validate(img)

@router.delete("/images/{image_id}", response_model=schemas.Ok)
async def delete_image(image_id: int, db: Session = Depends(get_db)):
    img = db.get(models.Image, image_id)
    if img:
        db.delete(img)
        db.commit()
    return schemas.Ok()

@router.get("/bookings", response_model=list[schemas.BookingOut])
async def list_bookings(db: Session = Depends(get_db)):
    rows = db.query(models.Booking).order_by(models.Booking.created_at.desc()).all()
    return [schemas.BookingOut.model_validate(r) for r in rows]

@router.patch("/bookings/{booking_id}", response_model=schemas.BookingOut)
async def update_booking(booking_id: int, status: str, db: Session = Depends(get_db)):
    b = db.get(models.Booking, booking_id)
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    b.status = status
    db.add(b)
    db.commit()
    db.refresh(b)
    return schemas.BookingOut.model_validate(b)
