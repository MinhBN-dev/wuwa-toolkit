"""
Team-buff reference data for the /buffs comparison page.

NOT part of the EVC scoring pipeline — this is a lookup dataset only. Nothing here
feeds `scoring_service`, so editing it never requires `POST /score/recalculate-all`.

Sourced by hand from public, *released* game content (in-game skill text as reported
by Game8 / Prydwen / community DBs) — no beta/leak numbers. Buff values change with
patches, so every character records `patch_verified` + `sources`, and every entry
records `confidence`:
    high   — wording and number consistent across sources
    medium — number from a single source, or duration/condition inferred
    low    — sources disagree, or it's unclear whether the buff is team-wide or self

In `BUFF_DATA` only buffs that reach *someone else* are listed (`target` = team /
next / enemy); pure self-buffs from the kit are summarised in `notes` instead.

Two independent axes, matching how the user reads a build ("S0R1"):
  * **S = Sequence** (cung mệnh / Resonance Chain) — `seq` field. The table always
    shows S0, i.e. only `seq: 0`. Entries with `seq: 1-6` stay here as reference and
    are rendered only in the per-character detail panel.
  * **R = Rank** (tinh luyện) of the **vũ khí trấn** — `WEAPON_DATA` below. The "Trấn"
    tick on each column adds that weapon at **R1**, including the stats it gives the
    wielder (`target: "self"`), because the user wants the full weapon contribution.

Echo main-stats and Sonata set effects are still out of scope.
"""

# ─────────────────────────────────────────────
# Row taxonomy — order here IS the table row order; `group` draws the section bands.
# ─────────────────────────────────────────────
BUFF_CATEGORIES: list[dict] = [
    # Đã bỏ "Base / Flat ATK" và "Energy Regen": sau khi loại base ATK + chỉ số chính của
    # vũ khí ra khỏi phần tính, không entry nào còn dùng 2 category này. Thêm lại nếu
    # có buff thật sự cộng Flat ATK / ER cho đồng đội.
    {"key": "atk_pct",        "label": "ATK",                "group": "Stats",   "unit": "%"},
    {"key": "hp_pct",         "label": "HP",                 "group": "Stats",   "unit": "%"},
    {"key": "def_pct",        "label": "DEF",                "group": "Stats",   "unit": "%"},
    {"key": "crit_rate",      "label": "Crit Rate",          "group": "Crit",    "unit": "%"},
    {"key": "crit_dmg",       "label": "Crit DMG",           "group": "Crit",    "unit": "%"},
    # "DMG Deepen" đã bỏ: đó là bản dịch cũ, skill text hiện tại dùng "DMG Amplified".
    # Nếu game trả lại thuật ngữ Deepen thì thêm lại category riêng — KHÔNG gộp vào dmg_amplify.
    {"key": "dmg_amplify",    "label": "DMG Amplification",  "group": "Amplify", "unit": "%"},
    {"key": "dmg_bonus",      "label": "DMG Bonus",          "group": "Amplify", "unit": "%"},
    {"key": "res_shred",      "label": "RES Shred / Ignore", "group": "Shred",   "unit": "%"},
    {"key": "def_shred",      "label": "DEF Shred / Ignore", "group": "Shred",   "unit": "%"},
    {"key": "healing_bonus",  "label": "Healing Bonus",      "group": "Sustain", "unit": "%"},
    {"key": "sustain",        "label": "Heal / Shield / Mitigation", "group": "Sustain", "unit": ""},
    {"key": "energy",         "label": "Concerto / Resonance Energy", "group": "Utility", "unit": ""},
    {"key": "other",          "label": "Other",              "group": "Utility", "unit": ""},
]

BUFF_GROUP_ORDER: list[str] = ["Stats", "Crit", "Amplify", "Shred", "Sustain", "Utility"]

# ─────────────────────────────────────────────
# BUFF_DATA — key = base character name (matches frontend `getBaseName`, so
# CHARACTER_DATA variants like "Phoebe (Main DPS)" resolve to one column).
#
# Entry fields:
#   cat        one of BUFF_CATEGORIES.key
#   value      numeric magnitude, or None for text-only effects (use `text`)
#   text       shown instead of a number when `value` is None
#   applies_to what the buff is scoped to ("All-Type", "Havoc", "Basic Attack", ...)
#   target     "team" (whole party) | "next" (incoming Resonator only) | "enemy" (debuff)
#              | "self" (chỉ người cầm — chủ yếu là stat của vũ khí trấn)
#   seq        0 = base kit; 1-6 = granted by that Resonance Chain node
#              (bảng chỉ tính seq 0 — user chốt mọi nhân vật ở S0; seq 1-6 chỉ tham khảo)
#   replaces   True = supersedes the same-cat base entry instead of stacking on it
#   source     where in the kit it comes from
#   duration   seconds, or None if permanent/field-bound
#   condition  what has to be true for it to apply
#   confidence high | medium | low
# ─────────────────────────────────────────────
BUFF_DATA: dict[str, dict] = {
    "The Shorekeeper": {
        "patch_verified": "3.5",
        "sources": [
            "https://game8.co/games/Wuthering-Waves/archives/463667",
            "https://www.prydwen.gg/wuthering-waves/characters/the-shorekeeper",
        ],
        "notes": "S1 chỉ nới rộng Stellarealm (range +150%, duration +10s). "
                 "S3/S5/S6 là buff cá nhân (Concerto, pull, Intro DMG +42% & Crit DMG +500% cho chính SK).",
        "buffs": [
            {"cat": "dmg_amplify", "value": 15.0, "applies_to": "All-Type", "target": "team",
             "seq": 0, "source": "Outro — Binary Butterfly", "duration": 30,
             "condition": "", "confidence": "high"},
            {"cat": "crit_rate", "value": 12.5, "applies_to": "All-Type", "target": "team",
             "seq": 0, "source": "Inner Stellarealm (1 Intro)", "duration": None,
             "condition": "Đứng trong Stellarealm; scale theo ER (+1% mỗi 20% ER, max ở 250% ER)",
             "confidence": "high"},
            {"cat": "crit_dmg", "value": 25.0, "applies_to": "All-Type", "target": "team",
             "seq": 0, "source": "Supernal Stellarealm (2 Intro)", "duration": None,
             "condition": "Đứng trong Stellarealm; scale theo ER, max ở 250% ER",
             "confidence": "high"},
            {"cat": "atk_pct", "value": 40.0, "applies_to": "All-Type", "target": "team",
             "seq": 2, "source": "S2 — Outer Stellarealm", "duration": None,
             "condition": "Đứng trong Stellarealm", "confidence": "medium"},
            {"cat": "healing_bonus", "value": 70.0, "applies_to": "Healing", "target": "team",
             "seq": 4, "source": "S4", "duration": None,
             "condition": "Khi cast Resonance Skill", "confidence": "medium"},
            {"cat": "sustain", "value": None, "text": "Heal + shield diện rộng",
             "applies_to": "Healing", "target": "team", "seq": 0,
             "source": "Resonance Skill / Liberation", "duration": None,
             "condition": "", "confidence": "high"},
        ],
    },

    "Verina": {
        # Đối chiếu nguyên văn skill text (datamine) 10.08.2026 — Game8 còn ghi Outro là
        # "All-Type DMG Deepen", đó là bản dịch CŨ; in-game hiện là "DMG Amplified".
        "patch_verified": "3.5",
        "sources": [
            "https://wuwa.incin.net/resonators/1503",
            "https://game8.co/games/Wuthering-Waves/archives/454229",
        ],
        "notes": "R2 hồi 1 Photosynthesis Energy + 10 Concerto (tự thân). "
                 "R6 Heavy/Mid-air Starflower Blooms +20% DMG và kèm 1 Coordinated Attack có heal.",
        "buffs": [
            {"cat": "atk_pct", "value": 20.0, "applies_to": "All-Type", "target": "team",
             "seq": 0, "source": "Inherent — Gift of Nature", "duration": 20,
             "condition": "Khi cast Heavy/Mid-air Starflower Blooms, Liberation Arboreal Flourish hoặc Outro",
             "confidence": "high"},
            {"cat": "dmg_amplify", "value": 15.0, "applies_to": "All-Type", "target": "team",
             "seq": 0, "source": "Outro — Blossom", "duration": 30,
             "condition": "", "confidence": "high"},
            {"cat": "sustain", "value": None, "text": "Heal 19% ATK/s trong 6s",
             "applies_to": "Healing", "target": "next", "seq": 0,
             "source": "Outro — Blossom", "duration": 6, "condition": "", "confidence": "high"},
            {"cat": "sustain", "value": None, "text": "Shield 120% ATK + chặn 1 đòn chí mạng",
             "applies_to": "Shield", "target": "team", "seq": 0,
             "source": "Inherent — Grace of Life", "duration": 10,
             "condition": "Mỗi 10 phút 1 lần", "confidence": "high"},
            {"cat": "sustain", "value": None, "text": "Heal 20% ATK mỗi 5s",
             "applies_to": "Healing", "target": "next", "seq": 1,
             "source": "R1 — Moment of Emergence (Outro)", "duration": 30,
             "condition": "", "confidence": "high"},
            {"cat": "dmg_bonus", "value": 15.0, "applies_to": "Spectro", "target": "team",
             "seq": 4, "source": "R4 — Blossoming Embrace", "duration": 24,
             "condition": "Khi cast Heavy/Mid-air Starflower Blooms, Liberation hoặc Outro",
             "confidence": "high"},
            {"cat": "healing_bonus", "value": 20.0, "applies_to": "Healing", "target": "team",
             "seq": 5, "source": "R5 — Miraculous Blooms", "duration": None,
             "condition": "Chỉ khi mục tiêu dưới 50% HP", "confidence": "high"},
        ],
    },

    "Zhezhi": {
        "patch_verified": "3.5",
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/461497"],
        "notes": "S1 (+10% Crit Rate) và S3 (+15% ATK/stack) là buff cho chính Zhezhi.",
        "buffs": [
            {"cat": "dmg_amplify", "value": 20.0, "applies_to": "Glacio", "target": "next",
             "seq": 0, "source": "Outro — Painted Nature", "duration": 14,
             "condition": "Đến khi đổi nhân vật", "confidence": "high"},
            {"cat": "dmg_amplify", "value": 25.0, "applies_to": "Resonance Skill", "target": "next",
             "seq": 0, "source": "Outro — Painted Nature", "duration": 14,
             "condition": "Đến khi đổi nhân vật", "confidence": "high"},
            {"cat": "energy", "value": 15.0, "text": "15 Resonance Energy",
             "applies_to": "Resonance Energy", "target": "next", "seq": 0,
             "source": "Inherent — Flourish", "duration": None,
             "condition": "Sau khi dùng Outro", "confidence": "medium"},
            {"cat": "atk_pct", "value": 20.0, "applies_to": "All-Type", "target": "team",
             "seq": 4, "source": "S4", "duration": 30,
             "condition": "Khi cast Resonance Liberation", "confidence": "medium"},
        ],
    },

    "Cantarella": {
        "patch_verified": "3.5",
        "sources": [
            "https://game8.co/games/Wuthering-Waves/archives/500493",
            "https://www.prydwen.gg/wuthering-waves/characters/cantarella",
        ],
        "notes": "IS2 (+6% Havoc DMG/stack, tối đa 2) là buff cá nhân. S1/S2/S3/S5 tăng multiplier riêng.",
        "buffs": [
            {"cat": "dmg_amplify", "value": 20.0, "applies_to": "Havoc", "target": "next",
             "seq": 0, "source": "Outro — Dreamweaver", "duration": 14,
             "condition": "Một số nguồn ghi là 'Havoc DMG Bonus' thay vì Amplification",
             "confidence": "medium"},
            {"cat": "dmg_amplify", "value": 25.0, "applies_to": "Resonance Skill", "target": "next",
             "seq": 0, "source": "Outro — Dreamweaver", "duration": 14,
             "condition": "Một số nguồn ghi là 'Deepen' thay vì Amplification",
             "confidence": "medium"},
            {"cat": "sustain", "value": None, "text": "Heal team khi Basic Attack trong Mirage",
             "applies_to": "Healing", "target": "team", "seq": 0,
             "source": "Forte — Perception Drain", "duration": None,
             "condition": "", "confidence": "high"},
            {"cat": "healing_bonus", "value": 20.0, "applies_to": "Healing", "target": "team",
             "seq": 0, "source": "Inherent — Cure", "duration": None,
             "condition": "", "confidence": "medium"},
            {"cat": "healing_bonus", "value": 25.0, "applies_to": "Healing", "target": "team",
             "seq": 4, "source": "S4", "duration": None,
             "condition": "Khi đang trong Mirage", "confidence": "medium"},
            {"cat": "def_shred", "value": 30.0, "applies_to": "All-Type", "target": "enemy",
             "seq": 6, "source": "S6 — Liberation", "duration": 10,
             "condition": "", "confidence": "medium"},
        ],
    },

    "Ciaccona": {
        # Đối chiếu skill text (datamine) + 3 nguồn số 10.08.2026.
        # Trang datamine tóm tắt Outro là 50%/15s nhưng Game8 + wuthering.gg + wuwa.build
        # đều ghi 100%/30s → lấy 100%/30s.
        "patch_verified": "3.5",
        "sources": [
            "https://wuwa.incin.net/resonators/1407",
            "https://wuthering.gg/characters/ciaccona",
            "https://game8.co/games/Wuthering-Waves/archives/507924",
        ],
        "notes": "Buff cá nhân: IS Interlude Tune (shield 30% Max HP cho chính Ciaccona), "
                 "IS Winds of Rinascita (+60% Heavy Attack), R1 (miễn gián đoạn 3s), R3 (thêm Musical Essence), "
                 "R4 (bỏ qua 45% DEF khi Heavy Attack), R5 (+40% Res. Liberation DMG Bonus cho bản thân), "
                 "R6 (đòn Aero 220% ATK trong Solo Concert).",
        "buffs": [
            {"cat": "dmg_amplify", "value": 100.0, "applies_to": "Aero Erosion", "target": "team",
             "seq": 0, "source": "Outro — Windcalling Tune", "duration": 30,
             "condition": "Chỉ khuếch đại sát thương Aero Erosion quanh nhân vật đang đứng sân",
             "confidence": "high"},
            {"cat": "dmg_bonus", "value": 24.0, "applies_to": "Aero", "target": "team",
             "seq": 0, "source": "Forte — Solo Concert", "duration": None,
             "condition": "Khi Ciaccona hoặc Ensemble Sylph đang diễn Solo Concert; không cộng dồn",
             "confidence": "high"},
            {"cat": "other", "value": None, "text": "Gắn stack Aero Erosion lên địch",
             "applies_to": "Negative Status", "target": "enemy", "seq": 0,
             "source": "Intro / Resonance Skill / Forte", "duration": None,
             "condition": "Enabler cho team Aero Erosion (Cartethyia…)", "confidence": "high"},
            {"cat": "dmg_bonus", "value": 40.0, "applies_to": "Aero", "target": "team",
             "seq": 2, "source": "R2 — Song of the Four Seasons", "duration": None,
             "condition": "Trong lúc Resonance Liberation Singer's Triple Cadenza đang chạy",
             "confidence": "high"},
            {"cat": "sustain", "value": None, "text": "Giảm 30% sát thương nhận vào",
             "applies_to": "Mitigation", "target": "team", "seq": 5,
             "source": "R5 — Eternal Idyll to Lasting Summer", "duration": None,
             "condition": "Trong và quanh phạm vi Resonance Liberation", "confidence": "high"},
        ],
    },

    "Lupa": {
        "patch_verified": "3.5",
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/520661"],
        "notes": "S1/S4/S5/S6 là buff cá nhân (Concerto, Crit Rate, multiplier, 30% DEF ignore).",
        "buffs": [
            {"cat": "dmg_amplify", "value": 20.0, "applies_to": "Fusion", "target": "next",
             "seq": 0, "source": "Outro", "duration": 14,
             "condition": "Đến khi đổi nhân vật", "confidence": "high"},
            {"cat": "dmg_amplify", "value": 25.0, "applies_to": "Basic Attack", "target": "next",
             "seq": 0, "source": "Outro", "duration": 14,
             "condition": "Đến khi đổi nhân vật", "confidence": "high"},
            {"cat": "res_shred", "value": 9.0, "applies_to": "Fusion", "target": "team",
             "seq": 0, "source": "Inherent — Applause of Victory", "duration": None,
             "condition": "3% cơ bản, +3% mỗi đồng đội Fusion (9% khi full Fusion; +6% nữa ở team toàn Fusion)",
             "confidence": "medium"},
            {"cat": "dmg_bonus", "value": 40.0, "applies_to": "Fusion", "target": "team",
             "seq": 2, "source": "S2", "duration": 30,
             "condition": "20% mỗi stack, tối đa 2 stack", "confidence": "medium"},
            {"cat": "res_shred", "value": 15.0, "applies_to": "Fusion", "target": "team",
             "seq": 3, "source": "S3", "duration": None,
             "condition": "Đồng thời bỏ điều kiện phải là team toàn Fusion", "confidence": "medium"},
        ],
    },

    "Phoebe": {
        "patch_verified": "3.5",
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/486244"],
        "notes": "S1-S3 và S6 chủ yếu tăng sát thương cá nhân của Phoebe.",
        "buffs": [
            {"cat": "res_shred", "value": 10.0, "applies_to": "Spectro", "target": "enemy",
             "seq": 0, "source": "Outro — Confession (Silent Prayer)", "duration": 30,
             "condition": "", "confidence": "high"},
            {"cat": "dmg_amplify", "value": 100.0, "applies_to": "Spectro Frazzle", "target": "team",
             "seq": 0, "source": "Outro — Confession", "duration": 30,
             "condition": "Chỉ khuếch đại sát thương Spectro Frazzle", "confidence": "high"},
            {"cat": "res_shred", "value": 10.0, "applies_to": "Spectro", "target": "enemy",
             "seq": 4, "source": "S4", "duration": 30, "condition": "", "confidence": "medium"},
            {"cat": "dmg_bonus", "value": 12.0, "applies_to": "Spectro", "target": "team",
             "seq": 5, "source": "S5 — Intro Skill", "duration": 15,
             "condition": "Nguồn không nói rõ team hay chỉ Phoebe — cần xác nhận",
             "confidence": "low"},
        ],
    },

    "Sanhua": {
        "patch_verified": "3.5",
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/454225"],
        "notes": "IS1/IS2 (+20% dmg skill/Ice Burst) là buff cá nhân.",
        "buffs": [
            {"cat": "dmg_amplify", "value": 38.0, "applies_to": "Basic Attack", "target": "next",
             "seq": 0, "source": "Outro — Frozen Flowers", "duration": 14,
             "condition": "Đến khi đổi nhân vật", "confidence": "high"},
            {"cat": "atk_pct", "value": 20.0, "applies_to": "All-Type", "target": "team",
             "seq": 6, "source": "S6 — Daybreak Radiance", "duration": 20,
             "condition": "10% mỗi stack (tối đa 2) khi Ice Prism / Glacier nổ", "confidence": "medium"},
        ],
    },

    "Roccia": {
        "patch_verified": "3.5",
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/486246"],
        "notes": "IS1 (+20% ATK), S3 (+10% CR/+30% CD), S4/S5/S6 là buff cá nhân.",
        "buffs": [
            {"cat": "dmg_amplify", "value": 20.0, "applies_to": "Havoc", "target": "next",
             "seq": 0, "source": "Outro — Applause, Please!", "duration": 14,
             "condition": "Đến khi đổi nhân vật", "confidence": "high"},
            {"cat": "dmg_amplify", "value": 25.0, "applies_to": "Basic Attack", "target": "next",
             "seq": 0, "source": "Outro — Applause, Please!", "duration": 14,
             "condition": "Đến khi đổi nhân vật", "confidence": "high"},
            {"cat": "dmg_bonus", "value": 30.0, "applies_to": "Havoc", "target": "team",
             "seq": 2, "source": "S2", "duration": 30,
             "condition": "10% mỗi stack, tối đa 3 stack (Basic Attack Real Fantasy)",
             "confidence": "medium"},
        ],
    },

    "Rover (Spectro)": {
        "patch_verified": "3.5",
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/454228"],
        "notes": "Rover Spectro là enabler Spectro Frazzle chứ không phải buffer chỉ số. "
                 "S1/S2/S3/S5 đều là buff cá nhân.",
        "buffs": [
            {"cat": "other", "value": None, "text": "Vùng stasis (khống chế) 3s",
             "applies_to": "Crowd Control", "target": "next", "seq": 0,
             "source": "Outro", "duration": 3, "condition": "", "confidence": "high"},
            {"cat": "sustain", "value": None, "text": "Heal 20% ATK/s trong 5s",
             "applies_to": "Healing", "target": "team", "seq": 4,
             "source": "S4", "duration": 5, "condition": "", "confidence": "medium"},
            {"cat": "res_shred", "value": 10.0, "applies_to": "Spectro", "target": "enemy",
             "seq": 6, "source": "S6", "duration": 20, "condition": "", "confidence": "medium"},
        ],
    },

    "Rover (Aero)": {
        # Đối chiếu skill text (datamine) 10.08.2026.
        "patch_verified": "3.5",
        "sources": [
            "https://wuwa.incin.net/resonators/1406",
            "https://game8.co/games/Wuthering-Waves/archives/505267",
        ],
        "notes": "Buff cá nhân: IS1 Sand in the Storm (+20% ATK 10s sau Intro), "
                 "S1 (kháng gián đoạn 3s), S3 (+15% Aero DMG), S4 (+15% Resonance Skill DMG 5s), "
                 "S5 (+20% multiplier Liberation), S6 (+30% multiplier Unbound Flow). "
                 "Là nhân vật duy nhất nâng được trần stack Aero Erosion.",
        "buffs": [
            {"cat": "other", "value": None,
             "text": "Aeolian Realm: +3 trần stack Aero Erosion (10s mỗi lần đánh trúng)",
             "applies_to": "Negative Status", "target": "team", "seq": 0,
             "source": "Outro — Storm's Echo", "duration": 30,
             "condition": "Không cộng dồn cùng hiệu ứng", "confidence": "high"},
            {"cat": "sustain", "value": None, "text": "Heal toàn đội",
             "applies_to": "Healing", "target": "team", "seq": 0,
             "source": "Resonance Liberation — Omega Storm", "duration": None,
             "condition": "", "confidence": "high"},
            {"cat": "healing_bonus", "value": 20.0, "applies_to": "Healing", "target": "team",
             "seq": 0, "source": "Inherent — Boundless Winds", "duration": None,
             "condition": "Chỉ áp dụng cho heal từ Liberation Omega Storm", "confidence": "high"},
            {"cat": "sustain", "value": None,
             "text": "Heal 20% ATK mỗi 3s + cấp cứu khi dưới 35% HP",
             "applies_to": "Healing", "target": "team", "seq": 2,
             "source": "S2 — Glimmers Fade into the Dark", "duration": 30,
             "condition": "", "confidence": "high"},
        ],
    },

    "Chisa": {
        "patch_verified": "3.5",
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/524880"],
        "notes": "IS2 All Ends Here (+20% Havoc DMG Bonus và +20% Healing Bonus trong 12s) chỉ buff cho "
                 "CHÍNH Chisa — user xác nhận 10.08.2026, không phải buff đội (Game8 ghi mập mờ). "
                 "S1/S3/S4/S5 tăng sát thương hoặc tốc độ tích Bane của chính Chisa.",
        "buffs": [
            {"cat": "other", "value": None,
             "text": "+3 stack trần Negative Status; trao Thread of Bane 15s",
             "applies_to": "Negative Status", "target": "team", "seq": 0,
             "source": "Outro — Unraveling: Law Zero", "duration": 20,
             "condition": "Không cộng dồn với hiệu ứng cùng loại", "confidence": "medium"},
            {"cat": "dmg_bonus", "value": 50.0, "applies_to": "All-Attribute", "target": "team",
             "seq": 2, "source": "S2", "duration": None,
             "condition": "Chỉ cho Resonator đang mang Thread of Bane", "confidence": "medium"},
            {"cat": "dmg_amplify", "value": 30.0, "applies_to": "Negative Status", "target": "enemy",
             "seq": 6, "source": "S6", "duration": None,
             "condition": "Kèm +40% sát thương Chisa gây lên mục tiêu đó", "confidence": "low"},
        ],
    },

    "Mornye": {
        "patch_verified": "3.5",
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/568193"],
        "notes": "S3/S5/S6 hồi tài nguyên hoặc tăng sát thương cá nhân.",
        "buffs": [
            {"cat": "dmg_amplify", "value": 25.0, "applies_to": "All-Type", "target": "team",
             "seq": 0, "source": "Outro", "duration": 30, "condition": "", "confidence": "high"},
            {"cat": "sustain", "value": None,
             "text": "Chặn sát thương vượt 30% Max HP (3 lần) + chống 1 đòn chí mạng",
             "applies_to": "Mitigation", "target": "team", "seq": 0,
             "source": "Inherent — Boundedness", "duration": None,
             "condition": "Reset mỗi 60s", "confidence": "medium"},
            {"cat": "energy", "value": 20.0, "text": "20 Concerto Energy",
             "applies_to": "Concerto", "target": "self", "seq": 0,
             "source": "Inherent — Blueprint", "duration": None,
             "condition": "Mỗi 20s, qua Intro hoặc Basic Stage 3", "confidence": "medium"},
            {"cat": "crit_dmg", "value": 32.0, "applies_to": "All-Type", "target": "team",
             "seq": 2, "source": "S2 — Morning Star", "duration": None,
             "condition": "Chỉ khi đánh mục tiêu đang bị Interfered", "confidence": "medium"},
            {"cat": "healing_bonus", "value": 30.0, "applies_to": "Healing", "target": "team",
             "seq": 4, "source": "S4", "duration": None, "condition": "", "confidence": "medium"},
        ],
    },

    "Lynae": {
        "patch_verified": "3.5",
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/568211"],
        "notes": "IS2 (+25% Spectro DMG 9s), S4 (+ATK), S5 (+sát thương) là buff cá nhân. "
                 "S1/S3/S6 không cho buff đội.",
        "buffs": [
            {"cat": "dmg_amplify", "value": 15.0, "applies_to": "All-Type", "target": "team",
             "seq": 0, "source": "Outro — Let's Hit the Road!", "duration": 14,
             "condition": "", "confidence": "high"},
            {"cat": "dmg_amplify", "value": 25.0, "applies_to": "Resonance Liberation", "target": "team",
             "seq": 0, "source": "Outro — Let's Hit the Road!", "duration": 14,
             "condition": "", "confidence": "high"},
            {"cat": "dmg_bonus", "value": 24.0, "applies_to": "All-Type", "target": "team",
             "seq": 0, "source": "Resonance Liberation — Prismatic Overblast", "duration": 30,
             "condition": "", "confidence": "high"},
            {"cat": "dmg_amplify", "value": 25.0, "applies_to": "All-Type", "target": "next",
             "seq": 2, "source": "S2", "duration": 14, "condition": "", "confidence": "medium"},
        ],
    },

    "Buling": {
        "patch_verified": "3.5",
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/557981"],
        "notes": "S1 (+20% Crit Rate cho Liberation), S2 (hồi 25 Resonance Energy), S4 (+20% Healing Bonus) "
                 "là buff cá nhân. S5 gắn thêm 6 stack Electro Flare lên địch.",
        "buffs": [
            {"cat": "dmg_amplify", "value": 15.0, "applies_to": "All-Type", "target": "team",
             "seq": 0, "source": "Outro — Exorcism Spell", "duration": 30,
             "condition": "", "confidence": "high"},
            {"cat": "sustain", "value": None, "text": "Heal 18% ATK/s trong 16s",
             "applies_to": "Healing", "target": "next", "seq": 0,
             "source": "Outro — Exorcism Spell", "duration": 16,
             "condition": "", "confidence": "high"},
            {"cat": "dmg_bonus", "value": 25.0, "applies_to": "Resonance Skill", "target": "team",
             "seq": 0, "source": "Resonance Liberation — Five Thunders Spell Array", "duration": None,
             "condition": "Cần 2 Intro trong vùng (1 Intro chỉ được 10%)", "confidence": "medium"},
            {"cat": "sustain", "value": None, "text": "Cấp cứu 350 + 150% ATK khi đồng đội dưới 50% HP",
             "applies_to": "Healing", "target": "team", "seq": 3,
             "source": "S3", "duration": None, "condition": "Mỗi 24s", "confidence": "medium"},
            {"cat": "dmg_bonus", "value": 50.0, "applies_to": "Resonance Skill", "target": "team",
             "seq": 6, "replaces": True, "source": "S6", "duration": None,
             "condition": "Nâng cấp mức 25% của Spell Array, không cộng dồn", "confidence": "medium"},
        ],
    },

    "Suisui": {
        "patch_verified": "3.5",
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/605302"],
        "notes": "S3-S6 chủ yếu tăng cơ chế riêng của Suisui. "
                 "IS1 còn ghi tăng Crit Rate/Glacio DMG cho đòn Skill/Intro — nguồn mô tả mơ hồ nên chưa đưa vào bảng.",
        "buffs": [
            {"cat": "dmg_amplify", "value": 25.0, "applies_to": "All-Type", "target": "team",
             "seq": 0, "source": "Outro — Rippling Waters", "duration": 30,
             "condition": "", "confidence": "high"},
            {"cat": "sustain", "value": None, "text": "Spring's Birth: hồi 62 + 0.34% Max HP mỗi 2s (tối đa 10 stack)",
             "applies_to": "Healing", "target": "next", "seq": 0,
             "source": "Inherent — Sky Over Water", "duration": None,
             "condition": "Mỗi Enrichment tiêu thụ trao 10 stack", "confidence": "medium"},
            {"cat": "other", "value": None, "text": "+3 stack trần cho Frazzle / Fusion Burst / Glacio Chafe / Aero Erosion / Electro Flare",
             "applies_to": "Negative Status", "target": "team", "seq": 0,
             "source": "Resonance Liberation — Song of Thoroughfare", "duration": None,
             "condition": "", "confidence": "medium"},
            {"cat": "res_shred", "value": 12.0, "applies_to": "Havoc", "target": "team",
             "seq": 0, "source": "Resonance Liberation", "duration": None,
             "condition": "Chỉ nhánh Havoc Bane", "confidence": "medium"},
            {"cat": "def_shred", "value": 6.0, "applies_to": "Havoc", "target": "team",
             "seq": 0, "source": "Resonance Liberation", "duration": None,
             "condition": "Chỉ nhánh Havoc Bane", "confidence": "medium"},
            {"cat": "crit_dmg", "value": 50.0, "applies_to": "All-Type", "target": "team",
             "seq": 2, "source": "S2", "duration": 30,
             "condition": "Trong vùng Ceaseless Landscape, sau khi gây Negative Status",
             "confidence": "medium"},
        ],
    },

    "Lumi": {
        "patch_verified": "3.5",
        "sources": [
            "https://game8.co/games/Wuthering-Waves/archives/473488",
            "https://www.prydwen.gg/wuthering-waves/characters/lumi",
        ],
        "notes": "IS1/IS2 (+10% Electro DMG, +10% ATK) và S1-S5 là buff cá nhân.",
        "buffs": [
            {"cat": "dmg_amplify", "value": 38.0, "applies_to": "Resonance Skill", "target": "next",
             "seq": 0, "source": "Outro — Escorting", "duration": 10,
             "condition": "Đến khi đổi nhân vật; Game8 không ghi số, 38% lấy từ nguồn khác",
             "confidence": "medium"},
            {"cat": "atk_pct", "value": 20.0, "applies_to": "All-Type", "target": "team",
             "seq": 6, "source": "S6 — Squeakie Express", "duration": 20,
             "condition": "Khi cast Resonance Liberation", "confidence": "medium"},
        ],
    },

    "Mortefi": {
        "patch_verified": "3.5",
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/454222"],
        "notes": "Giá trị thật của Mortefi nằm ở Coordinated Attack (Marcato) chứ không phải chỉ số. "
                 "IS1/IS2 và S2-S5 là buff cá nhân.",
        "buffs": [
            {"cat": "dmg_amplify", "value": 38.0, "applies_to": "Heavy Attack", "target": "next",
             "seq": 0, "source": "Outro — Rage Transposition", "duration": 14,
             "condition": "Đến khi đổi nhân vật", "confidence": "high"},
            {"cat": "other", "value": None, "text": "Coordinated Attack (Marcato) khi đồng đội dùng Resonance Skill",
             "applies_to": "Coordinated Attack", "target": "team", "seq": 1,
             "source": "S1", "duration": None, "condition": "", "confidence": "medium"},
            {"cat": "atk_pct", "value": 20.0, "applies_to": "All-Type", "target": "team",
             "seq": 6, "source": "S6 — Apoplectic Instrumental", "duration": 20,
             "condition": "Khi cast Resonance Liberation", "confidence": "medium"},
        ],
    },

    "Youhu": {
        "patch_verified": "3.5",
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/463668"],
        "notes": "S1/S2/S4 là tiện ích riêng; S3 (+20% ATK), S5 (+15% Crit Rate), S6 (+15% Crit DMG/stack) "
                 "theo nguồn là buff cho chính Youhu.",
        "buffs": [
            {"cat": "dmg_amplify", "value": 100.0, "applies_to": "Coordinated Attack", "target": "next",
             "seq": 0, "source": "Outro — Timeless Classics", "duration": 28,
             "condition": "Chỉ khuếch đại sát thương Coordinated Attack", "confidence": "high"},
            {"cat": "sustain", "value": None, "text": "Heal qua Scroll Divination (+30% hiệu quả từ IS1)",
             "applies_to": "Healing", "target": "team", "seq": 0,
             "source": "Resonance Skill + Inherent — Treasured Piece", "duration": None,
             "condition": "", "confidence": "medium"},
        ],
    },
}

# ─────────────────────────────────────────────
# WEAPON_DATA — vũ khí trấn (signature) ở **R1**, key = tên nhân vật trong BUFF_DATA.
# Nhân vật không có vũ khí trấn (4★ + Verina + Rover) không xuất hiện ở đây → UI khoá tick.
# `buffs` dùng chung schema với BUFF_DATA, nhưng có thêm target "self" cho stat của
# chính người cầm (main stat + passive tự thân). Số lấy ở Lv.90 / Rank 1.
# ─────────────────────────────────────────────
# Chỉ chứa phần **cộng thêm trong mô tả weapon skill**. Base ATK và chỉ số chính
# (Crit Rate / Crit DMG / ER của vũ khí) KHÔNG vào `buffs` — chúng nằm ở `base_atk`
# và `main_stat` để hiển thị tham khảo, vì đó là stat nền của vũ khí chứ không phải buff.
WEAPON_DATA: dict[str, dict] = {
    "The Shorekeeper": {
        "name": "Stellar Symphony", "main_stat": {"stat": "Energy Regen", "value": 77.0}, "rarity": 5, "type": "Rectifier", "base_atk": 412,
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/474386"],
        "buffs": [
            {"cat": "hp_pct", "value": 12.0, "applies_to": "Max HP", "target": "self",
             "seq": 0, "source": "Stellar Symphony — Astral Evolvement", "duration": None,
             "condition": "", "confidence": "high"},
            {"cat": "energy", "value": 8.0, "text": "8 Concerto Energy",
             "applies_to": "Concerto", "target": "self", "seq": 0,
             "source": "Stellar Symphony — Astral Evolvement", "duration": None,
             "condition": "Khi cast Resonance Liberation, mỗi 20s", "confidence": "high"},
            {"cat": "atk_pct", "value": 14.0, "applies_to": "All-Type", "target": "team",
             "seq": 0, "source": "Stellar Symphony — Astral Evolvement", "duration": 30,
             "condition": "Khi cast Resonance Skill có hồi máu", "confidence": "high"},
        ],
    },

    "Zhezhi": {
        "name": "Rime-Draped Sprouts", "main_stat": {"stat": "Crit DMG", "value": 72.0}, "rarity": 5, "type": "Rectifier", "base_atk": 500,
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/464109"],
        "buffs": [
            {"cat": "atk_pct", "value": 12.0, "applies_to": "All-Type", "target": "self",
             "seq": 0, "source": "Rime-Draped Sprouts — weapon skill", "duration": None,
             "condition": "", "confidence": "high"},
            {"cat": "dmg_bonus", "value": 36.0, "applies_to": "Basic Attack", "target": "self",
             "seq": 0, "source": "Rime-Draped Sprouts — weapon skill", "duration": 6,
             "condition": "12% mỗi stack khi dùng Resonance Skill, tối đa 3 stack",
             "confidence": "high"},
            {"cat": "dmg_bonus", "value": 52.0, "applies_to": "Basic Attack (off-field)", "target": "self",
             "seq": 0, "source": "Rime-Draped Sprouts — weapon skill", "duration": 27,
             "condition": "Cast Outro khi đủ 3 stack, tiêu hết stack", "confidence": "high"},
        ],
    },

    "Cantarella": {
        "name": "Whispers of Sirens", "main_stat": {"stat": "Crit DMG", "value": 72.0}, "rarity": 5, "type": "Rectifier", "base_atk": 500,
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/506482"],
        "buffs": [
            {"cat": "atk_pct", "value": 12.0, "applies_to": "All-Type", "target": "self",
             "seq": 0, "source": "Whispers of Sirens — From the Deep", "duration": None,
             "condition": "", "confidence": "high"},
            {"cat": "dmg_bonus", "value": 40.0, "applies_to": "Basic Attack", "target": "self",
             "seq": 0, "source": "Whispers of Sirens — Gentle Dream (1 stack)", "duration": 10,
             "condition": "Cast Echo Skill trong 10s sau Intro/Basic", "confidence": "high"},
            {"cat": "res_shred", "value": 12.0, "applies_to": "Havoc", "target": "enemy",
             "seq": 0, "source": "Whispers of Sirens — Gentle Dream (2 stack)", "duration": 10,
             "condition": "Cần đủ 2 stack Gentle Dream", "confidence": "high"},
        ],
    },

    "Ciaccona": {
        "name": "Woodland Aria", "main_stat": {"stat": "Crit Rate", "value": 36.0}, "rarity": 5, "type": "Pistols", "base_atk": 500,
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/514610"],
        "buffs": [
            {"cat": "atk_pct", "value": 12.0, "applies_to": "All-Type", "target": "self",
             "seq": 0, "source": "Woodland Aria — Lingering Summer Tune", "duration": None,
             "condition": "", "confidence": "high"},
            {"cat": "dmg_bonus", "value": 24.0, "applies_to": "Aero", "target": "self",
             "seq": 0, "source": "Woodland Aria — Lingering Summer Tune", "duration": 10,
             "condition": "Khi gây Aero Erosion lên mục tiêu", "confidence": "high"},
            {"cat": "res_shred", "value": 10.0, "applies_to": "Aero", "target": "enemy",
             "seq": 0, "source": "Woodland Aria — Lingering Summer Tune", "duration": 20,
             "condition": "Khi đánh trúng mục tiêu đang dính Aero Erosion", "confidence": "high"},
        ],
    },

    "Lupa": {
        "name": "Wildfire Mark", "main_stat": {"stat": "Crit DMG", "value": 48.6}, "rarity": 5, "type": "Broadblade", "base_atk": 587,
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/524869"],
        "buffs": [
            {"cat": "atk_pct", "value": 12.0, "applies_to": "All-Type", "target": "self",
             "seq": 0, "source": "Wildfire Mark — Blazing Starfire", "duration": None,
             "condition": "", "confidence": "high"},
            {"cat": "dmg_bonus", "value": 24.0, "applies_to": "Resonance Liberation", "target": "self",
             "seq": 0, "source": "Wildfire Mark — Blazing Starfire", "duration": 6,
             "condition": "Sau Intro hoặc Resonance Liberation; Heavy Attack gia hạn thêm 4s",
             "confidence": "high"},
            {"cat": "dmg_bonus", "value": 24.0, "applies_to": "Fusion", "target": "team",
             "seq": 0, "source": "Wildfire Mark — Blazing Starfire", "duration": 30,
             "condition": "Mỗi lần gia hạn thành công bằng Heavy Attack", "confidence": "high"},
        ],
    },

    "Phoebe": {
        "name": "Luminous Hymn", "main_stat": {"stat": "Crit Rate", "value": 36.0}, "rarity": 5, "type": "Rectifier", "base_atk": 500,
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/498527"],
        "buffs": [
            {"cat": "atk_pct", "value": 12.0, "applies_to": "All-Type", "target": "self",
             "seq": 0, "source": "Luminous Hymn — weapon skill", "duration": None,
             "condition": "", "confidence": "high"},
            {"cat": "dmg_bonus", "value": 42.0, "applies_to": "Basic Attack", "target": "self",
             "seq": 0, "source": "Luminous Hymn — weapon skill", "duration": 6,
             "condition": "14% mỗi stack khi đánh địch dính Spectro Frazzle, tối đa 3 stack",
             "confidence": "high"},
            {"cat": "dmg_bonus", "value": 42.0, "applies_to": "Heavy Attack", "target": "self",
             "seq": 0, "source": "Luminous Hymn — weapon skill", "duration": 6,
             "condition": "14% mỗi stack khi đánh địch dính Spectro Frazzle, tối đa 3 stack",
             "confidence": "high"},
            {"cat": "dmg_amplify", "value": 30.0, "applies_to": "Spectro Frazzle", "target": "team",
             "seq": 0, "source": "Luminous Hymn — weapon skill (Outro)", "duration": 30,
             "condition": "Khuếch đại Spectro Frazzle trên địch quanh nhân vật đứng sân",
             "confidence": "high"},
        ],
    },

    "Roccia": {
        "name": "Tragicomedy", "main_stat": {"stat": "Crit Rate", "value": 24.3}, "rarity": 5, "type": "Gauntlets", "base_atk": 587,
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/491971"],
        "buffs": [
            {"cat": "atk_pct", "value": 12.0, "applies_to": "All-Type", "target": "self",
             "seq": 0, "source": "Tragicomedy — weapon skill", "duration": None,
             "condition": "", "confidence": "high"},
            {"cat": "dmg_bonus", "value": 48.0, "applies_to": "Heavy Attack", "target": "self",
             "seq": 0, "source": "Tragicomedy — weapon skill", "duration": 3,
             "condition": "Mỗi lần cast Basic Attack hoặc Intro Skill", "confidence": "high"},
        ],
    },

    "Rover (Aero)": {
        "name": "Bloodpact's Pledge", "main_stat": {"stat": "Energy Regen", "value": 38.8},
        "rarity": 5, "type": "Sword", "base_atk": 587,
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/506483"],
        "buffs": [
            {"cat": "dmg_bonus", "value": 10.0, "applies_to": "Resonance Skill", "target": "self",
             "seq": 0, "source": "Bloodpact's Pledge — Harmonious Vibrancy", "duration": 6,
             "condition": "Sau khi hồi máu", "confidence": "high"},
            {"cat": "dmg_amplify", "value": 10.0, "applies_to": "Aero", "target": "team",
             "seq": 0, "source": "Bloodpact's Pledge — Harmonious Vibrancy", "duration": 30,
             "condition": "Chỉ khi Rover: Aero cast Resonance Skill Unbound Flow", "confidence": "high"},
        ],
    },

    "Chisa": {
        "name": "Kumokiri", "main_stat": {"stat": "Crit Rate", "value": 36.0}, "rarity": 5, "type": "Broadblade", "base_atk": 500,
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/565517"],
        "buffs": [
            {"cat": "atk_pct", "value": 12.0, "applies_to": "All-Type", "target": "self",
             "seq": 0, "source": "Kumokiri — Lifethread", "duration": None,
             "condition": "", "confidence": "high"},
            {"cat": "dmg_bonus", "value": 24.0, "applies_to": "Resonance Liberation", "target": "self",
             "seq": 0, "source": "Kumokiri — Lifethread", "duration": 15,
             "condition": "8% mỗi stack khi cast Intro hoặc gây Negative Status, tối đa 3 stack",
             "confidence": "high"},
            {"cat": "dmg_bonus", "value": 24.0, "applies_to": "All-Attribute", "target": "team",
             "seq": 0, "source": "Kumokiri — Lifethread", "duration": 15,
             "condition": "Cần người cầm đủ 3 stack; kích hoạt khi đồng đội gây Negative Status",
             "confidence": "high"},
        ],
    },

    "Mornye": {
        "name": "Starfield Calibrator", "main_stat": {"stat": "Energy Regen", "value": 77.0}, "rarity": 5, "type": "Broadblade", "base_atk": 412,
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/570864"],
        "buffs": [
            {"cat": "def_pct", "value": 16.0, "applies_to": "DEF", "target": "self",
             "seq": 0, "source": "Starfield Calibrator — Definite Solution", "duration": None,
             "condition": "", "confidence": "high"},
            {"cat": "energy", "value": 8.0, "text": "8 Concerto Energy",
             "applies_to": "Concerto", "target": "self", "seq": 0,
             "source": "Starfield Calibrator — Definite Solution", "duration": None,
             "condition": "Khi cast Resonance Liberation, mỗi 20s", "confidence": "high"},
            {"cat": "crit_dmg", "value": 20.0, "applies_to": "All-Type", "target": "team",
             "seq": 0, "source": "Starfield Calibrator — Definite Solution", "duration": 4,
             "condition": "Khi người cầm hồi máu cho đồng đội; không cộng dồn cùng tên",
             "confidence": "high"},
        ],
    },

    "Lynae": {
        "name": "Spectrum Blaster", "main_stat": {"stat": "Crit Rate", "value": 24.3}, "rarity": 5, "type": "Pistols", "base_atk": 587,
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/570863"],
        "buffs": [
            {"cat": "atk_pct", "value": 12.0, "applies_to": "All-Type", "target": "self",
             "seq": 0, "source": "Spectrum Blaster — Attendance Exemption Protocol", "duration": None,
             "condition": "", "confidence": "high"},
            {"cat": "dmg_bonus", "value": 36.0, "applies_to": "Basic Attack", "target": "self",
             "seq": 0, "source": "Spectrum Blaster — Attendance Exemption Protocol", "duration": 4,
             "condition": "Khi cast Intro hoặc đánh trúng bằng Basic Attack", "confidence": "high"},
            {"cat": "dmg_bonus", "value": 24.0, "applies_to": "All-Type", "target": "team",
             "seq": 0, "source": "Spectrum Blaster — Attendance Exemption Protocol", "duration": 30,
             "condition": "8% mỗi stack (tối đa 3) khi gây Tune Rupture/Strain - Shifting bằng Basic Attack",
             "confidence": "medium"},
        ],
    },

    "Suisui": {
        "name": "Firstlight's Herald", "main_stat": {"stat": "Energy Regen", "value": 77.0}, "rarity": 5, "type": "Rectifier", "base_atk": 412,
        "sources": ["https://game8.co/games/Wuthering-Waves/archives/606963"],
        "buffs": [
            {"cat": "hp_pct", "value": 12.0, "applies_to": "Max HP", "target": "self",
             "seq": 0, "source": "Firstlight's Herald — Spring Wreath", "duration": None,
             "condition": "", "confidence": "high"},
            {"cat": "energy", "value": 8.0, "text": "8 Concerto Energy",
             "applies_to": "Concerto", "target": "self", "seq": 0,
             "source": "Firstlight's Herald — Spring Wreath", "duration": None,
             "condition": "Khi cast Resonance Liberation, mỗi 20s", "confidence": "high"},
            {"cat": "atk_pct", "value": 20.0, "applies_to": "All-Type", "target": "team",
             "seq": 0, "source": "Firstlight's Herald — Spring Wreath", "duration": None,
             "condition": "Cần có đồng thời Snow Taint (gây Glacio Chafe) và Ripples (hồi máu), mỗi cái 6s",
             "confidence": "high"},
        ],
    },
}

# Order the columns render in (strongest / most-used buffers first).
BUFF_CHARACTER_ORDER: list[str] = list(BUFF_DATA.keys())
