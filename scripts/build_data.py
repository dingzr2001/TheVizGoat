"""Build the compact JSON files the website loads from the raw CSVs in raw/.

Run scripts/fetch_data.sh first, then:  python3 scripts/build_data.py
Only the Python standard library is used, so no environment setup is needed.

Outputs (all under data/):
  league.json          league-wide averages per season (1980-2026) for the trend and era charts
  teams.json           one row per team-season (1980-2026) for the scatter / quadrant charts
  players.json         player seasons (1997-2026) as totals, for the player radar
  mvp.json             every NBA MVP with the position listed for that season
  shots/league.json    hex-binned shot attempts/makes + zone shares per season (2004-2025)
  shots/sample.json    random shot samples from 2004 and 2025 for the opening animation
  shots/teams/<id>.json  the same hex bins per franchise (loaded on demand)
"""
import csv
import json
import math
import random
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
KAGGLE = RAW / "kaggle"
SHOTS = RAW / "shots"
OUT = ROOT / "data"

FIRST_3PT_SEASON = 1980   # 1979-80, the NBA's first season with a three-point line
FIRST_PLAYER_SEASON = 1997  # 1996-97, the coverage window used in our player analysis
SHOT_SEASONS = range(2004, 2026)

HEX_RADIUS = 1.0  # feet; must match HEX_RADIUS in js/court.js
MAX_SHOT_Y = 38   # feet from the baseline; deeper shots are almost all end-of-quarter heaves

# The shot data uses NBA.com names, Basketball-Reference uses its own in a few cases.
NAME_ALIASES = {"LA Clippers": "Los Angeles Clippers"}


def read_csv(name):
    with open(KAGGLE / name, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def num(v):
    """Parse a CSV cell to float; 'NA' and blanks become None."""
    if v in ("", "NA", None):
        return None
    return float(v)


def rnd(v, digits=3):
    return None if v is None else round(v, digits)


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  wrote {path.relative_to(ROOT)} ({path.stat().st_size / 1024:.0f} KB)")


# ---------------------------------------------------------------- league + teams

def build_league_and_teams(nba_ids_by_name):
    summaries = read_csv("Team Summaries.csv")
    per_game = read_csv("Team Stats Per Game.csv")
    totals = read_csv("Team Totals.csv")
    player_totals = read_csv("Player Totals.csv")

    def keyed(rows):
        return {(int(r["season"]), r["team"]): r for r in rows
                if r["lg"] == "NBA" and int(r["season"]) >= FIRST_3PT_SEASON}

    summ, pg, tot = keyed(summaries), keyed(per_game), keyed(totals)

    # League averages: the "League Average" rows from both tables.
    league = []
    for season in sorted({s for s, _ in summ}):
        s = summ.get((season, "League Average"))
        p = pg.get((season, "League Average"))
        if not s or not p:
            continue
        fga, x3pa = num(p["fga_per_game"]), num(p["x3pa_per_game"])
        league.append({
            "season": season,
            "pts": num(p["pts_per_game"]), "fga": fga, "fg": num(p["fg_percent"]),
            "x3pa": x3pa, "x3p": num(p["x3p_per_game"]), "x3pPct": num(p["x3p_percent"]),
            "x3pRate": rnd(x3pa / fga), "fta": num(p["fta_per_game"]),
            "ast": num(p["ast_per_game"]), "trb": num(p["trb_per_game"]),
            "orb": num(p["orb_per_game"]), "stl": num(p["stl_per_game"]),
            "blk": num(p["blk_per_game"]), "tov": num(p["tov_per_game"]),
            "pf": num(p["pf_per_game"]),
            "pace": num(s["pace"]), "ortg": num(s["o_rtg"]), "ts": num(s["ts_percent"]),
            "efg": num(s["e_fg_percent"]),
        })

    # Each team's top three-point shooters, to show beside a selected team.
    shooters = defaultdict(list)
    for r in player_totals:
        if r["lg"] != "NBA" or int(r["season"]) < FIRST_3PT_SEASON or re.fullmatch(r"\dTM|TOT", r["team"]):
            continue
        made, att = num(r["x3p"]) or 0, num(r["x3pa"]) or 0
        if att > 0:
            shooters[(int(r["season"]), r["team"])].append([r["player"], r["player_id"], int(made), int(att)])

    teams = []
    for (season, name), s in sorted(summ.items()):
        if name == "League Average":
            continue
        p, t = pg.get((season, name)), tot.get((season, name))
        if not p or not t:
            continue
        w, l = int(s["w"]), int(s["l"])
        fga, x3pa = num(t["fga"]), num(t["x3pa"])
        top = sorted(shooters[(season, s["abbreviation"])], key=lambda x: -x[2])[:4]
        teams.append({
            "season": season, "team": name, "abbr": s["abbreviation"],
            "nbaId": nba_ids_by_name.get((season, name)) or nba_ids_by_name.get(name),
            "w": w, "l": l, "winPct": rnd(w / (w + l)), "playoffs": s["playoffs"] == "TRUE",
            "x3pRate": rnd(x3pa / fga), "x3pPct": rnd(num(t["x3p"]) / x3pa) if x3pa else None,
            "x3pa": num(p["x3pa_per_game"]), "x3p": num(p["x3p_per_game"]),
            "pts": num(p["pts_per_game"]), "ortg": num(s["o_rtg"]), "drtg": num(s["d_rtg"]),
            "nrtg": num(s["n_rtg"]), "pace": num(s["pace"]), "ts": num(s["ts_percent"]),
            "efg": num(s["e_fg_percent"]), "shooters": top,
        })
    return league, teams


# ---------------------------------------------------------------- players + MVPs

def season_games():
    """Games a team played in each season (82 normally, fewer in shortened seasons)."""
    games = defaultdict(int)
    for r in read_csv("Team Totals.csv"):
        if r["lg"] == "NBA" and r["team"] != "League Average":
            games[int(r["season"])] = max(games[int(r["season"])], int(num(r["g"]) or 0))
    return games


def build_players():
    rows = [r for r in read_csv("Player Totals.csv")
            if r["lg"] == "NBA" and int(r["season"]) >= FIRST_PLAYER_SEASON]

    # A traded player has one row per team plus a combined "2TM"/"3TM" (older: "TOT") row.
    by_key = defaultdict(list)
    for r in rows:
        by_key[(int(r["season"]), r["player_id"])].append(r)

    fields = ["g", "mp", "pts", "trb", "ast", "stl", "blk", "tov", "x3p", "x3pa", "fga", "fta"]
    players = []
    for (season, pid), group in by_key.items():
        combined = [r for r in group if re.fullmatch(r"\dTM|TOT", r["team"])]
        row = combined[0] if combined else group[0]
        teams = [r["team"] for r in group if r is not row] or [row["team"]]
        if int(row["g"]) < 10:
            continue
        rec = [season, pid, row["player"], (row["pos"] or "").split("-")[0], "/".join(teams), int(num(row["age"]) or 0)]
        rec += [int(num(row[f]) or 0) for f in fields]
        players.append(rec)
    players.sort(key=lambda r: (r[0], r[2]))
    return {
        "columns": ["season", "id", "name", "pos", "team", "age"] + fields,
        "seasonGames": {s: g for s, g in season_games().items() if s >= FIRST_PLAYER_SEASON},
        "rows": players,
    }


def build_mvps():
    per_game = defaultdict(list)
    for r in read_csv("Player Per Game.csv"):
        if r["lg"] == "NBA":
            per_game[(int(r["season"]), r["player_id"])].append(r)
    advanced = {(int(r["season"]), r["player_id"], r["team"]): r for r in read_csv("Advanced.csv") if r["lg"] == "NBA"}

    mvps = []
    for a in read_csv("Player Award Shares.csv"):
        if a["award"] != "nba mvp" or a["winner"] != "TRUE":
            continue
        season = int(a["season"])
        rows = per_game[(season, a["player_id"])]
        combined = [r for r in rows if re.fullmatch(r"\dTM|TOT", r["team"])]
        row = combined[0] if combined else rows[0]
        adv = advanced.get((season, a["player_id"], row["team"]), {})
        mvps.append({
            "season": season, "player": a["player"], "id": a["player_id"],
            "pos": row["pos"].split("-")[0], "team": row["team"],
            "pts": num(row["pts_per_game"]), "trb": num(row["trb_per_game"]),
            "ast": num(row["ast_per_game"]), "x3pa": num(row["x3pa_per_game"]),
            "ts": num(adv.get("ts_percent")), "share": num(a["share"]),
        })
    mvps.sort(key=lambda m: m["season"])
    return mvps


# ---------------------------------------------------------------- shots

DX = HEX_RADIUS * 2 * math.sin(math.pi / 3)
DY = HEX_RADIUS * 1.5


def hex_index(x, y):
    """Same point-to-hexagon assignment as d3-hexbin, returning integer (i, j)."""
    py = y / DY
    pj = round(py)
    px = x / DX - (pj & 1) / 2
    pi = round(px)
    py1 = py - pj
    if abs(py1) * 3 > 1:
        px1 = px - pi
        pi2 = pi + (-1 if px < pi else 1) / 2
        pj2 = pj + (-1 if py < pj else 1)
        px2, py2 = px - pi2, py - pj2
        if px1 * px1 + py1 * py1 > px2 * px2 + py2 * py2:
            pi = pi2 + (1 if pj & 1 else -1) / 2
            pj = pj2
    return int(round(pi)), int(pj)


ZONES = ["Rim", "Paint", "Mid-range", "Corner 3", "Above-break 3"]
ZONE_OF = {
    "Restricted Area": 0, "In The Paint (Non-RA)": 1, "Mid-Range": 2,
    "Left Corner 3": 3, "Right Corner 3": 3, "Above the Break 3": 4, "Backcourt": 4,
}


def empty_season():
    return {"bins": defaultdict(lambda: [0, 0, 0]), "zones": [[0, 0, 0] for _ in ZONES], "fga": 0, "fgm": 0, "pts": 0}


def pack_season(acc):
    # bins: [i, j, attempts, makes, points]; zones: [attempts, makes, points] in ZONES order
    bins = [[i, j, a, m, p] for (i, j), (a, m, p) in sorted(acc["bins"].items())]
    return {"fga": acc["fga"], "fgm": acc["fgm"], "pts": acc["pts"], "zones": acc["zones"], "bins": bins}


def build_shots():
    league = {}
    teams = defaultdict(dict)     # team_id -> season -> accumulator
    team_names = defaultdict(dict)  # team_id -> season -> name
    samples = {}
    rng = random.Random(6730)

    for season in SHOT_SEASONS:
        path = SHOTS / f"NBA_{season}_Shots.csv"
        lg = empty_season()
        season_rows = []
        with open(path, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                x, y = float(r["LOC_X"]), float(r["LOC_Y"])
                made = r["SHOT_MADE"] == "TRUE"
                pts = (3 if r["SHOT_TYPE"].startswith("3") else 2) if made else 0
                tid = r["TEAM_ID"]
                team_names[tid][season] = r["TEAM_NAME"]
                tm = teams[tid].get(season)
                if tm is None:
                    tm = teams[tid][season] = empty_season()
                zone = ZONE_OF[r["BASIC_ZONE"]]
                for acc in (lg, tm):
                    acc["fga"] += 1
                    acc["fgm"] += made
                    acc["pts"] += pts
                    z = acc["zones"][zone]
                    z[0] += 1
                    z[1] += made
                    z[2] += pts
                    if y <= MAX_SHOT_Y:
                        b = acc["bins"][hex_index(x, y)]
                        b[0] += 1
                        b[1] += made
                        b[2] += pts
                if season in (2004, 2025) and y <= MAX_SHOT_Y:
                    season_rows.append([round(x, 1), round(y, 1), int(made), zone])
        league[season] = pack_season(lg)
        if season_rows:
            samples[season] = rng.sample(season_rows, 1600)
        print(f"  shots {season}: {lg['fga']} attempts")

    write_json(OUT / "shots" / "league.json", {
        "hexRadius": HEX_RADIUS, "zones": ZONES, "seasons": league,
    })
    write_json(OUT / "shots" / "sample.json", samples)

    index = []
    for tid, seasons in teams.items():
        names = team_names[tid]
        write_json(OUT / "shots" / "teams" / f"{tid}.json", {
            "id": tid, "names": names, "seasons": {s: pack_season(a) for s, a in seasons.items()},
        })
        index.append({"id": tid, "name": names[max(names)], "names": names})
    index.sort(key=lambda t: t["name"])
    write_json(OUT / "shots" / "teams.json", index)
    return team_names


def main():
    print("Building shot bins...")
    team_names = build_shots()
    nba_ids_by_name = {}
    for tid, names in team_names.items():
        for season, name in names.items():
            nba_ids_by_name[(season, NAME_ALIASES.get(name, name))] = tid
            nba_ids_by_name[NAME_ALIASES.get(name, name)] = tid  # fallback for seasons after the shot data

    print("Building league, team, player and MVP tables...")
    league, teams = build_league_and_teams(nba_ids_by_name)
    missing = [(t["season"], t["team"]) for t in teams if t["season"] in SHOT_SEASONS and not t["nbaId"]]
    if missing:
        print("  WARNING: team-seasons without a shot-data match:", missing[:10])
    write_json(OUT / "league.json", league)
    write_json(OUT / "teams.json", teams)
    write_json(OUT / "players.json", build_players())
    write_json(OUT / "mvp.json", build_mvps())


if __name__ == "__main__":
    main()
