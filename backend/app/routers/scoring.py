import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.echo import Character
from app.schemas.echo import ScoreRequest, ScoreResponse, SetScoreRequest, SetScoreResponse, EchoSetResult
from app.services.scoring_service import calculate_score, _get_tier, _get_tier_label

router = APIRouter(prefix="/score", tags=["Scoring"])


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


@router.post("/calculate", response_model=ScoreResponse)
async def calculate_echo_score(
    payload: ScoreRequest,
    db: AsyncSession = Depends(get_db),
):
    """Calculate echo score for given sub-stats and character."""
    character_name = await _resolve_char_name(payload.character_id, payload.character_name, db)
    sub_stats_dicts = [s.model_dump() for s in payload.sub_stats]
    result = calculate_score(sub_stats_dicts, character_name, payload.total_er)
    return ScoreResponse(**result, character_name=character_name)


@router.post("/calculate-set", response_model=SetScoreResponse)
async def calculate_set_score(
    payload: SetScoreRequest,
    db: AsyncSession = Depends(get_db),
):
    """Calculate scores for a full set of up to 5 echoes."""
    character_name = await _resolve_char_name(payload.character_id, payload.character_name, db)

    echo_results: list[EchoSetResult] = []
    total_av = 0.0
    total_ep = 0.0

    for echo in payload.echoes:
        sub_stats_dicts = [s.model_dump() for s in echo.sub_stats]
        r = calculate_score(sub_stats_dicts, character_name, payload.total_er)
        total_av += r["score"]
        total_ep += r["max_possible"]
        echo_results.append(EchoSetResult(
            echo_name=echo.echo_name or "Echo",
            score=r["score"],
            score_percent=r["score_percent"],
            tier=r["tier"],
            tier_label=r.get("tier_label"),
            breakdown=r["breakdown"],
            max_possible=r["max_possible"],
        ))

    n = len(echo_results)
    set_score = round(sum(e.score_percent for e in echo_results) / n if n > 0 else 0.0, 4)
    set_tier = _get_tier(set_score)
    set_tier_label = _get_tier_label(set_score)

    return SetScoreResponse(
        echoes=echo_results,
        set_score=set_score,
        set_score_raw=round(total_av, 4),
        set_ep=round(total_ep, 4),
        set_tier=set_tier,
        set_tier_label=set_tier_label,
        character_name=character_name,
    )
