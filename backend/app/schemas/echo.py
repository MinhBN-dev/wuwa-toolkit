import uuid
from datetime import datetime
from pydantic import BaseModel


class SubStat(BaseModel):
    type: str
    value: float


class EchoCreate(BaseModel):
    character_id: uuid.UUID | None = None
    echo_name: str
    echo_set: str | None = None
    echo_element: str | None = None
    echo_cost: int = 4
    main_stat_type: str | None = None
    main_stat_value: float | None = None
    sub_stats: list[SubStat]
    total_er: float | None = None
    score: float | None = None
    score_percent: float | None = None
    tier: str | None = None


class CharacterResponse(BaseModel):
    id: uuid.UUID
    name: str
    element: str
    weapon_type: str
    role: str

    model_config = {"from_attributes": True}


class EchoResponse(BaseModel):
    id: uuid.UUID
    character_id: uuid.UUID | None
    character: CharacterResponse | None
    echo_name: str
    echo_set: str | None
    echo_element: str | None
    echo_cost: int
    main_stat_type: str | None
    main_stat_value: float | None
    sub_stats: list[SubStat]
    total_er: float | None
    score: float | None
    score_percent: float | None
    tier: str | None
    image_path: str | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class EchoListResponse(BaseModel):
    echoes: list[EchoResponse]
    total: int


class OcrResult(BaseModel):
    echo_name: str
    echo_set: str | None = None
    echo_element: str | None = None
    echo_cost: int | None = None
    main_stat_type: str | None = None
    main_stat_value: float | None = None
    sub_stats: list[SubStat]
    confidence: float = 1.0
    raw_text: str | None = None
    provider: str | None = None  # which OCR provider succeeded


class ScoreRequest(BaseModel):
    character_id: uuid.UUID | None = None
    character_name: str | None = None
    echo_cost: int = 4
    main_stat_type: str | None = None
    main_stat_value: float | None = None
    sub_stats: list[SubStat]
    total_er: float | None = None


class ScoreResponse(BaseModel):
    score: float
    score_percent: float
    tier: str
    tier_label: str | None = None
    breakdown: dict[str, float]
    max_possible: float
    character_name: str | None


class EchoSetItem(BaseModel):
    """One echo in a full-set request."""
    echo_name: str = ""
    sub_stats: list[SubStat]


class SetScoreRequest(BaseModel):
    character_name: str | None = None
    character_id: uuid.UUID | None = None
    echoes: list[EchoSetItem]          # 1–5 echoes
    total_er: float | None = None


class EchoSetResult(BaseModel):
    echo_name: str
    score: float
    score_percent: float
    tier: str
    tier_label: str | None
    breakdown: dict[str, float]
    max_possible: float


class SetScoreResponse(BaseModel):
    echoes: list[EchoSetResult]
    set_score: float          # Σ AV / Σ EP × 100
    set_score_raw: float      # Σ AV
    set_ep: float             # Σ EP
    set_tier: str
    set_tier_label: str | None
    character_name: str | None


# ── Saved echo sets ────────────────────────────────────────────────────────────

class EchoSetSlot(BaseModel):
    """One slot in a saved set (may be empty)."""
    echo_id: uuid.UUID | None = None   # reference to echoes table
    echo_name: str = ""
    echo_cost: int = 4
    sub_stats: list[SubStat] = []
    score: float | None = None
    score_percent: float | None = None
    tier: str | None = None
    tier_label: str | None = None


class EchoSetSaveRequest(BaseModel):
    name: str
    character_id: uuid.UUID | None = None
    character_name: str | None = None
    total_er: float | None = None
    slots: list[EchoSetSlot]          # always 5 items
    set_score: float | None = None
    set_tier: str | None = None


class EchoSetResponse(BaseModel):
    id: uuid.UUID
    name: str
    character_name: str | None
    total_er: float | None
    slots: list[EchoSetSlot]
    set_score: float | None
    set_tier: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
