from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..deps import get_db
from .. import models, schemas
from ..services.email import send_email

router = APIRouter(tags=["public"])

@router.get("/health")
async def health():
    return {"status": "ok"}

@router.get("/portfolio", response_model=dict)
async def get_portfolio(db: Session = Depends(get_db)):
    imgs = db.query(models.Image).order_by(models.Image.sort_order.asc(), models.Image.created_at.desc()).all()
    return {"images": [schemas.ImageOut.model_validate(i).model_dump() for i in imgs]}

@router.post("/contact", response_model=schemas.Ok, status_code=201)
async def contact(payload: schemas.ContactCreate, db: Session = Depends(get_db)):
    m = models.ContactMessage(name=payload.name, email=payload.email, message=payload.message)
    db.add(m)
    db.commit()
    send_email("New contact message", f"Name: {payload.name}\nEmail: {payload.email}\n\n{payload.message}")
    return schemas.Ok()

@router.post("/bookings", response_model=schemas.Ok, status_code=201)
async def bookings(payload: schemas.BookingCreate, db: Session = Depends(get_db)):
    b = models.Booking(
        name=payload.name, email=payload.email, message=payload.message,
        preferred_datetime=payload.preferredDateTime or ""
    )
    db.add(b)
    db.commit()
    send_email(
        "New booking request",
        f"Name: {payload.name}\nEmail: {payload.email}\nPreferred: {payload.preferredDateTime}\n\n{payload.message}"
    )
    return schemas.Ok()
