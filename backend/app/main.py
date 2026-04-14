from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.config import settings
from app.database import init_db
from app.models.echo import Character
from app.data.game_data import CHARACTER_LIST
from app.routers import echoes, characters, ocr, scoring, sets, evc_status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import AsyncSessionLocal


async def seed_characters():
    """Seed character table with game data if empty."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Character).limit(1))
        if result.scalar_one_or_none():
            return  # Already seeded

        for char_data in CHARACTER_LIST:
            db.add(Character(**char_data))
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_characters()
    # Ensure upload dir exists
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="Echoes Optimizer API",
    description="Wuthering Waves echo management and scoring tool",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount upload directory for serving images
upload_path = Path(settings.UPLOAD_DIR)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_path)), name="uploads")

app.include_router(echoes.router, prefix="/api/v1")
app.include_router(characters.router, prefix="/api/v1")
app.include_router(ocr.router, prefix="/api/v1")
app.include_router(scoring.router, prefix="/api/v1")
app.include_router(sets.router, prefix="/api/v1")
app.include_router(evc_status.router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health():
    return {"status": "ok", "service": "echoes-optimizer"}
