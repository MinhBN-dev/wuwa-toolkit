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


# ── Character profiles ─────────────────────────────────────────────────────────

class CharacterProfileUpsert(BaseModel):
    build_status: str = "not_built"   # not_built | building | built
    notes: str | None = None


class CharacterProfileResponse(BaseModel):
    character_name: str
    build_status: str
    notes: str | None

    model_config = {"from_attributes": True}


class BulkProfileUpsert(BaseModel):
    """Bulk upsert — used for one-time localStorage migration."""
    profiles: dict[str, CharacterProfileUpsert]


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


# ── Convene tracker ────────────────────────────────────────────────────────────

class ConveneImportRequest(BaseModel):
    url: str


class ConvenePoolImport(BaseModel):
    pool_type: int
    pool_label: str
    fetched: int
    added: int


class ConveneImportResponse(BaseModel):
    player_id: str
    svr_id: str
    pools: list[ConvenePoolImport]
    total_added: int
    total_fetched: int


class ConvenePullResponse(BaseModel):
    pull_id: str
    name: str
    item_type: str
    quality_level: int
    resource_id: int | None
    time: datetime
    pity: int | None = None  # filled by stats endpoint, not history list
    card_pool_type: int | None = None  # filled by history endpoint
    pull_no: int | None = None  # 1-based chronological position within the pool (incl. 3★)

    model_config = {"from_attributes": True}


class ConveneHistoryResponse(BaseModel):
    items: list[ConvenePullResponse]
    total: int
    skip: int
    limit: int


class ConvenePoolStats(BaseModel):
    pool_type: int
    pool_label: str
    total: int
    total_astrites: int                      # total × 160 (cost per pull)
    five_star_count: int
    four_star_count: int
    pity_5: int       # pulls since last 5★ (current pity)
    pity_4: int       # pulls since last 4★
    avg_pity_5: float | None
    pull_ratio: float | None                 # 5★ / total × 100
    # 50/50 stats — only meaningful for pool 1 (Featured Resonator)
    wins_50_50: int | None = None            # 5★ that were the limited featured
    losses_50_50: int | None = None          # 5★ that were a standard pool char
    win_rate_50_50: float | None = None      # wins / (wins + losses) × 100
    five_stars: list[ConvenePullResponse]   # 5★ history with pity-at-pull


class ConveneStatsResponse(BaseModel):
    player_id: str
    last_synced_at: datetime | None
    pools: list[ConvenePoolStats]


class ConvenePlayerSummary(BaseModel):
    player_id: str
    total_pulls: int
    last_pull_time: datetime | None


# ── Team buffs (static lookup data — see app/data/buff_data.py) ────────────────


class BuffCategory(BaseModel):
    key: str
    label: str
    group: str
    unit: str


class BuffEntry(BaseModel):
    cat: str
    value: float | None = None
    text: str | None = None          # shown when `value` is None
    applies_to: str = "All-Type"
    target: str = "team"             # team | next | enemy | self
    seq: int = 0                     # 0 = base kit, 1-6 = Resonance Chain node
    replaces: bool = False           # supersedes same-cat base entry instead of stacking
    source: str = ""
    duration: float | None = None    # seconds
    condition: str = ""
    confidence: str = "medium"       # high | medium | low


class BuffWeaponStat(BaseModel):
    stat: str
    value: float


class BuffWeapon(BaseModel):
    """Vũ khí trấn (signature) ở R1 — bật/tắt bằng tick "Trấn" trên từng cột.

    `buffs` CHỈ gồm phần cộng thêm mô tả trong weapon skill. `base_atk` + `main_stat`
    là stat nền của vũ khí, giữ lại để hiển thị tham khảo chứ không tính vào bảng.
    """
    name: str
    rarity: int = 5
    type: str = ""
    base_atk: float | None = None
    main_stat: BuffWeaponStat | None = None
    sources: list[str] = []
    buffs: list[BuffEntry]


class BuffCharacter(BaseModel):
    name: str
    element: str | None = None
    role: str | None = None
    patch_verified: str
    sources: list[str] = []
    notes: str = ""
    buffs: list[BuffEntry]
    weapon: BuffWeapon | None = None   # None = không có vũ khí trấn → UI khoá tick


class BuffDataResponse(BaseModel):
    categories: list[BuffCategory]
    group_order: list[str]
    characters: list[BuffCharacter]
