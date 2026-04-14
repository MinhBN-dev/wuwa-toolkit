import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.echo import Character
from app.schemas.echo import CharacterResponse
from app.data.game_data import CHARACTER_DATA, ECHO_SETS, ECHO_ELEMENTS, MAIN_STAT_OPTIONS, SUBSTAT_MAX, SUBSTAT_ROLLS
from app.services.scoring_service import EVC_TO_DISPLAY

router = APIRouter(prefix="/characters", tags=["Characters"])


@router.get("", response_model=list[CharacterResponse])
async def list_characters(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Character).order_by(Character.name))
    return result.scalars().all()


@router.get("/game-data")
async def get_game_data():
    """Return all static game data needed by the frontend."""
    # Build sub_stat_max in display format (frontend stat names)
    sub_stat_max_display = {
        EVC_TO_DISPLAY.get(k, k): v
        for k, v in SUBSTAT_MAX.items()
    }

    # Per-character stat weights in display format {char_name: {stat: weight}}
    # Only include stats with weight > 0; sorted by weight desc
    character_weights: dict[str, dict[str, float]] = {}
    character_er: dict[str, dict] = {}
    for char_name, data in CHARACTER_DATA.items():
        rv: dict[str, float] = data.get("rv", {})
        er_params: list = data.get("er", [100.0, 0.0, 125.0])
        er_target = er_params[0] if len(er_params) > 0 else 100.0
        er_imp    = er_params[1] if len(er_params) > 1 else 0.0

        weights_display: dict[str, float] = {}
        for evc_name, weight in rv.items():
            if weight > 0:
                display = EVC_TO_DISPLAY.get(evc_name, evc_name)
                weights_display[display] = round(weight, 4)
        # ER% is a separate param — include if er_imp > 0
        if er_imp > 0:
            weights_display["ER%"] = round(er_imp, 4)
        character_weights[char_name] = weights_display

        # ER info: target% + importance tier (Min/Norm/Vital/Max)
        if er_imp >= 0.9:
            er_imp_label = "Max"
        elif er_imp >= 0.65:
            er_imp_label = "Vital"
        elif er_imp >= 0.3:
            er_imp_label = "Norm"
        else:
            er_imp_label = "Min"
        character_er[char_name] = {
            "er_target": er_target,
            "er_imp": round(er_imp, 4),
            "er_imp_label": er_imp_label,
        }

    # Sub-stat rolls in display format
    sub_stat_rolls_display = {
        EVC_TO_DISPLAY.get(k, k): v
        for k, v in SUBSTAT_ROLLS.items()
    }

    return {
        "echo_sets": ECHO_SETS,
        "echo_elements": ECHO_ELEMENTS,
        "main_stat_options": MAIN_STAT_OPTIONS,
        "sub_stat_types": list(sub_stat_max_display.keys()),
        "sub_stat_max": sub_stat_max_display,
        "sub_stat_rolls": sub_stat_rolls_display,
        "characters": list(CHARACTER_DATA.keys()),
        "character_weights": character_weights,
        "character_er": character_er,
    }
