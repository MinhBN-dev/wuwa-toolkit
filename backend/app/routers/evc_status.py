"""
Periodic EVC changelog check.
Fetches https://www.echovaluecalc.com/logs, parses the latest entry,
and compares it against the last acknowledged date stored in a local JSON file.
"""
import json
import os
import re
from datetime import datetime
from pathlib import Path

import httpx
from fastapi import APIRouter

router = APIRouter(prefix="/evc-status", tags=["EVC Status"])

_DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).parent.parent.parent))
STATUS_FILE = _DATA_DIR / "evc_status.json"
CHANGELOG_URL = "https://www.echovaluecalc.com/logs"


def _load_status() -> dict:
    if STATUS_FILE.exists():
        try:
            return json.loads(STATUS_FILE.read_text())
        except Exception:
            pass
    return {"acknowledged_date": None}


def _save_status(data: dict):
    STATUS_FILE.write_text(json.dumps(data, indent=2))


def _parse_changelog(html: str) -> list[dict]:
    """
    Returns list of {date_str, date_iso, entries: [str]} sorted newest first.
    Looks specifically for <h3>DD.MM.YYYY</h3> followed by a <ul> block.
    """
    results = []
    # Match <h3>DATE</h3> ... <ul>...</ul> blocks
    pattern = re.compile(
        r'<h3>\s*(\d{2}\.\d{2}\.\d{4})\s*</h3>\s*<ul>(.*?)</ul>',
        re.DOTALL | re.IGNORECASE,
    )
    for m in pattern.finditer(html):
        date_str = m.group(1)
        ul_content = m.group(2)
        entries = re.findall(r'<li[^>]*>(.*?)</li>', ul_content, re.DOTALL)
        entries = [re.sub(r'<[^>]+>', '', e).strip() for e in entries]
        entries = [e for e in entries if e]
        try:
            d, mo, y = date_str.split('.')
            date_iso = f"{y}-{mo}-{d}"
        except Exception:
            date_iso = date_str
        results.append({"date_str": date_str, "date_iso": date_iso, "entries": entries})

    results.sort(key=lambda x: x["date_iso"], reverse=True)
    return results


@router.get("")
async def get_evc_status():
    """Fetch EVC changelog and compare with last acknowledged version."""
    status = _load_status()
    acknowledged = status.get("acknowledged_date")

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(CHANGELOG_URL, follow_redirects=True)
            resp.raise_for_status()
            html = resp.text
    except Exception as e:
        return {
            "has_update": False,
            "error": str(e),
            "latest_date": None,
            "latest_entries": [],
            "acknowledged_date": acknowledged,
            "checked_at": datetime.utcnow().isoformat(),
        }

    changelog = _parse_changelog(html)
    if not changelog:
        return {
            "has_update": False,
            "latest_date": None,
            "latest_entries": [],
            "acknowledged_date": acknowledged,
            "checked_at": datetime.utcnow().isoformat(),
        }

    latest = changelog[0]
    has_update = acknowledged is None or latest["date_iso"] > acknowledged

    return {
        "has_update": has_update,
        "latest_date": latest["date_iso"],
        "latest_date_display": latest["date_str"],
        "latest_entries": latest["entries"],
        "acknowledged_date": acknowledged,
        "checked_at": datetime.utcnow().isoformat(),
    }


@router.post("/acknowledge")
async def acknowledge_evc_update(body: dict = {}):
    """Mark the current latest version as seen."""
    date = body.get("date")
    if not date:
        return {"ok": False, "error": "missing date"}
    _save_status({"acknowledged_date": date})
    return {"ok": True, "acknowledged_date": date}
