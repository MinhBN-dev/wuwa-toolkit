from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import get_db
from app.models.echo import CharacterProfile
from app.schemas.echo import (
    CharacterProfileUpsert,
    CharacterProfileResponse,
    BulkProfileUpsert,
)

router = APIRouter(prefix="/character-profiles", tags=["Character Profiles"])


@router.get("", response_model=dict[str, CharacterProfileResponse])
async def get_all_profiles(db: AsyncSession = Depends(get_db)):
    """Return all character profiles keyed by character_name."""
    result = await db.execute(select(CharacterProfile))
    profiles = result.scalars().all()
    return {p.character_name: p for p in profiles}


@router.put("/{character_name}", response_model=CharacterProfileResponse)
async def upsert_profile(
    character_name: str,
    body: CharacterProfileUpsert,
    db: AsyncSession = Depends(get_db),
):
    """Create or update a single character's build status + notes."""
    stmt = (
        pg_insert(CharacterProfile)
        .values(
            character_name=character_name,
            build_status=body.build_status,
            notes=body.notes,
        )
        .on_conflict_do_update(
            index_elements=["character_name"],
            set_={"build_status": body.build_status, "notes": body.notes},
        )
        .returning(CharacterProfile)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.scalar_one()


@router.post("/bulk", response_model=dict[str, CharacterProfileResponse])
async def bulk_upsert_profiles(
    body: BulkProfileUpsert,
    db: AsyncSession = Depends(get_db),
):
    """Bulk upsert profiles — used for one-time localStorage → server migration."""
    if not body.profiles:
        return {}

    rows = [
        {
            "character_name": name,
            "build_status": p.build_status,
            "notes": p.notes,
        }
        for name, p in body.profiles.items()
    ]

    stmt = (
        pg_insert(CharacterProfile)
        .values(rows)
        .on_conflict_do_update(
            index_elements=["character_name"],
            set_={
                "build_status": pg_insert(CharacterProfile).excluded.build_status,
                "notes": pg_insert(CharacterProfile).excluded.notes,
            },
        )
        .returning(CharacterProfile)
    )
    result = await db.execute(stmt)
    await db.commit()
    profiles = result.scalars().all()
    return {p.character_name: p for p in profiles}
