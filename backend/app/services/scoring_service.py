"""
Echo scoring service — ported from echovaluecalc.com (evc_engine.py).
Source: https://github.com/AstyuteChick/Echo-Value-Calculator

Algorithm:
  AV  = Σ (value/median × weight) for each substat + ER special contribution
  EP  = sum of top-5 weights from all 12 char weights + er_ep weight
  ES  = (AV / EP) × 100   (capped at 100)
"""
import heapq
from app.data.game_data import (
    CHARACTER_DATA, SUBSTAT_MEDIANS, TIER_THRESHOLDS, REL_VAL_STAT_NAMES,
)

# ─── Stat name mapping: frontend/OCR format → evc format ────────────────────
STAT_NAME_MAP: dict[str, str] = {
    "Crit Rate":        "Crit Rate(%)",
    "Crit DMG":         "Crit Damage(%)",
    "ATK%":             "Atk(%)",
    "Flat ATK":         "Flat Atk",
    "HP%":              "HP(%)",
    "Flat HP":          "Flat HP",
    "DEF%":             "Def(%)",
    "Flat DEF":         "Flat Def",
    "Basic ATK DMG%":   "Basic(%)",
    "Heavy ATK DMG%":   "Heavy(%)",
    "Skill DMG%":       "Skill(%)",
    "Liberation DMG%":  "Liberation(%)",
    "ER%":              "ER(%)",
    # evc names pass through unchanged
    "Crit Rate(%)":     "Crit Rate(%)",
    "Crit Damage(%)":   "Crit Damage(%)",
    "Atk(%)":           "Atk(%)",
    "Flat Atk":         "Flat Atk",
    "HP(%)":            "HP(%)",
    "Flat HP":          "Flat HP",
    "Def(%)":           "Def(%)",
    "Flat Def":         "Flat Def",
    "Basic(%)":         "Basic(%)",
    "Heavy(%)":         "Heavy(%)",
    "Skill(%)":         "Skill(%)",
    "Liberation(%)":    "Liberation(%)",
    "ER(%)":            "ER(%)",
}

# Reverse: evc format → frontend/display format (for breakdown keys)
EVC_TO_DISPLAY: dict[str, str] = {
    "Crit Rate(%)":   "Crit Rate",
    "Crit Damage(%)": "Crit DMG",
    "Atk(%)":         "ATK%",
    "Flat Atk":       "Flat ATK",
    "HP(%)":          "HP%",
    "Flat HP":        "Flat HP",
    "Def(%)":         "DEF%",
    "Flat Def":       "Flat DEF",
    "Basic(%)":       "Basic ATK DMG%",
    "Heavy(%)":       "Heavy ATK DMG%",
    "Skill(%)":       "Skill DMG%",
    "Liberation(%)":  "Liberation DMG%",
    "ER(%)":          "ER%",
}

# Default DPS weights when no character is selected
_DEFAULT_WEIGHTS = {
    "Crit Rate(%)":   1.0,
    "Crit Damage(%)": 1.0,
    "Atk(%)":         0.5,
    "Flat Atk":       0.25,
    "HP(%)":          0.0,
    "Flat HP":        0.0,
    "Def(%)":         0.0,
    "Flat Def":       0.0,
    "Basic(%)":       0.0,
    "Heavy(%)":       0.0,
    "Skill(%)":       0.0,
    "Liberation(%)":  0.0,
}
_DEFAULT_ER = [130.0, 0.5, 125.0]  # [req_er, er_imp, rc]


# ─── ER helper functions ─────────────────────────────────────────────────────

def _av_er(er_net_av: float, er_ssr: float, er_med: float, er_imp: float) -> float:
    """AV contribution of the echo's ER sub-stat."""
    if er_net_av <= 0 or er_imp <= 0:
        return 0.0
    return min(er_ssr / er_med, er_net_av / er_med) * er_imp


def _ep_er(er_net_ep: float, er_med: float, er_imp: float) -> float:
    """EP contribution slot weight for ER."""
    if er_net_ep <= 0 or er_imp <= 0:
        return 0.0
    return min(er_net_ep / er_med, 1.0) * er_imp


# ─── Tier ────────────────────────────────────────────────────────────────────

def _get_tier_label(es: float) -> str:
    """Map ES to descriptive tier label (evc TIER_THRESHOLDS)."""
    for threshold, label in TIER_THRESHOLDS:
        if es >= threshold:
            return label
    return "Unbuilt"


# ─── Main entry point ────────────────────────────────────────────────────────

def calculate_score(
    sub_stats: list[dict],
    character_name: str | None = None,
    total_er: float | None = None,
) -> dict:
    """
    Calculate echo score.

    Args:
        sub_stats:       list of {type, value} dicts (frontend/OCR stat names OK)
        character_name:  character name matching CHARACTER_DATA key
        total_er:        total ER% of the full build (e.g. 125.0 means 125%)

    Returns:
        {score, score_percent, tier, tier_label, breakdown, max_possible}
    """
    # Resolve character data
    char_data = CHARACTER_DATA.get(character_name) if character_name else None

    if char_data is not None:
        char_rv: dict[str, float] = char_data["rv"]
        char_er: list[float] = char_data["er"]
        anal: bool = char_data["anal"]
    else:
        char_rv = _DEFAULT_WEIGHTS
        char_er = _DEFAULT_ER
        anal = True

    # Support characters: score N/A
    if not anal:
        return {
            "score": 0.0,
            "score_percent": 0.0,
            "tier": "Not Applicable",
            "tier_label": "Not Applicable",
            "breakdown": {},
            "max_possible": 0.0,
        }

    req_er, er_imp, rc = char_er
    total_er_val = total_er if total_er is not None else 100.0
    er_med = SUBSTAT_MEDIANS["ER(%)"]

    # Find ER sub-stat value from the echo first
    er_ssr = 0.0
    for s in sub_stats:
        evc_name = STAT_NAME_MAP.get(s.get("type", ""), "")
        if evc_name == "ER(%)":
            er_ssr = float(s.get("value", 0))
            break

    # ER from all sources OTHER than this echo's ER sub-stat
    total_er_other = total_er_val - er_ssr

    # How much ER this echo still needs to provide (capped at 0 if already met)
    # Both AV and EP use req_er as the threshold (not rc)
    er_net_av = max(0.0, req_er - total_er_other)
    er_net_ep = max(0.0, req_er - total_er_other)

    # ── Calculate AV ──
    av = 0.0
    breakdown: dict[str, float] = {}

    for s in sub_stats:
        raw_type = s.get("type", "")
        value = float(s.get("value", 0))
        evc_name = STAT_NAME_MAP.get(raw_type, "")

        if not evc_name:
            continue  # unknown stat

        display_name = EVC_TO_DISPLAY.get(evc_name, raw_type)

        if evc_name == "ER(%)":
            contrib = _av_er(er_net_av, er_ssr, er_med, er_imp)
        else:
            weight = char_rv.get(evc_name, 0.0)
            median = SUBSTAT_MEDIANS.get(evc_name, 1.0)
            contrib = (value / median) * weight

        av += contrib
        breakdown[display_name] = round(contrib, 4)

    # ── Calculate EP (top-5 slot weights) ──
    er_ep_weight = _ep_er(er_net_ep, er_med, er_imp)
    all_weights = list(char_rv.values()) + [er_ep_weight]
    # top 5 largest weights
    top5 = heapq.nlargest(5, all_weights)
    ep = sum(top5)

    if ep <= 0:
        return {
            "score": 0.0,
            "score_percent": 0.0,
            "tier": "Unbuilt",
            "tier_label": "Unbuilt",
            "breakdown": breakdown,
            "max_possible": 0.0,
        }

    es = min((av / ep) * 100.0, 100.0)
    tier_label = _get_tier_label(es)

    return {
        "score": round(av, 4),
        "score_percent": round(es, 2),
        "tier": tier_label,
        "tier_label": tier_label,
        "breakdown": breakdown,
        "max_possible": round(ep, 4),
    }


def _score_one_stateful(
    sub_stats: list[dict],
    char_rv: dict[str, float],
    er_imp: float,
    req_er: float,
    er_net_av: float,
    er_net_ep: float,
) -> tuple[dict, float, float]:
    """
    Score a single echo while maintaining ER state across echoes (EVC 'full' mode).
    Returns (result_dict, updated_er_net_av, updated_er_net_ep).
    """
    er_med = SUBSTAT_MEDIANS["ER(%)"]

    # Find this echo's ER substat value
    er_ssr = 0.0
    for s in sub_stats:
        if STAT_NAME_MAP.get(s.get("type", ""), "") == "ER(%)":
            er_ssr = float(s.get("value", 0))
            break

    # ── AV ──
    av = 0.0
    breakdown: dict[str, float] = {}

    # ER av contribution (updates er_net_av)
    if er_net_av < 0:
        er_av = (er_ssr / er_med) * er_imp
        # er_net_av stays negative (EVC behaviour: not updated in deficit branch)
    else:
        new_er_net = er_net_av - er_ssr
        if new_er_net < 0:
            er_av = (-new_er_net / er_med) * er_imp
            er_net_av = 0.0
        else:
            er_av = 0.0
            er_net_av = new_er_net

    av += er_av
    if er_av > 0:
        breakdown["ER%"] = round(er_av, 4)

    for s in sub_stats:
        raw_type = s.get("type", "")
        value = float(s.get("value", 0))
        evc_name = STAT_NAME_MAP.get(raw_type, "")
        if not evc_name or evc_name == "ER(%)":
            continue
        display_name = EVC_TO_DISPLAY.get(evc_name, raw_type)
        weight = char_rv.get(evc_name, 0.0)
        median = SUBSTAT_MEDIANS.get(evc_name, 1.0)
        contrib = (value / median) * weight
        av += contrib
        breakdown[display_name] = round(contrib, 4)

    # ── EP (top-5 slot weights with stateful ER) ──
    # EVC ep_er: same sign convention (negative = deficit)
    if er_net_ep < 0:
        er_net_ep_temp = er_net_ep - er_ssr
        er_ep = er_imp if er_net_ep_temp / er_med <= -1 else (-er_net_ep_temp / er_med) * er_imp
        # er_net_ep not updated in deficit branch
    else:
        new_er_net_ep = er_net_ep - er_ssr
        if new_er_net_ep < 0:
            er_ep = er_imp if new_er_net_ep / er_med <= -1 else (-new_er_net_ep / er_med) * er_imp
            er_net_ep = 0.0
        else:
            er_ep = 0.0
            er_net_ep = new_er_net_ep

    all_weights = list(char_rv.values()) + [er_ep]
    ep = sum(heapq.nlargest(5, all_weights))

    if ep <= 0:
        return (
            {"score": 0.0, "score_percent": 0.0, "tier": "Unbuilt",
             "tier_label": "Unbuilt", "breakdown": {}, "max_possible": 0.0},
            er_net_av, er_net_ep,
        )

    es = min((av / ep) * 100.0, 100.0)
    tier_label = _get_tier_label(es)
    return (
        {
            "score": round(av, 4),
            "score_percent": round(es, 3),
            "tier": tier_label,
            "tier_label": tier_label,
            "breakdown": breakdown,
            "max_possible": round(ep, 4),
        },
        er_net_av, er_net_ep,
    )


def calculate_set_score(
    echoes_sub_stats: list[list[dict]],
    character_name: str | None = None,
    total_er: float | None = None,
) -> list[dict]:
    """
    Score a full set of echoes using EVC 'full' mode:
    - Echoes with ER substat are processed first (to consume the ER deficit first)
    - er_net_av / er_net_ep state is shared across all 5 echoes
    Returns a list of result dicts in the ORIGINAL echo order.
    """
    char_data = CHARACTER_DATA.get(character_name) if character_name else None

    if char_data is None or not char_data.get("anal", True):
        # Support characters or unknown: score each independently (N/A)
        return [calculate_score(ss, character_name, total_er) for ss in echoes_sub_stats]

    char_rv: dict[str, float] = char_data["rv"]
    req_er, er_imp, rc = char_data["er"]
    total_er_val = total_er if total_er is not None else 100.0

    # Initial ER net (EVC sign: negative = deficit)
    er_net = (total_er_val - req_er) if req_er > 100 else 0.0
    er_net_av = er_net
    er_net_ep = er_net

    # Process ER-carrying echoes first (EVC 'full' ordering)
    def _has_er(ss: list[dict]) -> bool:
        return any(STAT_NAME_MAP.get(s.get("type", ""), "") == "ER(%)"
                   and float(s.get("value", 0)) > 0 for s in ss)

    n = len(echoes_sub_stats)
    er_first = [i for i in range(n) if _has_er(echoes_sub_stats[i])]
    no_er = [i for i in range(n) if not _has_er(echoes_sub_stats[i])]
    echo_order = er_first + no_er

    results: list[dict | None] = [None] * n
    for idx in echo_order:
        r, er_net_av, er_net_ep = _score_one_stateful(
            echoes_sub_stats[idx], char_rv, er_imp, req_er, er_net_av, er_net_ep
        )
        results[idx] = r

    return [r or calculate_score([], character_name, total_er) for r in results]
