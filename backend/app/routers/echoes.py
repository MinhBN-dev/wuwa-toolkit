import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.echo import Echo, Character
from app.schemas.echo import EchoCreate, EchoResponse, EchoListResponse

router = APIRouter(prefix="/echoes", tags=["Echoes"])


@router.get("", response_model=EchoListResponse)
async def list_echoes(
    character_id: uuid.UUID | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(Echo).options(selectinload(Echo.character))
    count_query = select(func.count()).select_from(Echo)

    if character_id:
        query = query.where(Echo.character_id == character_id)
        count_query = count_query.where(Echo.character_id == character_id)

    query = query.order_by(Echo.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    echoes = result.scalars().all()

    count_result = await db.execute(count_query)
    total = count_result.scalar()

    return EchoListResponse(echoes=echoes, total=total)


def _canonical_substats(sub_stats: list) -> list[dict]:
    """Sort substats by type for order-independent comparison."""
    normalized = []
    for s in sub_stats:
        if isinstance(s, dict):
            normalized.append({"type": s["type"], "value": round(float(s["value"]), 3)})
        else:
            normalized.append({"type": s.type, "value": round(float(s.value), 3)})
    return sorted(normalized, key=lambda x: x["type"])


@router.post("/find-or-create", response_model=EchoResponse, status_code=200)
async def find_or_create_echo(payload: EchoCreate, db: AsyncSession = Depends(get_db)):
    """Return existing echo if identical one exists, otherwise create new."""
    canonical = _canonical_substats(payload.sub_stats)

    # Fetch all echoes with same name and cost (narrow the search)
    result = await db.execute(
        select(Echo)
        .options(selectinload(Echo.character))
        .where(Echo.echo_name == payload.echo_name, Echo.echo_cost == payload.echo_cost)
    )
    candidates = result.scalars().all()

    for echo in candidates:
        if _canonical_substats(echo.sub_stats) == canonical:
            return echo

    # Not found — create new
    echo = Echo(
        **payload.model_dump(exclude={"sub_stats"}),
        sub_stats=[s.model_dump() for s in payload.sub_stats],
    )
    db.add(echo)
    await db.commit()
    await db.refresh(echo)

    result = await db.execute(
        select(Echo).options(selectinload(Echo.character)).where(Echo.id == echo.id)
    )
    return result.scalar_one()


@router.delete("/{echo_id}", status_code=204)
async def delete_echo(echo_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Echo).where(Echo.id == echo_id))
    echo = result.scalar_one_or_none()
    if not echo:
        raise HTTPException(status_code=404, detail="Echo not found")
    await db.delete(echo)
    await db.commit()
