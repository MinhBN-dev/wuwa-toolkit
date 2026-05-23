"""Wuthering Waves Convene history client.

Parses the in-game export URL, then queries the gacha record API for each pool.
Region: Oversea only (gmserver-api.aki-game2.net).
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any
from urllib.parse import urlparse, parse_qs

import httpx


# Pool types exposed in-game (cardPoolType values 1..7)
POOL_TYPES: list[tuple[int, str]] = [
    (1, "Featured Resonator Convene"),
    (2, "Featured Weapon Convene"),
    (3, "Standard Resonator Convene"),
    (4, "Standard Weapon Convene"),
    (5, "Beginner Convene"),
    (6, "Beginner's Choice Convene"),
    (7, "Beginner's Choice Convene (Selector)"),
]

OVERSEA_API = "https://gmserver-api.aki-game2.net/gacha/record/query"


class ConveneUrlError(ValueError):
    pass


def parse_export_url(url: str) -> dict[str, str]:
    """Pull svr_id, player_id, lang, record_id, resources_id from a Convene export URL.

    The in-game URL looks like:
        https://aki-gm-resources-oversea.aki-game.net/aki/gacha/index.html#/record?...
        &svr_id=...&player_id=...&lang=en&gacha_id=...&gacha_type=...&svr_area=oversea
        &record_id=...&resources_id=...
    The interesting params live in the fragment after `#/record?`, not the query string.
    """
    if not url or "gacha" not in url:
        raise ConveneUrlError("Not a Convene export URL")

    parsed = urlparse(url)
    fragment = parsed.fragment  # e.g. "/record?svr_id=...&player_id=..."
    if "?" in fragment:
        query_str = fragment.split("?", 1)[1]
    else:
        query_str = parsed.query  # fallback if user pasted a flattened URL

    params = parse_qs(query_str)
    flat = {k: v[0] for k, v in params.items() if v}

    required = ["svr_id", "player_id", "record_id"]
    missing = [r for r in required if not flat.get(r)]
    if missing:
        raise ConveneUrlError(f"URL missing required fields: {', '.join(missing)}")

    return {
        "svr_id": flat["svr_id"],
        "player_id": flat["player_id"],
        "record_id": flat["record_id"],
        "lang": flat.get("lang", "en"),
        "resources_id": flat.get("resources_id", ""),
        "svr_area": flat.get("svr_area", "oversea"),
        # gacha_id is the cardPoolId of whichever banner the user was viewing
        # when they exported the URL. The WuWa API requires it to be non-empty
        # for the response to include the full pool history; passing "" returns
        # only a tiny fragment. The same gacha_id is reused for all 7 pool types.
        "gacha_id": flat.get("gacha_id", ""),
    }


async def fetch_pool(
    client: httpx.AsyncClient,
    *,
    svr_id: str,
    player_id: str,
    record_id: str,
    lang: str,
    card_pool_type: int,
    card_pool_id: str = "",
) -> list[dict[str, Any]]:
    """Call gacha API for one pool. Returns the raw `data` list (newest first)."""
    payload = {
        "playerId": player_id,
        "serverId": svr_id,
        "recordId": record_id,
        "languageCode": lang,
        "cardPoolType": card_pool_type,
        "cardPoolId": card_pool_id,
    }
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://aki-gm-resources-oversea.aki-game.net",
        "Referer": "https://aki-gm-resources-oversea.aki-game.net/",
        "User-Agent": "Mozilla/5.0",
    }
    resp = await client.post(OVERSEA_API, json=payload, headers=headers, timeout=20)
    resp.raise_for_status()
    body = resp.json()
    if body.get("code") != 0:
        raise RuntimeError(f"Gacha API error (pool {card_pool_type}): {body.get('message')}")
    return body.get("data") or []


def synth_pull_id(time_str: str, within_second: int) -> str:
    """Stable, window-independent synthetic pull id: ``<YYYYMMDDHHMMSS>-<NN>``.

    The WuWa gacha API gives no per-pull id AND only returns a *sliding window*
    of recent pulls (old ones age out over time). A positional index is therefore
    unstable: once the oldest pull drops out of the window, every remaining pull's
    index shifts, so genuinely-new pulls reuse ids that already exist and get
    silently dropped by the ON CONFLICT dedup ("up to date, no new pulls" even
    after rolling). Anchoring the id to the pull's own timestamp plus its order
    within that exact second (a 10-pull shares one timestamp) yields an id that
    never changes as the window slides.

    `within_second` must be assigned in oldest-first order so it matches across
    re-syncs (and the one-off migration of pre-existing positional ids).
    """
    digits = re.sub(r"\D", "", time_str or "")
    return f"{digits or '00000000000000'}-{within_second:02d}"


def normalize_pull(
    raw: dict[str, Any],
    *,
    player_id: str,
    card_pool_type: int,
    pull_id: str,
) -> dict[str, Any]:
    """Game API record → DB-ready dict. `pull_id` is the stable id from
    `synth_pull_id` (computed by the caller, which knows the oldest-first order)."""
    time_str = raw.get("time")
    parsed_time = datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S") if time_str else datetime.utcnow()
    return {
        "player_id": player_id,
        "card_pool_type": card_pool_type,
        "pull_id": pull_id,
        "name": str(raw.get("name", "")),
        "item_type": str(raw.get("resourceType") or raw.get("itemType") or ""),
        "quality_level": int(raw.get("qualityLevel", 0)),
        "resource_id": int(raw["resourceId"]) if raw.get("resourceId") is not None else None,
        "count": int(raw.get("count", 1)),
        "time": parsed_time,
    }


async def fetch_all_pools(parsed: dict[str, str]) -> dict[int, list[dict[str, Any]]]:
    """Fetch every pool sequentially. Returns {pool_type: [normalized pulls]}."""
    out: dict[int, list[dict[str, Any]]] = {}
    card_pool_id = parsed.get("gacha_id", "")
    async with httpx.AsyncClient() as client:
        for pool_type, _label in POOL_TYPES:
            try:
                raw_list = await fetch_pool(
                    client,
                    svr_id=parsed["svr_id"],
                    player_id=parsed["player_id"],
                    record_id=parsed["record_id"],
                    lang=parsed["lang"],
                    card_pool_type=pool_type,
                    card_pool_id=card_pool_id,
                )
            except RuntimeError:
                # Pool may legitimately have no data / be locked — keep going
                out[pool_type] = []
                continue
            # API returns newest-first. Reverse so we walk oldest-first, assigning
            # each pull a stable timestamp-anchored id (with a per-second counter
            # for the items of a 10-pull, which share one timestamp).
            oldest_first = list(reversed(raw_list))
            seen_per_second: dict[str, int] = {}
            pool_pulls: list[dict[str, Any]] = []
            for r in oldest_first:
                tstr = str(r.get("time") or "")
                i = seen_per_second.get(tstr, 0)
                seen_per_second[tstr] = i + 1
                pool_pulls.append(
                    normalize_pull(
                        r,
                        player_id=parsed["player_id"],
                        card_pool_type=pool_type,
                        pull_id=synth_pull_id(tstr, i),
                    )
                )
            out[pool_type] = pool_pulls
    return out
