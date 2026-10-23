# Cleaned data

The cleaned and merged tables, before any aggregation for the charts. They are written by
`scripts/build_data.py` in the same run as `data/*.json` (see the main README for how to rebuild).
`clean/shots/` (~560 MB) is git-ignored; the other files are committed.

| File | Rows | One row per | Source |
|------|------|-------------|--------|
| `league.csv` | 47 | season, 1979-80 to 2025-26 | Kaggle `Team Summaries` + `Team Stats Per Game` ("League Average" rows) |
| `teams.csv` | 1,314 | team-season, 1979-80 to 2025-26 | Kaggle `Team Summaries` + `Team Stats Per Game` + `Team Totals`, linked to NBA.com team ids |
| `players.csv` | 13,166 | player-season (10+ games), 1996-97 to 2025-26 | Kaggle `Player Totals` |
| `mvp.csv` | 70 | MVP winner, 1955-56 to 2024-25 | Kaggle `Player Award Shares` + `Player Per Game` + `Advanced` |
| `shots/shots_<year>.csv` | 4,450,587 total | regular-season field-goal attempt, 2003-04 to 2024-25 | DomSamangy/NBA_Shots_04_25 |

Seasons are named by the year they end in (`2025` = 2024-25). Missing values are empty cells.

## Cleaning steps

- **NBA only.** ABA and BAA rows are dropped from every Kaggle table.
- **Time window.** Team and league tables start in 1979-80, the first season with a three-point line; player
  seasons start in 1996-97.
- **Missing values.** `NA` and blank cells become empty (no imputation).
- **Traded players.** Basketball-Reference lists a traded player once per team plus a combined `2TM`/`3TM`
  (older: `TOT`) row. `players.csv` and `mvp.csv` keep only the combined row; `team` lists the teams
  (e.g. `PHO/DAL`).
- **Small samples.** Player seasons with fewer than 10 games are dropped.
- **Duplicate shots.** 202 exact duplicate rows in the shot files (about 10 per season) are dropped.
- **Deep heaves.** Shots more than 38 ft from the baseline (mostly end-of-quarter heaves) have `in_chart = 0`:
  they count in totals and zone shares but are left out of the hexagon shot charts. 13,978 shots (0.3%).
- **Zones.** NBA.com's `basic_zone` values are grouped into five zones: Rim (Restricted Area), Paint
  (In The Paint Non-RA), Mid-range, Corner 3 (left + right), Above-break 3 (incl. Backcourt).

## Merging the two sources

Basketball-Reference identifies teams by name; NBA.com uses numeric team ids. `teams.csv` gets an `nbaId` by
matching season + team name against the shot data, with one alias (`LA Clippers` = `Los Angeles Clippers`);
the `team` column in the shot files uses the Basketball-Reference name. Every team-season from 2003-04 on is
matched. The 35 earlier rows without an `nbaId` are franchises under former names (Washington Bullets,
Vancouver Grizzlies, Kansas City Kings, San Diego Clippers), which have no shot data anyway.

## Columns

**league.csv**, per game unless noted: `pts`, `fga`, `fg` (FG%), `x3pa`, `x3p`, `x3pPct` (3P%),
`x3pRate` (3PA / FGA), `fta`, `ast`, `trb`, `orb`, `stl`, `blk`, `tov`, `pf`, `pace` (possessions per 48 min),
`ortg` (points per 100 possessions), `ts` (true shooting %), `efg` (effective FG%).

**teams.csv**: `team`, `abbr`, `nbaId`, `w`, `l`, `winPct`, `playoffs`, `x3pRate` (3PA / FGA from season
totals), `x3pPct` (3P% from season totals), `x3pa` and `x3p` and `pts` per game, `ortg`, `drtg`, `nrtg`
(offensive, defensive and net rating per 100 possessions), `pace`, `ts`, `efg`.

**players.csv**: `id` (Basketball-Reference id), `name`, `pos` (first listed position), `team`, `age`, then
season totals `g`, `mp`, `pts`, `trb`, `ast`, `stl`, `blk`, `tov`, `x3p`, `x3pa`, `fga`, `fta`.

**mvp.csv**: `player`, `id`, `pos` and `team` that season, per-game `pts`, `trb`, `ast`, `x3pa` (empty before
1979-80), `ts`, `share` (share of the maximum MVP vote points).

**shots/shots_\<year\>.csv**: `game_id`, `game_date` (MM-DD-YYYY), `team_id` (NBA.com), `team`,
`player_id` (NBA.com), `player`, `quarter`, `mins_left`, `secs_left` (clock in the quarter), `loc_x`, `loc_y`
(feet; `loc_y` is distance from the baseline, hoop at (0, 5.25)), `shot_distance` (feet), `shot_type` (`2PT`/`3PT`), `made` (0/1),
`points` (0, 2 or 3; and-ones and free throws not included), `basic_zone` (NBA.com), `zone` (five groups above),
`in_chart` (0/1).
