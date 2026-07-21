"""
Bulk re-scoring of all saved data after a weight / formula / metric change.

Scores are frozen snapshots (see EchoSet.slots + Echo.score). This re-runs the
current scoring engine over every saved echo set and echo and overwrites the
stored scores, so nothing is left stale after CHARACTER_DATA weights, the ER
model, TIER_THRESHOLDS, STAT_NAME_MAP, medians/max, or scoring_service logic
changes.

Reproduces the exact conventions the frontend uses when saving, so a recalc
with UNCHANGED weights is a no-op:
  - Sets use set-context scoring (calculate_set_score — shared sequential ER),
    NOT single-echo ×5.
  - set_score = mean of score_percent over the NON-EMPTY, non-"Not Applicable"
    slots (matches Set.tsx `currentSetScore`), NOT divided by 5.
  - Empty slots keep their null scores.
  - Standalone echoes use single-echo calculate_score with the echo's own
    character_id + total_er.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.echo import Echo, EchoSet, Character
from app.services.scoring_service import calculate_score, calculate_set_score, _get_tier_label


def _has_data(sub_stats) -> bool:
    return any(float(s.get("value", 0) or 0) > 0 for s in (sub_stats or []))


async def _char_name_by_id(char_id, cache: dict, db: AsyncSession) -> str | None:
    if char_id is None:
        return None
    if char_id not in cache:
        res = await db.execute(select(Character.name).where(Character.id == char_id))
        cache[char_id] = res.scalar_one_or_none()
    return cache[char_id]


async def recalculate_all(db: AsyncSession) -> dict:
    id_cache: dict = {}
    sets_total = sets_updated = 0
    echoes_total = echoes_updated = 0

    # ── Echo sets: set-context (shared ER) ──
    sets = (await db.execute(select(EchoSet))).scalars().all()
    for es in sets:
        sets_total += 1
        char_name = es.character_name or await _char_name_by_id(es.character_id, id_cache, db)
        slots = es.slots or []
        scored = calculate_set_score([s.get("sub_stats", []) for s in slots], char_name, es.total_er)

        new_slots: list = []
        scored_percents: list[float] = []
        changed = False
        for slot, r in zip(slots, scored):
            ns = dict(slot)
            if _has_data(slot.get("sub_stats")):
                if (ns.get("score") != r["score"] or ns.get("score_percent") != r["score_percent"]
                        or ns.get("tier") != r["tier"] or ns.get("tier_label") != r.get("tier_label")):
                    changed = True
                ns["score"] = r["score"]
                ns["score_percent"] = r["score_percent"]
                ns["tier"] = r["tier"]
                ns["tier_label"] = r.get("tier_label")
                if r.get("tier_label") != "Not Applicable":
                    scored_percents.append(r["score_percent"])
            new_slots.append(ns)

        new_score = (sum(scored_percents) / len(scored_percents)) if scored_percents else None
        new_tier = _get_tier_label(new_score) if new_score is not None else None
        if new_score != es.set_score or new_tier != es.set_tier:
            changed = True

        if changed:
            es.slots = new_slots
            flag_modified(es, "slots")
            es.set_score = new_score
            es.set_tier = new_tier
            sets_updated += 1

    # ── Standalone echoes: single-echo scoring with each echo's own context ──
    echoes = (await db.execute(select(Echo))).scalars().all()
    for e in echoes:
        echoes_total += 1
        if not _has_data(e.sub_stats):
            continue
        char_name = await _char_name_by_id(e.character_id, id_cache, db)
        r = calculate_score(list(e.sub_stats), char_name, e.total_er)
        if e.score != r["score"] or e.score_percent != r["score_percent"] or e.tier != r["tier"]:
            e.score = r["score"]
            e.score_percent = r["score_percent"]
            e.tier = r["tier"]
            echoes_updated += 1

    await db.commit()
    return {
        "sets_total": sets_total,
        "sets_updated": sets_updated,
        "echoes_total": echoes_total,
        "echoes_updated": echoes_updated,
    }
