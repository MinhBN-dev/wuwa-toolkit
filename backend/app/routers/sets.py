import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.echo import EchoSet, Character
from app.schemas.echo import EchoSetSaveRequest, EchoSetResponse

router = APIRouter(prefix="/sets", tags=["Echo Sets"])


async def _resolve_char_name(
    character_id: uuid.UUID | None,
    character_name: str | None,
    db: AsyncSession,
) -> str | None:
    if character_name:
        return character_name
    if character_id:
        result = await db.execute(select(Character).where(Character.id == character_id))
        char = result.scalar_one_or_none()
        if char:
            return char.name
    return None


@router.post("", response_model=EchoSetResponse, status_code=201)
async def save_echo_set(payload: EchoSetSaveRequest, db: AsyncSession = Depends(get_db)):
    character_name = await _resolve_char_name(payload.character_id, payload.character_name, db)
    echo_set = EchoSet(
        name=payload.name,
        character_id=payload.character_id,
        character_name=character_name,
        total_er=payload.total_er,
        slots=[s.model_dump(mode="json") for s in payload.slots],
        set_score=payload.set_score,
        set_tier=payload.set_tier,
    )
    db.add(echo_set)
    await db.commit()
    await db.refresh(echo_set)
    return _to_response(echo_set)


@router.get("", response_model=list[EchoSetResponse])
async def list_echo_sets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EchoSet).order_by(EchoSet.created_at.desc()))
    return [_to_response(s) for s in result.scalars().all()]


@router.delete("/{set_id}", status_code=204)
async def delete_echo_set(set_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EchoSet).where(EchoSet.id == set_id))
    echo_set = result.scalar_one_or_none()
    if not echo_set:
        raise HTTPException(status_code=404, detail="Set not found")
    await db.delete(echo_set)
    await db.commit()


def _to_response(s: EchoSet) -> EchoSetResponse:
    from app.schemas.echo import EchoSetSlot, SubStat
    slots = [
        EchoSetSlot(
            echo_name=slot.get("echo_name", ""),
            echo_cost=slot.get("echo_cost", 4),
            sub_stats=[SubStat(**ss) for ss in slot.get("sub_stats", [])],
            score=slot.get("score"),
            score_percent=slot.get("score_percent"),
            tier=slot.get("tier"),
            tier_label=slot.get("tier_label"),
        )
        for slot in (s.slots or [])
    ]
    return EchoSetResponse(
        id=s.id,
        name=s.name,
        character_name=s.character_name,
        total_er=s.total_er,
        slots=slots,
        set_score=s.set_score,
        set_tier=s.set_tier,
        created_at=s.created_at,
    )
