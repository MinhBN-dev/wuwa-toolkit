import uuid
from datetime import datetime
from sqlalchemy import String, Float, Integer, JSON, DateTime, ForeignKey, Text, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    element: Mapped[str] = mapped_column(String(50), nullable=False)
    weapon_type: Mapped[str] = mapped_column(String(50), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # DPS, SubDPS, Support, Healer

    echoes: Mapped[list["Echo"]] = relationship("Echo", back_populates="character")


class Echo(Base):
    __tablename__ = "echoes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    character_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("characters.id"), nullable=True)

    # Echo identity
    echo_name: Mapped[str] = mapped_column(String(150), nullable=False)
    echo_set: Mapped[str] = mapped_column(String(100), nullable=True)
    echo_element: Mapped[str] = mapped_column(String(50), nullable=True)
    echo_cost: Mapped[int] = mapped_column(Integer, nullable=False, default=4)  # 1, 3, or 4

    # Main stat (optional — not used in scoring)
    main_stat_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    main_stat_value: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Sub-stats stored as JSON: [{type, value}, ...]
    sub_stats: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # Build context
    total_er: Mapped[float] = mapped_column(Float, nullable=True)  # Total ER% of the build

    # Scoring
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_percent: Mapped[float | None] = mapped_column(Float, nullable=True)  # 0-100
    tier: Mapped[str | None] = mapped_column(String(50), nullable=True)  # EVC label

    # Image
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    character: Mapped["Character | None"] = relationship("Character", back_populates="echoes")


class CharacterProfile(Base):
    """Server-side storage for per-character build status and notes."""
    __tablename__ = "character_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    character_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    build_status: Mapped[str] = mapped_column(String(20), nullable=False, default="not_built")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EchoSet(Base):
    __tablename__ = "echo_sets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    character_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("characters.id"), nullable=True)
    character_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    total_er: Mapped[float | None] = mapped_column(Float, nullable=True)
    # JSON list of slot objects: [{echo_name, echo_cost, sub_stats, score, score_percent, tier}]
    slots: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    set_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    set_tier: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ConvenePull(Base):
    """One gacha pull recorded from in-game Convene History.

    Dedup key: (player_id, card_pool_type, pull_id) — the WuWa gacha API gives no
    per-pull id, so pull_id is synthesized as a stable timestamp-anchored string
    (`synth_pull_id`: <YYYYMMDDHHMMSS>-<NN>); unique per player+pool.
    """
    __tablename__ = "convene_pulls"
    __table_args__ = (
        UniqueConstraint("player_id", "card_pool_type", "pull_id", name="uq_convene_pull"),
        Index("ix_convene_player_pool_time", "player_id", "card_pool_type", "time"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    player_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    card_pool_type: Mapped[int] = mapped_column(Integer, nullable=False)  # 1..7
    pull_id: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    item_type: Mapped[str] = mapped_column(String(40), nullable=False)  # "Resonator" / "Weapon"
    quality_level: Mapped[int] = mapped_column(Integer, nullable=False)  # 3 / 4 / 5
    resource_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
