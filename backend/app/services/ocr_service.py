"""
OCR service — multi-provider vision with automatic fallback.

Provider priority:
  1. Google Gemini   (gemini-2.5-flash → gemini-1.5-flash → gemini-1.5-pro)
  2. OpenAI          (gpt-4o-mini → gpt-4o)
  3. Anthropic Claude (claude-haiku-4-5 → claude-sonnet-4-6)

429/quota errors skip to next model immediately.
503/5xx errors retry up to 3× with backoff before falling back.
"""
import asyncio
import base64
import json
import re
from pathlib import Path
from app.config import settings

# ── Lazy-init clients (only if key present) ───────────────────────────────────
_gemini_client = None
_openai_client = None
_anthropic_client = None


def _get_gemini():
    global _gemini_client
    if _gemini_client is None and settings.GOOGLE_API_KEY:
        from google import genai
        _gemini_client = genai.Client(api_key=settings.GOOGLE_API_KEY)
    return _gemini_client


def _get_openai():
    global _openai_client
    if _openai_client is None and settings.OPENAI_API_KEY:
        from openai import OpenAI
        _openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


def _get_anthropic():
    global _anthropic_client
    if _anthropic_client is None and settings.ANTHROPIC_API_KEY:
        import anthropic
        _anthropic_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _anthropic_client


# ── Extraction prompt ─────────────────────────────────────────────────────────
EXTRACTION_PROMPT = """You are an expert at reading Wuthering Waves echo stat screenshots.
Extract echo info and return ONLY valid JSON, no markdown, no extra text.

=== ECHO LAYOUT ===
A Wuthering Waves echo panel has:
1. Echo name (top, bold)
2. COST badge (1, 3, or 4)
3. A large MAIN STAT line (e.g. "Crit. DMG  44.0%") — IGNORE THIS COMPLETELY
4. A secondary fixed flat stat line (e.g. "ATK  150") — IGNORE THIS COMPLETELY
5. SUB-STATS: exactly 5 lines preceded by a bullet "·" or small dot — EXTRACT ONLY THESE

=== OUTPUT FORMAT ===
{
  "echo_name": "name of the echo (e.g. Inferno Rider, Phantom: Sigillum)",
  "echo_set": "echo set name (e.g. Molten Rift, Void Thunder, Lingering Tunes)",
  "echo_element": "element type: Glacio / Fusion / Electro / Aero / Spectro / Havoc",
  "echo_cost": 4,
  "sub_stats": [
    {"type": "Skill DMG%", "value": 10.1},
    {"type": "Flat ATK", "value": 50},
    {"type": "Crit Rate", "value": 7.5},
    {"type": "ATK%", "value": 7.9},
    {"type": "Crit DMG", "value": 8.4}
  ],
  "raw_text": "all text visible in the image"
}

=== SUB-STAT TYPE NAMES — use EXACTLY these strings ===
"Crit Rate", "Crit DMG", "ATK%", "Flat ATK", "HP%", "Flat HP",
"DEF%", "Flat DEF", "Basic ATK DMG%", "Heavy ATK DMG%",
"Skill DMG%", "Liberation DMG%", "ER%"

=== RULES ===
- sub_stats: ONLY the bullet-point stats (up to 5). Never include main stat or secondary flat stat.
- Values are numbers only (no % sign)
- "Resonance Skill DMG Bonus" → "Skill DMG%"
- "Resonance Liberation DMG Bonus" → "Liberation DMG%"
- "Basic Attack DMG Bonus" → "Basic ATK DMG%"
- "Heavy Attack DMG Bonus" → "Heavy ATK DMG%"
- "Energy Regen" → "ER%"
- ATK with value ≥ 100 (like ATK 150) is the secondary fixed stat — do NOT include in sub_stats
- If a field is unclear, use null"""

# ── Secondary stat filter ─────────────────────────────────────────────────────
_SECONDARY_THRESHOLDS: dict[str, float] = {
    "Flat ATK": 100.0,
    "Flat HP":  1000.0,
}


# ── Image utilities ───────────────────────────────────────────────────────────
def read_image_bytes(image_path: str) -> tuple[bytes, str]:
    path = Path(image_path)
    mime_map = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
    }
    mime = mime_map.get(path.suffix.lower(), "image/jpeg")
    with open(image_path, "rb") as f:
        return f.read(), mime


def _to_b64(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode()


# ── Response parser ───────────────────────────────────────────────────────────
def _parse_response(raw_response: str) -> dict:
    raw = raw_response.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
    data = json.loads(raw)

    sub_stats = []
    for s in data.get("sub_stats", []):
        stat_type = s.get("type")
        stat_value = s.get("value")
        if not stat_type or stat_value is None:
            continue
        value = float(stat_value)
        threshold = _SECONDARY_THRESHOLDS.get(stat_type)
        if threshold and value >= threshold:
            continue
        sub_stats.append({"type": stat_type, "value": value})

    return {
        "echo_name": data.get("echo_name", "Unknown Echo"),
        "echo_set": data.get("echo_set"),
        "echo_element": data.get("echo_element"),
        "echo_cost": int(data.get("echo_cost") or 4),
        "sub_stats": sub_stats[:5],
        "confidence": 1.0,
        "raw_text": data.get("raw_text"),
        "provider": None,  # filled in by caller
    }


# ── Provider: Gemini ──────────────────────────────────────────────────────────
def _gemini_call_sync(model: str, image_bytes: bytes, mime_type: str) -> str:
    from google.genai import types
    client = _get_gemini()
    response = client.models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            EXTRACTION_PROMPT,
        ],
    )
    return response.text.strip()


async def _try_gemini(image_bytes: bytes, mime_type: str) -> dict | None:
    """Try all Gemini models. Returns parsed dict or None if all failed."""
    if not _get_gemini():
        return None

    from google.genai.errors import ServerError, ClientError

    gemini_models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"]
    for model in gemini_models:
        for attempt in range(3):
            try:
                raw = await asyncio.to_thread(_gemini_call_sync, model, image_bytes, mime_type)
                result = _parse_response(raw)
                result["provider"] = f"Gemini ({model})"
                return result
            except ClientError:
                break  # 429 quota — skip to next model immediately
            except ServerError:
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
            except Exception:
                raise
    return None


# ── Provider: OpenAI ──────────────────────────────────────────────────────────
def _openai_call_sync(model: str, image_bytes: bytes, mime_type: str) -> str:
    client = _get_openai()
    b64 = _to_b64(image_bytes)
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{b64}"},
                    },
                    {"type": "text", "text": EXTRACTION_PROMPT},
                ],
            }
        ],
        max_tokens=1024,
    )
    return response.choices[0].message.content.strip()


async def _try_openai(image_bytes: bytes, mime_type: str) -> dict | None:
    """Try OpenAI vision models. Returns parsed dict or None if all failed."""
    if not _get_openai():
        return None

    from openai import RateLimitError, APIStatusError

    openai_models = ["gpt-4o-mini", "gpt-4o"]
    last_error = None
    for model in openai_models:
        for attempt in range(3):
            try:
                raw = await asyncio.to_thread(_openai_call_sync, model, image_bytes, mime_type)
                result = _parse_response(raw)
                result["provider"] = f"OpenAI ({model})"
                return result
            except RateLimitError as e:
                last_error = e
                break  # quota — skip to next model
            except APIStatusError as e:
                last_error = e
                if e.status_code >= 500 and attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                else:
                    break
            except Exception:
                raise
    return None


# ── Provider: Anthropic Claude ────────────────────────────────────────────────
def _anthropic_call_sync(model: str, image_bytes: bytes, mime_type: str) -> str:
    import anthropic
    client = _get_anthropic()
    b64 = _to_b64(image_bytes)
    response = client.messages.create(
        model=model,
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": mime_type,
                        "data": b64,
                    },
                },
                {"type": "text", "text": EXTRACTION_PROMPT},
            ],
        }],
    )
    return response.content[0].text.strip()


async def _try_anthropic(image_bytes: bytes, mime_type: str) -> dict | None:
    """Try Anthropic Claude vision models. Returns parsed dict or None if all failed."""
    if not _get_anthropic():
        return None

    import anthropic as anthropic_lib

    claude_models = ["claude-haiku-4-5-20251001", "claude-sonnet-4-6"]
    last_error = None
    for model in claude_models:
        for attempt in range(3):
            try:
                raw = await asyncio.to_thread(_anthropic_call_sync, model, image_bytes, mime_type)
                result = _parse_response(raw)
                result["provider"] = f"Claude ({model})"
                return result
            except anthropic_lib.RateLimitError as e:
                last_error = e
                break  # quota — skip to next model
            except anthropic_lib.APIStatusError as e:
                last_error = e
                if e.status_code >= 500 and attempt < 2:
                    await asyncio.sleep(2 ** attempt)
                else:
                    break
            except Exception:
                raise
    return None


# ── Provider: EasyOCR (local, no API needed) ─────────────────────────────────
_easyocr_reader = None


def _get_easyocr_reader():
    global _easyocr_reader
    if _easyocr_reader is None:
        import easyocr
        _easyocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
    return _easyocr_reader


# Stat name → standard display name
# Handles OCR variants like "Crit. Rate", "CRIT RATE", "Resonance Skill DMG Bonus"
_STAT_PATTERNS: list[tuple[str, str]] = [
    (r'resonance\s+skill|skill\s+dmg',              'Skill DMG%'),
    (r'liberation\s+dmg|resonance\s+lib',            'Liberation DMG%'),
    (r'basic\s+att?a?ck?\s+dmg|basic\s+atk\s+dmg',  'Basic ATK DMG%'),
    (r'heavy\s+att?a?ck?\s+dmg|heavy\s+atk\s+dmg',  'Heavy ATK DMG%'),
    (r'crit\.?\s*rate',                              'Crit Rate'),
    (r'crit\.?\s*dmg|crit\.?\s*damage',              'Crit DMG'),
    (r'energy\s+regen',                              'ER%'),
    (r'atk\s*%',                                     'ATK%'),
    (r'hp\s*%',                                      'HP%'),
    (r'def\s*%',                                     'DEF%'),
]
# Ambiguous names — need to check if value has % to decide flat vs percent
_AMBIGUOUS_STAT_PATTERNS: list[tuple[str, str, str]] = [
    (r'^atk$',  'ATK%',    'Flat ATK'),
    (r'^hp$',   'HP%',     'Flat HP'),
    (r'^def$',  'DEF%',    'Flat DEF'),
]


def _map_stat_name(name: str, has_percent: bool) -> str | None:
    """Map raw OCR stat name to standard format."""
    n = re.sub(r'[·•\-:]', ' ', name.lower()).strip()
    n = re.sub(r'\s+', ' ', n)

    for pattern, result in _STAT_PATTERNS:
        if re.search(pattern, n):
            return result

    for pattern, if_pct, if_flat in _AMBIGUOUS_STAT_PATTERNS:
        if re.fullmatch(pattern, n):
            return if_pct if has_percent else if_flat

    return None


# Max value a real sub-stat can have — anything higher is a main stat
_SUBSTAT_MAX_VAL: dict[str, float] = {
    "Crit Rate": 10.5, "Crit DMG": 21.0, "ATK%": 11.6, "Flat ATK": 60.0,
    "HP%": 11.6, "Flat HP": 580.0, "DEF%": 14.7, "Flat DEF": 70.0,
    "Skill DMG%": 11.6, "Liberation DMG%": 11.6,
    "Basic ATK DMG%": 11.6, "Heavy ATK DMG%": 11.6, "ER%": 12.4,
}

# Row text patterns that are never stat lines (noise / metadata)
_NOISE_ROW_RE = re.compile(
    r'^(\+?\d{1,2}|cost\s*\d|[134]|\d+\s+\d+|\W+)$',
    re.IGNORECASE,
)


def _parse_easyocr_results(results: list) -> dict:
    """
    Parse EasyOCR result list into echo dict.

    Echo layout (top → bottom):
      Line 0  : Echo name
      Line 1  : Cost badge ("COST 4")
      Line 2  : Level ("+25") — noise
      Lines 3-4: 2 main stat lines (main stat + secondary flat) → filtered by value
      Lines 5-9: 5 sub-stats → EXTRACT
    """
    if not results:
        raise ValueError("EasyOCR: không detect được text nào")

    # Sort all blocks by vertical center
    sorted_r = sorted(results, key=lambda r: (r[0][0][1] + r[0][2][1]) / 2)

    # Group into visual rows (15px Y-proximity threshold)
    rows: list[list[tuple[float, str]]] = []
    current: list[tuple[float, str]] = []
    last_y: float | None = None

    for bbox, text, _conf in sorted_r:
        text = text.strip()
        if not text:
            continue
        cy = (bbox[0][1] + bbox[2][1]) / 2
        cx = (bbox[0][0] + bbox[2][0]) / 2
        if last_y is None or abs(cy - last_y) < 15:
            current.append((cx, text))
        else:
            if current:
                rows.append(sorted(current))
            current = [(cx, text)]
        last_y = cy
    if current:
        rows.append(sorted(current))

    row_texts = [' '.join(t for _, t in row) for row in rows if row]
    row_texts = [t for t in row_texts if t]

    # ── Echo name: first row ──
    echo_name = row_texts[0] if row_texts else "Unknown Echo"

    # ── Cost: scan first 6 rows ──
    echo_cost = 4
    for text in row_texts[:6]:
        m = re.search(r'cost\s*[:\-]?\s*([134])', text, re.IGNORECASE)
        if m:
            echo_cost = int(m.group(1))
            break
        if re.fullmatch(r'[134]', text.strip()):
            echo_cost = int(text.strip())
            break

    # ── Parse stat lines (name + numeric value pairs) ──
    VALUE_RE = re.compile(r'^([\d,]+\.?\d*)\s*(%?)[/\\|]?$')

    stat_lines: list[tuple[str, float, bool]] = []

    for row in rows:
        row_full = ' '.join(t for _, t in row)

        # Skip obvious noise rows (level "+25", cost badge, icon-only rows)
        if _NOISE_ROW_RE.match(row_full.strip()):
            continue

        if len(row) < 2:
            cx, text = row[0]
            parts = text.rsplit(None, 1)
            if len(parts) != 2:
                continue
            name_part, val_part = parts
            m = VALUE_RE.match(val_part)
            if not m:
                continue
            value = float(m.group(1).replace(',', '.'))
            has_pct = bool(m.group(2))
            stat_lines.append((name_part.strip(), value, has_pct))
        else:
            *name_parts, (_, val_text) = row
            m = VALUE_RE.match(val_text)
            if not m:
                continue
            value = float(m.group(1).replace(',', '.'))
            has_pct = bool(m.group(2))
            name = ' '.join(t for _, t in name_parts).strip()
            stat_lines.append((name, value, has_pct))

    # ── Filter: keep only lines that map to a known stat type ──
    known_stat_lines: list[tuple[str, float, bool]] = []
    for name, value, has_pct in stat_lines:
        mapped = _map_stat_name(name, has_pct)
        if mapped:
            known_stat_lines.append((mapped, value, has_pct))

    # ── Separate sub-stats from main/secondary stats ──
    # Main stat: value exceeds sub-stat max for that type
    # Secondary stat: Flat ATK ≥ 100 or Flat HP ≥ 1000 (already in _SECONDARY_THRESHOLDS)
    sub_stats: list[dict] = []
    for mapped, value, _ in known_stat_lines:
        # Skip if value exceeds sub-stat ceiling (→ it's a main stat)
        max_val = _SUBSTAT_MAX_VAL.get(mapped)
        if max_val and value > max_val:
            continue
        # Skip secondary fixed flat stats
        threshold = _SECONDARY_THRESHOLDS.get(mapped)
        if threshold and value >= threshold:
            continue
        sub_stats.append({"type": mapped, "value": value})

    return {
        "echo_name": echo_name,
        "echo_set": None,
        "echo_element": None,
        "echo_cost": echo_cost,
        "sub_stats": sub_stats[:5],
        "confidence": 0.6,
        "raw_text": '\n'.join(row_texts),
        "provider": "EasyOCR (local)",
    }


def _easyocr_call_sync(image_bytes: bytes) -> dict:
    import numpy as np
    import cv2

    img_array = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Không decode được ảnh")

    reader = _get_easyocr_reader()
    results = reader.readtext(img)
    return _parse_easyocr_results(results)


async def _try_easyocr(image_bytes: bytes, _mime_type: str) -> dict | None:
    """Local OCR fallback — no API key required. First run downloads ~500 MB models."""
    try:
        result = await asyncio.to_thread(_easyocr_call_sync, image_bytes)
        if result and result.get("sub_stats"):
            return result
        return None
    except ImportError:
        return None   # easyocr not installed
    except Exception:
        return None


# ── Public entry point ────────────────────────────────────────────────────────
async def extract_echo_stats(image_path: str) -> dict:
    """
    Extract echo sub-stats from image.
    Tries Gemini first, then OpenAI. Raises if both unavailable.
    """
    image_bytes, mime_type = read_image_bytes(image_path)

    # TODO: re-enable API providers when needed
    # result = await _try_gemini(image_bytes, mime_type)
    # if result is not None:
    #     return result

    # result = await _try_openai(image_bytes, mime_type)
    # if result is not None:
    #     return result

    # result = await _try_anthropic(image_bytes, mime_type)
    # if result is not None:
    #     return result

    result = await _try_easyocr(image_bytes, mime_type)
    if result is not None:
        return result

    providers = []
    if settings.GOOGLE_API_KEY:
        providers.append("Gemini")
    if settings.OPENAI_API_KEY:
        providers.append("OpenAI")
    if settings.ANTHROPIC_API_KEY:
        providers.append("Claude")
    if not providers:
        raise RuntimeError(
            "Chưa cấu hình API key nào. "
            "Thêm GOOGLE_API_KEY, OPENAI_API_KEY hoặc ANTHROPIC_API_KEY vào backend/.env"
        )
    raise RuntimeError(
        f"Tất cả providers ({', '.join(providers)}) đều hết quota hoặc không khả dụng. "
        "Thử lại sau hoặc kiểm tra billing."
    )
