"""
Wuthering Waves echo scoring data.
Source: https://github.com/AstyuteChick/Echo-Value-Calculator (evc_engine.py)
Ported 1:1 — do NOT manually edit weights; sync from upstream repo.
"""

# Sub-stat names (order matches weight arrays below)
REL_VAL_STAT_NAMES = [
    "Crit Rate(%)", "Crit Damage(%)", "Atk(%)", "Flat Atk",
    "HP(%)", "Flat HP", "Def(%)", "Flat Def",
    "Basic(%)", "Heavy(%)", "Skill(%)", "Liberation(%)",
]
SUBSTAT_NAMES = REL_VAL_STAT_NAMES + ["ER(%)"]

# Median value per sub-stat (used for normalization)
SUBSTAT_MEDIANS: dict[str, float] = {
    "Crit Rate(%)": 8.4,   "Crit Damage(%)": 16.8, "Atk(%)": 9.0,
    "Flat Atk": 45.0,      "HP(%)": 9.0,           "Flat HP": 450.0,
    "Def(%)": 11.35,       "Flat Def": 55.0,       "Basic(%)": 9.0,
    "Heavy(%)": 9.0,       "Skill(%)": 9.0,        "Liberation(%)": 9.0,
    "ER(%)": 9.6,
}

# Max value per sub-stat (5 perfect rolls)
SUBSTAT_MAX: dict[str, float] = {
    "Crit Rate(%)": 10.5,  "Crit Damage(%)": 21.0, "Atk(%)": 11.6,
    "Flat Atk": 60.0,      "HP(%)": 11.6,          "Flat HP": 580.0,
    "Def(%)": 14.7,        "Flat Def": 70.0,       "Basic(%)": 11.6,
    "Heavy(%)": 11.6,      "Skill(%)": 11.6,       "Liberation(%)": 11.6,
    "ER(%)": 12.4,
}

# All possible roll values per sub-stat
SUBSTAT_ROLLS: dict[str, list[float]] = {
    "Crit Rate(%)":    [6.3, 6.9, 7.5, 8.1, 8.7, 9.3, 9.9, 10.5],
    "Crit Damage(%)":  [12.6, 13.8, 15.0, 16.2, 17.4, 18.6, 19.8, 21.0],
    "Atk(%)":          [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6],
    "Flat Atk":        [30.0, 40.0, 50.0, 60.0],
    "HP(%)":           [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6],
    "Flat HP":         [320.0, 360.0, 390.0, 430.0, 470.0, 510.0, 540.0, 580.0],
    "Def(%)":          [8.1, 9.0, 10.0, 10.9, 11.8, 12.8, 13.8, 14.7],
    "Flat Def":        [40.0, 50.0, 60.0, 70.0],
    "Basic(%)":        [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6],
    "Heavy(%)":        [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6],
    "Skill(%)":        [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6],
    "Liberation(%)":   [6.4, 7.1, 7.9, 8.6, 9.4, 10.1, 10.9, 11.6],
    "ER(%)":           [6.8, 7.6, 8.4, 9.2, 10.0, 10.8, 11.6, 12.4],
}

# Main stat values at max level per echo cost
MAINSTAT_VALS: dict[int, dict[str, float]] = {
    4: {"Crit Rate(%)": 22.0, "Crit Damage(%)": 44.0, "Atk(%)": 33.0,
        "HP(%)": 33.0, "Def(%)": 41.5, "Heal(%)": 0.0},
    3: {"Atk(%)": 30.0, "Element(%)": 0.0, "HP(%)": 30.0, "Def(%)": 38.0, "ER(%)": 32.0},
    1: {"Atk(%)": 18.0, "HP(%)": 22.8, "Def(%)": 18.0},
}

# Secondary (flat) stat per echo cost [stat_name, value]
SEC_STATS: dict[int, list] = {
    4: ["Flat Atk", 150],
    3: ["Flat Atk", 100],
    1: ["Flat HP", 2280],
}

# ─────────────────────────────────────────────
# CHARACTER DATA
# Format per character:
#   "Name": {
#       "rv":   {stat: weight},           # relative value weights (12 stats)
#       "er":   [req_er, imp_er, rc],     # ER params
#       "anal": bool,                      # False = support, score N/A
#       "element": str, "weapon": str, "role": str   # for DB seeding
#   }
# Weight arrays ported directly from evc_engine.py Character.data
# ─────────────────────────────────────────────

def _make_rv(arr: list[float]) -> dict[str, float]:
    return {k: v for k, v in zip(REL_VAL_STAT_NAMES, arr)}


CHARACTER_DATA: dict[str, dict] = {
    "Aalto (DPS)": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.70, 0.0, 0.5*0.15, 0.5*0.10]),
        "er": [128.1, 0.45, 150.0], "anal": True,
        "element": "Aero", "weapon": "Pistols", "role": "DPS",
    },
    "Aalto (Sub-DPS)": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.45, 0.0, 0.5*0.25, 0.5*0.15]),
        "er": [138.1, 1.0, 150.0], "anal": True,
        "element": "Aero", "weapon": "Pistols", "role": "SubDPS",
    },
    "Aemeath": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.65]),
        "er": [120.0, 0.9, 125.0], "anal": True,
        "element": "Fusion", "weapon": "Sword", "role": "DPS",
    },
    "Augusta": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.75, 0.5*0.15, 0.0]),
        "er": [128.1, 0.9, 125.0], "anal": True,
        "element": "Spectro", "weapon": "Broadblade", "role": "DPS",
    },
    "Baizhi": {
        "rv": _make_rv([0.0, 0.0, 0.0, 0.0, 1.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        "er": [233.1, 1.0, 175.0], "anal": False,
        "element": "Glacio", "weapon": "Rectifier", "role": "Healer",
    },
    "Brant (sub DPS, ER/ER 3 cost setup)": {
        "rv": _make_rv([1.0, 1.0, 0.3, 0.2, 0.0, 0.0, 0.0, 0.0, 0.55, 0.0, 0.0, 0.05]),
        "er": [280.0, 0.8, 175.0], "anal": True,
        "element": "Fusion", "weapon": "Sword", "role": "SubDPS",
    },
    "Buling": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        "er": [138.1, 1.0, 150.0], "anal": False,
        "element": "Glacio", "weapon": "Gauntlets", "role": "SubDPS",
    },
    "Calcharo": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.25, 0.0, 0.0, 0.5*0.6]),
        "er": [128.1, 0.6, 125.0], "anal": True,
        "element": "Electro", "weapon": "Sword", "role": "DPS",
    },
    "Camellya": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.7, 0.0, 0.0, 0.5*0.15]),
        "er": [128.1, 0.2, 125.0], "anal": True,
        "element": "Havoc", "weapon": "Sword", "role": "DPS",
    },
    "Cantarella": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.7, 0.0, 0.5*0.1, 0.0]),
        "er": [138.1, 0.8, 125.0], "anal": True,
        "element": "Havoc", "weapon": "Pistols", "role": "DPS",
    },
    "Carlotta": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.85, 0.0]),
        "er": [128.1, 0.6, 125.0], "anal": True,
        "element": "Glacio", "weapon": "Pistols", "role": "DPS",
    },
    "Cartethyia": {
        "rv": _make_rv([1.0, 1.0, 0.0, 0.0, 0.5, 0.25, 0.0, 0.0, 0.5*0.55, 0.0, 0.5*0.1, 0.5*0.25]),
        "er": [115.0, 0.6, 125.0], "anal": True,
        "element": "Aero", "weapon": "Sword", "role": "DPS",
    },
    "Changli": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.6, 0.5*0.25]),
        "er": [123.1, 0.35, 125.0], "anal": True,
        "element": "Fusion", "weapon": "Sword", "role": "DPS",
    },
    "Chisa": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.75]),
        "er": [128.1, 0.7, 125.0], "anal": True,
        "element": "Havoc", "weapon": "Gauntlets", "role": "DPS",
    },
    "Chixia": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.5, 0.5*0.3]),
        "er": [145.0, 0.3, 150.0], "anal": True,
        "element": "Fusion", "weapon": "Pistols", "role": "DPS",
    },
    "Ciaccona": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.2, 0.5*0.15, 0.0, 0.5*0.3]),
        "er": [125.0, 1.0, 125.0], "anal": True,
        "element": "Aero", "weapon": "Sword", "role": "SubDPS",
    },
    "Danjin": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.25, 0.5*0.25, 0.5*0.3]),
        "er": [0.0, 0.0, 100.0], "anal": True,
        "element": "Havoc", "weapon": "Sword", "role": "DPS",
    },
    "Encore (Hypercarry)": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.5, 0.0, 0.5*0.15, 0.5*0.15]),
        "er": [128.1, 1.0, 125.0], "anal": True,
        "element": "Fusion", "weapon": "Rectifier", "role": "DPS",
    },
    "Galbrena": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.35, 0.0, 0.0]),
        "er": [128.1, 0.6, 125.0], "anal": True,
        "element": "Electro", "weapon": "Broadblade", "role": "DPS",
    },
    "Iuno (Main DPS)": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.85]),
        "er": [113.1, 0.8, 125.0], "anal": True,
        "element": "Electro", "weapon": "Sword", "role": "DPS",
    },
    "Iuno (Sub DPS)": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.85]),
        "er": [133.1, 1.0, 125.0], "anal": True,
        "element": "Electro", "weapon": "Sword", "role": "SubDPS",
    },
    "Jianxin (DPS/sub DPS)": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.25, 0.5*0.4, 0.0, 0.5*0.3]),
        "er": [138.1, 0.3, 150.0], "anal": True,
        "element": "Aero", "weapon": "Gauntlets", "role": "SubDPS",
    },
    "Jinhsi": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.75, 0.5*0.2]),
        "er": [118.1, 0.2, 150.0], "anal": True,
        "element": "Spectro", "weapon": "Broadblade", "role": "DPS",
    },
    "Jiyan": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.7, 0.5*0.15, 0.0]),
        "er": [128.1, 1.0, 125.0], "anal": True,
        "element": "Aero", "weapon": "Broadblade", "role": "DPS",
    },
    "Lingyang": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.35, 0.0, 0.5*0.3, 0.5*0.1]),
        "er": [128.1, 0.4, 125.0], "anal": True,
        "element": "Glacio", "weapon": "Gauntlets", "role": "DPS",
    },
    "Luuk Herssen": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.9, 0.0, 0.0, 0.0]),
        "er": [125.0, 0.3, 125.0], "anal": True,
        "element": "Electro", "weapon": "Gauntlets", "role": "DPS",
    },
    "Lumi": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.35, 0.0, 0.5*0.25, 0.5*0.3]),
        "er": [155.0, 1.0, 125.0], "anal": True,
        "element": "Glacio", "weapon": "Gauntlets", "role": "SubDPS",
    },
    "Lupa": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.15, 0.5*0.7]),
        "er": [123.1, 1.0, 125.0], "anal": True,
        "element": "Havoc", "weapon": "Sword", "role": "DPS",
    },
    "Lynae": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.6, 0.0, 0.0, 0.5*0.2]),
        "er": [128.1, 0.9, 125.0], "anal": True,
        "element": "Spectro", "weapon": "Pistols", "role": "DPS",
    },
    "Mornye": {
        "rv": _make_rv([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.5, 0.0, 0.0, 0.0, 0.0]),
        "er": [260.0, 1.0, 175.0], "anal": False,
        "element": "Fusion", "weapon": "Broadblade", "role": "Support",
    },
    "Mortefi": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.1, 0.0, 0.5*0.15, 0.5*0.7]),
        "er": [128.1, 1.0, 125.0], "anal": True,
        "element": "Fusion", "weapon": "Pistols", "role": "SubDPS",
    },
    "Phoebe (Main DPS)": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.15, 0.5*0.45, 0.0, 0.5*0.15]),
        "er": [0.0, 1.0, 125.0], "anal": True,
        "element": "Spectro", "weapon": "Rectifier", "role": "DPS",
    },
    "Phoebe (Sub DPS)": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.15, 0.5*0.45, 0.0, 0.5*0.15]),
        "er": [128.1, 1.0, 125.0], "anal": True,
        "element": "Spectro", "weapon": "Rectifier", "role": "SubDPS",
    },
    "Phrolova": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.5, 0.0]),
        "er": [0.0, 0.0, 0], "anal": True,
        "element": "Glacio", "weapon": "Pistols", "role": "DPS",
    },
    "Qiuyuan": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.65, 0.0, 0.0]),
        "er": [128.1, 1.0, 125.0], "anal": True,
        "element": "Aero", "weapon": "Broadblade", "role": "DPS",
    },
    "Roccia": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.55, 0.5*0.2, 0.0]),
        "er": [138.1, 1.0, 125.0], "anal": True,
        "element": "Havoc", "weapon": "Gauntlets", "role": "SubDPS",
    },
    "Aero Rover": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.65, 0.5*0.2]),
        "er": [138.1, 1.0, 150.0], "anal": True,
        "element": "Aero", "weapon": "Sword", "role": "DPS",
    },
    "Havoc Rover": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.3, 0.0, 0.5*0.2, 0.5*0.25]),
        "er": [128.1, 0.3, 125.0], "anal": True,
        "element": "Havoc", "weapon": "Sword", "role": "DPS",
    },
    "Spectro Rover": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.1, 0.5*0.3, 0.5*0.35]),
        "er": [128.1, 1.0, 125.0], "anal": True,
        "element": "Spectro", "weapon": "Sword", "role": "DPS",
    },
    "Sanhua": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.35, 0.5*0.25, 0.5*0.3]),
        "er": [115.0, 1.0, 100.0], "anal": True,
        "element": "Glacio", "weapon": "Sword", "role": "SubDPS",
    },
    "Sigrika": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        "er": [120.0, 0.9, 100.0], "anal": True,
        "element": "Fusion", "weapon": "Sword", "role": "DPS",
    },
    "Taoqi (sub DPS)": {
        "rv": _make_rv([1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.5, 0.25, 0.5*0.5, 0.0, 0.0, 0.5*0.5]),
        "er": [128.1, 1.0, 125.0], "anal": True,
        "element": "Havoc", "weapon": "Broadblade", "role": "SubDPS",
    },
    "Taoqi (sup)": {
        "rv": _make_rv([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.5, 0.0, 0.0, 0.0, 0.0]),
        "er": [175.0, 1.0, 125.0], "anal": False,
        "element": "Havoc", "weapon": "Broadblade", "role": "Support",
    },
    "The Shorekeeper (No Fallacy)": {
        "rv": _make_rv([0.0, 1.0, 0.0, 0.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.75]),
        "er": [250.0, 1.0, 175.0], "anal": False,
        "element": "Spectro", "weapon": "Rectifier", "role": "Healer",
    },
    "The Shorekeeper (With Fallacy)": {
        "rv": _make_rv([0.0, 1.0, 0.0, 0.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.75]),
        "er": [230.0, 1.0, 175.0], "anal": False,
        "element": "Spectro", "weapon": "Rectifier", "role": "Healer",
    },
    "Verina": {
        "rv": _make_rv([0.0, 0.0, 1.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        "er": [233.1, 1.0, 175.0], "anal": False,
        "element": "Spectro", "weapon": "Rectifier", "role": "Healer",
    },
    "Xiangli Yao": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.1, 0.0, 0.5*0.15, 0.5*0.6]),
        "er": [123.1, 0.8, 125.0], "anal": True,
        "element": "Electro", "weapon": "Gauntlets", "role": "DPS",
    },
    "Yangyang": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.3, 0.0, 0.5*0.15, 0.5*0.45]),
        "er": [118.1, 0.3, 100.0], "anal": True,
        "element": "Aero", "weapon": "Sword", "role": "SubDPS",
    },
    "Yinlin": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.1, 0.5*0.60, 0.5*0.2]),
        "er": [138.1, 0.2, 125.0], "anal": True,
        "element": "Electro", "weapon": "Rectifier", "role": "SubDPS",
    },
    "Youhu": {
        "rv": _make_rv([0.0, 0.0, 1.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]),
        "er": [165.0, 1.0, 100.0], "anal": False,
        "element": "Glacio", "weapon": "Rectifier", "role": "Support",
    },
    "Yuanwu": {
        "rv": _make_rv([1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.5, 0.25, 0.0, 0.0, 0.5*0.5, 0.5*0.4]),
        "er": [138.1, 1.0, 125.0], "anal": True,
        "element": "Electro", "weapon": "Gauntlets", "role": "Support",
    },
    "Zani": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5*0.6, 0.0, 0.5*0.2]),
        "er": [123.1, 0.9, 125.0], "anal": True,
        "element": "Havoc", "weapon": "Gauntlets", "role": "DPS",
    },
    "Zhezhi": {
        "rv": _make_rv([1.0, 1.0, 0.5, 0.25, 0.0, 0.0, 0.0, 0.0, 0.5*0.8, 0.0, 0.0, 0.0]),
        "er": [138.1, 1.0, 125.0], "anal": True,
        "element": "Spectro", "weapon": "Rectifier", "role": "SubDPS",
    },
}

# For DB seeding (Character table)
CHARACTER_LIST = [
    {"name": name, "element": d["element"], "weapon_type": d["weapon"], "role": d["role"]}
    for name, d in CHARACTER_DATA.items()
]

# Tier thresholds (score_percent → tier label) — from evc_engine.py analysis()
TIER_THRESHOLDS = [
    (99, "Godly"),
    (88, "Extreme"),
    (77, "High Investment"),
    (66, "Well Built"),
    (55, "Decent"),
    (44, "Base Level"),
    (0,  "Unbuilt"),
]

# Echo sets and elements for UI dropdowns
ECHO_SETS = [
    "Freezing Frost", "Molten Rift", "Void Thunder", "Sierra Gale",
    "Celestial Light", "Sun-sinking Eclipse", "Rejuvenating Glow",
    "Moonlit Clouds", "Lingering Tunes", "Frosty Resolve", "Midnight Veil",
    "Empyrean Anthem", "Tidebreaking Courage", "Eternal Radiance",
    "Gusts of Welkin", "Windprince Whisper", "Trailblazing Star",
]
ECHO_ELEMENTS = ["Glacio", "Fusion", "Electro", "Aero", "Spectro", "Havoc"]
ECHO_COSTS = [1, 3, 4]
MAIN_STAT_OPTIONS = {
    4: ["Crit Rate(%)", "Crit Damage(%)", "Atk(%)", "HP(%)", "Def(%)", "Heal(%)",
        "Glacio DMG%", "Fusion DMG%", "Electro DMG%", "Aero DMG%", "Spectro DMG%", "Havoc DMG%"],
    3: ["Atk(%)", "HP(%)", "Def(%)", "ER(%)",
        "Glacio DMG%", "Fusion DMG%", "Electro DMG%", "Aero DMG%", "Spectro DMG%", "Havoc DMG%"],
    1: ["Atk(%)", "HP(%)", "Def(%)"],
}
