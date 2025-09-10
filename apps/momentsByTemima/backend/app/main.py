from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .settings import settings
from .db import Base, engine
from .routers import public, admin

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
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
app.mount(settings.API_PREFIX, api)

# Media
app.mount("/media", StaticFiles(directory=settings.MEDIA_ROOT), name="media")
