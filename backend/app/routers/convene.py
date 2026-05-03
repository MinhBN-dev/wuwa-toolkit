"""Convene (gacha) history tracker.

Endpoints:
- POST /convene/import       — paste in-game export URL → sync all pools
- GET  /convene/players      — list synced players (UID + last pull)
- GET  /convene/history      — paginated raw history (filter pool/rarity)
- GET  /convene/stats        — per-pool pity, 5★ list, counts
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.echo import ConvenePull
from app.schemas.echo import (
    ConveneHistoryResponse,
    ConveneImportRequest,
    ConveneImportResponse,
    ConvenePoolImport,
    ConvenePoolStats,
    ConvenePlayerSummary,
    ConvenePullResponse,
    ConveneStatsResponse,
)
from app.services.convene_service import (
    POOL_TYPES,
    ConveneUrlError,
    fetch_all_pools,
    parse_export_url,
)

router = APIRouter(prefix="/convene", tags=["Convene"])

POOL_LABEL = {pt: label for pt, label in POOL_TYPES}

# Pools shown in the UI — always emit a stats entry for these even when the
# user has 0 pulls there (so the tab stays visible).
VISIBLE_POOLS = (1, 2, 3, 4)

# Standard pool 5★ resonators — used to detect 50/50 losses on pool 1.
# When a 5★ pull on the Featured Resonator banner is one of these names,
# the player "lost" the 50/50 (got a standard char instead of the featured).
STANDARD_5_RESONATORS = {"Calcharo", "Encore", "Jianxin", "Lingyang", "Verina"}

ASTRITES_PER_PULL = 160


@router.post("/import", response_model=ConveneImportResponse)
async def import_history(payload: ConveneImportRequest, db: AsyncSession = Depends(get_db)):
    try:
        parsed = parse_export_url(payload.url)
    except ConveneUrlError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        all_pulls = await fetch_all_pools(parsed)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"WuWa API call failed: {e}")

    pools_summary: list[ConvenePoolImport] = []
    total_added = 0
    total_fetched = 0

    for pool_type, label in POOL_TYPES:
        records = all_pulls.get(pool_type, [])
        total_fetched += len(records)
        added = 0
        if records:
            stmt = (
                pg_insert(ConvenePull)
                .values(records)
                .on_conflict_do_nothing(index_elements=["player_id", "card_pool_type", "pull_id"])
                .returning(ConvenePull.id)
            )
            result = await db.execute(stmt)
            added = len(result.scalars().all())
        pools_summary.append(
            ConvenePoolImport(pool_type=pool_type, pool_label=label, fetched=len(records), added=added)
        )
        total_added += added

    await db.commit()

    return ConveneImportResponse(
        player_id=parsed["player_id"],
        svr_id=parsed["svr_id"],
        pools=pools_summary,
        total_added=total_added,
        total_fetched=total_fetched,
    )


@router.get("/players", response_model=list[ConvenePlayerSummary])
async def list_players(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(
            ConvenePull.player_id,
            func.count(ConvenePull.id),
            func.max(ConvenePull.time),
        )
        .group_by(ConvenePull.player_id)
        .order_by(desc(func.max(ConvenePull.time)))
    )
    rows = (await db.execute(stmt)).all()
    return [
        ConvenePlayerSummary(player_id=pid, total_pulls=cnt, last_pull_time=last)
        for pid, cnt, last in rows
    ]


@router.get("/history", response_model=ConveneHistoryResponse)
async def get_history(
    player_id: str = Query(...),
    pool_type: int | None = Query(None, ge=1, le=7),
    rarity: int | None = Query(None, ge=3, le=5),
    min_rarity: int = Query(4, ge=3, le=5),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """Paginated history with per-row pity. Defaults to 4★+5★ only.

    Pity-at-pull is rarity-specific:
    - For a 5★ row: pulls since the previous 5★ (in the same pool).
    - For a 4★ row: pulls since the previous 4★+ (4★ or 5★, whichever came first).
    Computed in Python by walking ALL pulls for the player+pool oldest-first;
    we then page through the filtered subset.
    """
    # Full pull list for the player (and optional pool filter), oldest-first.
    # Needed to compute per-row pity correctly even when paging.
    full_q = select(ConvenePull).where(ConvenePull.player_id == player_id)
    if pool_type is not None:
        full_q = full_q.where(ConvenePull.card_pool_type == pool_type)
    full_q = full_q.order_by(ConvenePull.card_pool_type.asc(), ConvenePull.time.asc(), ConvenePull.pull_id.asc())
    all_pulls = (await db.execute(full_q)).scalars().all()

    # Walk per pool, compute pity-at-pull for each
    pity_map: dict[tuple[int, str], int] = {}
    by_pool: dict[int, list[ConvenePull]] = {}
    for p in all_pulls:
        by_pool.setdefault(p.card_pool_type, []).append(p)
    for pool_pulls in by_pool.values():
        pity_5 = 0
        pity_4 = 0
        for p in pool_pulls:
            pity_5 += 1
            pity_4 += 1
            if p.quality_level == 5:
                pity_map[(p.card_pool_type, p.pull_id)] = pity_5
                pity_5 = 0
                pity_4 = 0  # 5★ also resets the 4★ counter
            elif p.quality_level == 4:
                pity_map[(p.card_pool_type, p.pull_id)] = pity_4
                pity_4 = 0
            # 3★ rows: no pity number recorded (won't be displayed anyway)

    # Apply rarity filter, sort newest-first, page
    if rarity is not None:
        filtered = [p for p in all_pulls if p.quality_level == rarity]
    else:
        filtered = [p for p in all_pulls if p.quality_level >= min_rarity]

    filtered.sort(key=lambda p: (p.time, p.pull_id), reverse=True)
    total = len(filtered)
    page = filtered[skip : skip + limit]

    items = [
        ConvenePullResponse(
            pull_id=r.pull_id,
            name=r.name,
            item_type=r.item_type,
            quality_level=r.quality_level,
            resource_id=r.resource_id,
            time=r.time,
            card_pool_type=r.card_pool_type,
            pity=pity_map.get((r.card_pool_type, r.pull_id)),
        )
        for r in page
    ]
    return ConveneHistoryResponse(items=items, total=total, skip=skip, limit=limit)


@router.delete("/players/{player_id}", status_code=204)
async def delete_player(player_id: str, db: AsyncSession = Depends(get_db)):
    """Wipe a player's entire pull history."""
    result = await db.execute(select(ConvenePull).where(ConvenePull.player_id == player_id))
    rows = result.scalars().all()
    if not rows:
        raise HTTPException(status_code=404, detail="No pulls for player")
    for r in rows:
        await db.delete(r)
    await db.commit()


@router.get("/stats", response_model=ConveneStatsResponse)
async def get_stats(player_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    """Pity & 5★ analytics per pool. Always emits an entry for each VISIBLE_POOL
    (1-4), even when the player has 0 pulls there — so the UI tab stays visible.
    Pool 1 (Featured Resonator) additionally returns 50/50 win/loss stats based
    on whether each 5★ was a standard-pool char (loss) or the limited featured (win).
    """
    stmt = (
        select(ConvenePull)
        .where(ConvenePull.player_id == player_id)
        .order_by(ConvenePull.card_pool_type.asc(), ConvenePull.time.asc(), ConvenePull.pull_id.asc())
    )
    rows = (await db.execute(stmt)).scalars().all()
    if not rows:
        raise HTTPException(status_code=404, detail="No pulls for player")

    by_pool: dict[int, list[ConvenePull]] = {}
    for p in rows:
        by_pool.setdefault(p.card_pool_type, []).append(p)

    pool_stats: list[ConvenePoolStats] = []
    last_synced = max((p.created_at for p in rows), default=None)

    for pool_type in VISIBLE_POOLS:
        label = POOL_LABEL.get(pool_type, f"Pool {pool_type}")
        pulls = by_pool.get(pool_type, [])
        total = len(pulls)
        five_count = sum(1 for p in pulls if p.quality_level == 5)
        four_count = sum(1 for p in pulls if p.quality_level == 4)

        # Walk forward computing pity-at-pull. Reset on each 5★ (and 4★).
        five_stars: list[ConvenePullResponse] = []
        pity_since_5 = 0
        pity_since_4 = 0
        five_pities: list[int] = []
        for p in pulls:
            pity_since_5 += 1
            pity_since_4 += 1
            if p.quality_level == 5:
                five_stars.append(
                    ConvenePullResponse(
                        pull_id=p.pull_id,
                        name=p.name,
                        item_type=p.item_type,
                        quality_level=p.quality_level,
                        resource_id=p.resource_id,
                        time=p.time,
                        pity=pity_since_5,
                    )
                )
                five_pities.append(pity_since_5)
                pity_since_5 = 0
            if p.quality_level >= 4:
                pity_since_4 = 0

        # 50/50 stats — only meaningful for Featured Resonator pool. WuWa rule:
        # losing a 50/50 (pulling a standard 5★) makes the NEXT 5★ a guaranteed
        # featured. That guaranteed pull is NOT a real 50/50 attempt and must
        # be excluded from the win rate. We walk pulls oldest-first, tracking
        # a `guaranteed_next` flag, and only count "real" attempts.
        wins_50_50: int | None = None
        losses_50_50: int | None = None
        win_rate_50_50: float | None = None
        if pool_type == 1:
            real_wins = 0
            real_losses = 0
            guaranteed_next = False
            for p in pulls:           # `pulls` is already sorted oldest-first
                if p.quality_level != 5:
                    continue
                if guaranteed_next:
                    # Forced featured pull — don't count as a 50/50 attempt.
                    guaranteed_next = False
                    continue
                if p.name in STANDARD_5_RESONATORS:
                    real_losses += 1
                    guaranteed_next = True
                else:
                    real_wins += 1
                    # winning a 50/50 keeps the next pull also at 50/50
            wins_50_50 = real_wins
            losses_50_50 = real_losses
            decided = real_wins + real_losses
            win_rate_50_50 = (real_wins / decided * 100) if decided > 0 else None

        pool_stats.append(
            ConvenePoolStats(
                pool_type=pool_type,
                pool_label=label,
                total=total,
                total_astrites=total * ASTRITES_PER_PULL,
                five_star_count=five_count,
                four_star_count=four_count,
                pity_5=pity_since_5,
                pity_4=pity_since_4,
                avg_pity_5=(sum(five_pities) / len(five_pities)) if five_pities else None,
                pull_ratio=(five_count / total * 100) if total > 0 else None,
                wins_50_50=wins_50_50,
                losses_50_50=losses_50_50,
                win_rate_50_50=win_rate_50_50,
                five_stars=list(reversed(five_stars)),  # newest first
            )
        )

    return ConveneStatsResponse(
        player_id=player_id, last_synced_at=last_synced, pools=pool_stats
    )
