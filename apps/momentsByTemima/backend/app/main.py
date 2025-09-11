# app/main.py
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .settings import settings
from .db import Base, engine
from .routers import public, admin, media as media_router

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB init (simple for dev)
Base.metadata.create_all(bind=engine)

# Routers
api = FastAPI()
api.include_router(public.router)
api.include_router(admin.router)
api.include_router(media_router.router)
app.mount(settings.API_PREFIX, api)

# Ensure media dirs exist
Path(settings.MEDIA_ROOT).mkdir(parents=True, exist_ok=True)
Path(settings.MEDIA_DERIV_ROOT).mkdir(parents=True, exist_ok=True)

# Static mounts
app.mount(
    settings.MEDIA_BASE_URL,
    StaticFiles(directory=settings.MEDIA_ROOT),
    name="media",
)
app.mount(
    "/media-deriv",
    StaticFiles(directory=settings.MEDIA_DERIV_ROOT),
    name="media-deriv",
)
