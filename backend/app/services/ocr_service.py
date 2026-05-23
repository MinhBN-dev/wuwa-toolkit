"""
OCR service — local-first with API fallback.

Provider priority:
  1. RapidOCR (local ONNX, no API key, always available)
  2. EasyOCR  (local, no API key, always available)
  3. Google Gemini   (gemini-2.5-flash → gemini-1.5-flash → gemini-1.5-pro)
  4. OpenAI          (gpt-4o-mini → gpt-4o)
  5. Anthropic Claude (claude-haiku-4-5 → claude-sonnet-4-6)

Local engines run on a preprocessed image (robust decode → upscale-if-small →
grayscale + CLAHE contrast), which fixes the "screenshot from game reads wrong but
re-cropped from the website reads fine" class of bugs (odd colorspace / bit-depth /
alpha channel in raw game screenshots). API providers get a normalized PNG.

RapidOCR is tried first; if it (and then EasyOCR) returns no sub-stats, API providers
are attempted in order. 429/quota errors skip to next model immediately. 503/5xx errors
retry up to 3× with backoff before falling back.
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
3. A large MAIN STAT line (e.g. "Crit. DMG  44.0%") — EXTRACT THIS as main_stat
4. A secondary fixed flat stat line (e.g. "ATK  150") — IGNORE THIS COMPLETELY
5. SUB-STATS: exactly 5 lines preceded by a bullet "·" or small dot — EXTRACT ONLY THESE

=== OUTPUT FORMAT ===
{
  "echo_name": "name of the echo (e.g. Inferno Rider, Phantom: Sigillum)",
  "echo_set": "echo set name (e.g. Molten Rift, Void Thunder, Lingering Tunes)",
  "echo_element": "element type: Glacio / Fusion / Electro / Aero / Spectro / Havoc",
  "echo_cost": 4,
  "main_stat_type": "Crit. DMG",
  "main_stat_value": 44.0,
  "sub_stats": [
    {"type": "Skill DMG%", "value": 10.1},
    {"type": "Flat ATK", "value": 50},
    {"type": "Crit Rate", "value": 7.5},
    {"type": "ATK%", "value": 7.9},
    {"type": "Crit DMG", "value": 8.4}
  ],
  "raw_text": "all text visible in the image"
}

=== MAIN STAT TYPES — use EXACTLY these strings ===
"HP", "ATK", "DEF", "HP%", "ATK%", "DEF%",
"Crit. Rate", "Crit. DMG", "Healing Bonus",
"Glacio DMG Bonus", "Fusion DMG Bonus", "Electro DMG Bonus",
"Aero DMG Bonus", "Spectro DMG Bonus", "Havoc DMG Bonus",
"Energy Regen"

=== SUB-STAT TYPE NAMES — use EXACTLY these strings ===
"Crit Rate", "Crit DMG", "ATK%", "Flat ATK", "HP%", "Flat HP",
"DEF%", "Flat DEF", "Basic ATK DMG%", "Heavy ATK DMG%",
"Skill DMG%", "Liberation DMG%", "ER%"

=== RULES ===
- main_stat: the LARGEST / most prominent stat line (not preceded by bullet). Value is number only (no % sign).
- sub_stats: ONLY the bullet-point stats (up to 5). Never include main stat or secondary flat stat.
- Values are numbers only (no % sign)
- "Resonance Skill DMG Bonus" → "Skill DMG%"
- "Resonance Liberation DMG Bonus" → "Liberation DMG%"
- "Basic Attack DMG Bonus" → "Basic ATK DMG%"
- "Heavy Attack DMG Bonus" → "Heavy ATK DMG%"
- "Energy Regen" → "ER%" (for sub_stats) or "Energy Regen" (for main_stat)
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


# ── Image preprocessing ───────────────────────────────────────────────────────
def _decode_cv_image(image_bytes: bytes):
    """
    Robust decode → BGR uint8 ndarray.

    Handles cases a plain cv2.imdecode(IMREAD_COLOR) mangles:
      - 16-bit / float PNG (game screenshots in HDR or wide-gamut) → normalized to 8-bit
      - alpha channel → composited over white
      - grayscale → expanded to 3 channels
    """
    import numpy as np
    import cv2

    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError("Không decode được ảnh")

    if img.dtype != np.uint8:
        img = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

    if img.ndim == 2:
        return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    if img.shape[2] == 1:
        return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    if img.shape[2] == 4:
        bgr = img[:, :, :3].astype(np.float32)
        alpha = img[:, :, 3:4].astype(np.float32) / 255.0
        return (bgr * alpha + 255.0 * (1.0 - alpha)).astype(np.uint8)
    return img


def _upscale_if_small(img, min_side: int = 720):
    """Upscale (cubic) so the shorter side is at least `min_side`px — helps OCR on small crops."""
    import cv2

    h, w = img.shape[:2]
    short = min(h, w)
    if short and short < min_side:
        f = min(3.0, min_side / short)
        img = cv2.resize(img, None, fx=f, fy=f, interpolation=cv2.INTER_CUBIC)
    return img


def _enhance_for_ocr(img):
    """Grayscale + CLAHE local-contrast boost — input for the local OCR engines."""
    import cv2

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(gray)


def _prep_local_image(image_bytes: bytes):
    """Full preprocess pipeline for local OCR engines. Returns a 2-D uint8 ndarray, or None."""
    try:
        return _enhance_for_ocr(_upscale_if_small(_decode_cv_image(image_bytes)))
    except Exception:
        return None


def _normalized_png_bytes(image_bytes: bytes) -> bytes | None:
    """Re-encode through the robust decoder to a clean PNG — for API vision providers."""
    import cv2

    try:
        ok, buf = cv2.imencode(".png", _upscale_if_small(_decode_cv_image(image_bytes)))
        return buf.tobytes() if ok else None
    except Exception:
        return None


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
        "main_stat_type": data.get("main_stat_type"),
        "main_stat_value": float(data["main_stat_value"]) if data.get("main_stat_value") is not None else None,
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
    """Map raw OCR stat name to standard format.

    Robust to the leading "+" bullet that prefixes every in-game sub-stat row and to
    stray icon glyphs (⚔ on ATK, ♥ on HP) the engines sometimes emit: we strip
    everything that isn't a stat-name char before matching. Without this, ambiguous
    stats (ATK / HP / DEF) read as "+ atk" never matched the `^atk$` fullmatch and were
    silently dropped — the root cause of missing ATK%/HP%/DEF% sub-stats.
    """
    n = name.lower()
    n = re.sub(r'[+·•*]', ' ', n)        # bullet / plus markers
    n = re.sub(r'[^a-z%. ]', ' ', n)     # drop icon glyphs, digits, stray symbols
    n = re.sub(r'\s+', ' ', n).strip()

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


def _is_name_token(tok: str) -> bool:
    """Keep a token as part of the echo name?

    Drops the level badge ("+25"), the COST keyword, single-letter skill/lock button
    badges (Z, C, …) that sit beside the name, and pure-symbol/icon tokens (◎). Keeps
    any real word so multi-line names join correctly.
    """
    t = tok.strip()
    if not t:
        return False
    if re.fullmatch(r'\+?\d+', t):              # level "+25" / stray numbers
        return False
    if re.fullmatch(r'[a-zA-Z]', t):            # single-letter button badge (Z / C / X)
        return False
    if re.fullmatch(r'cost', t, re.IGNORECASE):
        return False
    if not re.search(r'[a-zA-Z]', t):           # pure symbol / icon (◎ …)
        return False
    return True


def _parse_ocr_rows(results: list, *, provider: str, confidence: float = 0.6) -> dict:
    """
    Parse a list of (bbox, text, conf) blocks (EasyOCR / RapidOCR shape) into an echo dict.

    Echo layout (top → bottom):
      Line 0  : Echo name
      Line 1  : Cost badge ("COST 4")
      Line 2  : Level ("+25") — noise
      Lines 3-4: 2 main stat lines (main stat + secondary flat) → filtered by value
      Lines 5-9: 5 sub-stats → EXTRACT
    """
    if not results:
        raise ValueError(f"{provider}: không detect được text nào")

    # Sort all blocks by vertical center
    sorted_r = sorted(results, key=lambda r: (r[0][0][1] + r[0][2][1]) / 2)

    # Group into visual rows. Threshold is relative to median text height (not a fixed
    # 15px) so it holds after the upscale step — a fixed px gap split single lines into
    # two rows once the image was enlarged, which dropped/garbled sub-stats.
    heights = [abs(r[0][2][1] - r[0][0][1]) for r in results if r[0]]
    median_h = sorted(heights)[len(heights) // 2] if heights else 20.0
    row_thresh = max(8.0, median_h * 0.6)

    rows: list[list[tuple[float, str]]] = []
    current: list[tuple[float, str]] = []
    last_y: float | None = None

    for bbox, text, _conf in sorted_r:
        text = text.strip()
        if not text:
            continue
        cy = (bbox[0][1] + bbox[2][1]) / 2
        cx = (bbox[0][0] + bbox[2][0]) / 2
        if last_y is None or abs(cy - last_y) < row_thresh:
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

    # ── Cost: scan first 6 rows, remember which row it sits on ──
    echo_cost = 4
    cost_idx: int | None = None
    for i, text in enumerate(row_texts[:6]):
        m = re.search(r'cost\s*[:\-]?\s*([134])', text, re.IGNORECASE)
        if m:
            echo_cost = int(m.group(1))
            cost_idx = i
            break
        if re.search(r'\bcost\b', text, re.IGNORECASE):
            cost_idx = i
            digit = re.search(r'([134])', text)
            if digit:
                echo_cost = int(digit.group(1))
            break
        if re.fullmatch(r'[134]', text.strip()):
            echo_cost = int(text.strip())
            cost_idx = i
            break

    # ── Echo name: every row ABOVE the COST row (handles 2-line names), with the
    #    level badge / button glyphs / single-letter badges filtered out ──
    name_rows = row_texts[:cost_idx] if cost_idx else row_texts[:1]
    name_tokens = [tok for text in name_rows for tok in text.split() if _is_name_token(tok)]
    echo_name = ' '.join(name_tokens) or "Unknown Echo"

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

    # ── Separate main stat from sub-stats ──
    # Main stat: value exceeds sub-stat max for that type → capture first one
    # Secondary stat: Flat ATK ≥ 100 or Flat HP ≥ 1000 → skip
    sub_stats: list[dict] = []
    main_stat_type: str | None = None
    main_stat_value: float | None = None

    for mapped, value, _ in known_stat_lines:
        max_val = _SUBSTAT_MAX_VAL.get(mapped)
        if max_val and value > max_val:
            # It's a main stat — capture first occurrence
            if main_stat_type is None:
                main_stat_type = mapped
                main_stat_value = value
            continue
        threshold = _SECONDARY_THRESHOLDS.get(mapped)
        if threshold and value >= threshold:
            continue
        sub_stats.append({"type": mapped, "value": value})

    return {
        "echo_name": echo_name,
        "echo_set": None,
        "echo_element": None,
        "echo_cost": echo_cost,
        "main_stat_type": main_stat_type,
        "main_stat_value": main_stat_value,
        "sub_stats": sub_stats[:5],
        "confidence": confidence,
        "raw_text": '\n'.join(row_texts),
        "provider": provider,
    }


def _easyocr_call_sync(local_img) -> dict:
    reader = _get_easyocr_reader()
    results = reader.readtext(local_img)
    return _parse_ocr_rows(results, provider="EasyOCR (local)", confidence=0.6)


async def _try_easyocr(local_img) -> dict | None:
    """Local OCR — no API key required. `local_img`: preprocessed 2-D ndarray (or None)."""
    if local_img is None:
        return None
    try:
        result = await asyncio.to_thread(_easyocr_call_sync, local_img)
        if result and result.get("sub_stats"):
            return result
        return None
    except ImportError:
        return None   # easyocr not installed
    except Exception:
        return None


# ── Provider: RapidOCR (local ONNX, no API needed) ────────────────────────────
_rapidocr_engine = None


def _get_rapidocr():
    global _rapidocr_engine
    if _rapidocr_engine is None:
        from rapidocr_onnxruntime import RapidOCR
        _rapidocr_engine = RapidOCR()
    return _rapidocr_engine


def _rapidocr_call_sync(local_img) -> dict:
    engine = _get_rapidocr()
    out, _elapse = engine(local_img)
    results = []
    for item in (out or []):
        box, text = item[0], item[1]
        try:
            conf = float(item[2])
        except (TypeError, ValueError, IndexError):
            conf = 0.0
        results.append((box, text, conf))
    return _parse_ocr_rows(results, provider="RapidOCR (local)", confidence=0.7)


async def _try_rapidocr(local_img) -> dict | None:
    """Local ONNX OCR — primary engine. Models ship inside the wheel (no download)."""
    if local_img is None:
        return None
    try:
        result = await asyncio.to_thread(_rapidocr_call_sync, local_img)
        if result and result.get("sub_stats"):
            return result
        return None
    except ImportError:
        return None   # rapidocr-onnxruntime not installed
    except Exception:
        return None


# ── Public entry point ────────────────────────────────────────────────────────
async def extract_echo_stats(image_path: str) -> dict:
    """
    Extract echo sub-stats from image.
    Tries RapidOCR → EasyOCR (local, on a preprocessed image) first;
    falls back to API providers (on a normalized PNG) if both local engines fail.
    """
    raw_bytes, raw_mime = read_image_bytes(image_path)

    # Local engines run on a robustly-decoded, upscaled, contrast-enhanced grayscale image
    local_img = await asyncio.to_thread(_prep_local_image, raw_bytes)

    # 1. RapidOCR (local ONNX) — primary
    result = await _try_rapidocr(local_img)
    if result is not None:
        return result

    # 2. EasyOCR (local) — secondary
    result = await _try_easyocr(local_img)
    if result is not None:
        return result

    # API providers get a normalized PNG (fixes odd colorspace / bit-depth / alpha)
    norm = await asyncio.to_thread(_normalized_png_bytes, raw_bytes)
    api_bytes, api_mime = (norm, "image/png") if norm else (raw_bytes, raw_mime)

    # 3. Gemini Vision
    result = await _try_gemini(api_bytes, api_mime)
    if result is not None:
        return result

    # 4. OpenAI Vision
    result = await _try_openai(api_bytes, api_mime)
    if result is not None:
        return result

    # 5. Anthropic Claude Vision
    result = await _try_anthropic(api_bytes, api_mime)
    if result is not None:
        return result

    raise RuntimeError(
        "Không thể đọc echo từ ảnh này. "
        "RapidOCR và EasyOCR không detect được sub-stats, và tất cả API providers đều không khả dụng hoặc hết quota. "
        "Hãy thử ảnh rõ hơn hoặc kiểm tra API keys."
    )
