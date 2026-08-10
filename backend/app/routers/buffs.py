import re

from fastapi import APIRouter

from app.data.buff_data import (
    BUFF_CATEGORIES,
    BUFF_CHARACTER_ORDER,
    BUFF_DATA,
    BUFF_GROUP_ORDER,
    WEAPON_DATA,
)
from app.data.game_data import CHARACTER_DATA
from app.schemas.echo import BuffDataResponse

router = APIRouter(prefix="/buffs", tags=["Buffs"])


def _base_name(name: str) -> str:
    """Strip the role suffix — mirrors frontend `getBaseName` (Rover variants stay whole)."""
    if name.startswith("Rover ("):
        return name.strip()
    return re.sub(r"\s*\(.*\)$", "", name).strip()


def _element_role_index() -> dict[str, tuple[str, str]]:
    """{base name: (element, role)} from CHARACTER_DATA — avoids duplicating it in buff_data."""
    index: dict[str, tuple[str, str]] = {}
    for name, data in CHARACTER_DATA.items():
        index.setdefault(_base_name(name), (data.get("element", ""), data.get("role", "")))
    return index


@router.get("", response_model=BuffDataResponse)
async def get_buffs():
    """Static team-buff table: buff categories (rows) + buffer characters (columns)."""
    index = _element_role_index()

    characters = []
    for name in BUFF_CHARACTER_ORDER:
        entry = BUFF_DATA[name]
        element, role = index.get(name, (None, None))
        characters.append(
            {
                "name": name,
                "element": element,
                "role": role,
                "patch_verified": entry["patch_verified"],
                "sources": entry.get("sources", []),
                "notes": entry.get("notes", ""),
                "buffs": entry["buffs"],
                "weapon": WEAPON_DATA.get(name),
            }
        )

    return {
        "categories": BUFF_CATEGORIES,
        "group_order": BUFF_GROUP_ORDER,
        "characters": characters,
    }
