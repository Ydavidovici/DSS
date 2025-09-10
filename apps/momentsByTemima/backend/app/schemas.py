from pydantic import BaseModel, EmailStr, Field
from datetime import datetime

class ImageOut(BaseModel):
    id: int
    url: str
    alt: str = ""
    category: str = ""
    featured: bool = False
    sort_order: int = 0
    created_at: datetime
    class Config:
        from_attributes = True

class ContactCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    email: EmailStr
    message: str = Field(..., min_length=5, max_length=2000)

class BookingCreate(BaseModel):
    name: str
    email: EmailStr
    message: str
    preferredDateTime: str | None = None

class Ok(BaseModel):
    ok: bool = True

class BookingOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    message: str
    preferred_datetime: str | None = None
    status: str
    created_at: datetime
    class Config:
        from_attributes = True
