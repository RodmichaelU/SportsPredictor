"""Build a one-row-per-game feature table with pre-game-only features for
the NBA. Four signal families, each computed strictly from games on earlier
calendar dates than the target game (teams never play twice in one day, so
"earlier date" is exactly "earlier game"):

  - Standings: season-to-date win % and average point margin.
  - Recent form: the same two stats over each team's last FORM_WINDOW games.
    Both are shrunk toward league average early on (see PRIOR_GAMES).
  - Head-to-head: average margin over the last H2H_WINDOW meetings between
    the two teams this season and last, from the home team's side.
  - Availability (injuries): the summed value of rotation players who are
    out. A player's value is their mean NBA efficiency (EFF = PTS + REB +
    AST + STL + BLK - missed FG - missed FT - TOV) over their last
    PLAYER_VALUE_WINDOW games this season and last, so losing a star counts
    for far more than losing a bench player.
  - Roster strength: the summed value of the top ROSTER_STRENGTH_TOP
    available rotation players. Elo needs weeks to absorb an offseason
    trade; this reflects one after the team's first game. A 2021-2025
    walk-forward found it improved log loss in 4 of 5 seasons (0.6098 ->
    0.6047) and accuracy 66.2% -> 67.3%, most in weeks 1-2 (59.9% ->
    61.9%). Travel/time zones/3-in-4 and per-100-possession net rating
    were tested the same way and added nothing over rest days and point
    differential.

Plus our own Elo (Phase 3, src/elo.py), rest days and the neutral-site flag.

How "who's out" is known (for both availability features), and the one
judgment call on leakage:
  - Upcoming games: ESPN's live injury report. Every player listed "Out"
    with any game history is counted. "Day-To-Day" players are not, since
    most of them end up playing.
  - Historical (training) games: there's no free archive of past injury
    reports, so absence is read from the box score. A player counts as
    missing if they're in the team's rotation (appeared for it this season,
    within its last ROTATION_WINDOW games, and haven't since played for
    another team) but have no row in that game's player log. That uses the
    target game's box score, but only for *who suited up*. The NBA publishes
    that before tip-off (official inactive lists, about 30 minutes before),
    so it's information available pre-game, the same thing the live injury
    report approximates. No stat from the target game is ever used.
    The live report is less certain than the inactive list (late
    scratches, game-time decisions), so expect this feature to be somewhat
    weaker live than in the backtest. That's a known gap, not a leak.

No closing line: there's no free source of historical NBA odds, so unlike
CFB/NFL there's no closing_spread feature. evaluate.py skips the market
comparison when that column is absent; live market comparison still comes
from Kalshi in the API.

Run: python -m src.sports.nba.features [--start YEAR] [--end YEAR]
"""

import argparse
import bisect

import pandas as pd

import config
from src import elo
from src.sports.nba import ingest

FORM_WINDOW = 10
H2H_WINDOW = 4
PLAYER_VALUE_WINDOW = 40
ROTATION_WINDOW = 20
REST_CAP = 4  # rest days beyond this make no practical difference; also the season-opener value
# Season and last-10 stats are shrunk toward league average (.500, 0 margin)
# as if each team had also played PRIOR_GAMES perfectly average games. A
# 3-game +10 point differential is mostly noise, but the model's weights are
# learned mostly from mid-season samples, so unshrunk early-season values
# made it overconfident in the first weeks. Tuned on 2015-2023 -> 2024
# (k=2..6 all helped, 4 chosen), keeping the 2025 test season untouched.
PRIOR_GAMES = 4
MISSING_NAMES_SHOWN = 4
ROSTER_STRENGTH_TOP = 8  # a typical playoff-style rotation

FORM_COLUMNS = ["games_played", "win_pct", "avg_margin", "last10_win_pct", "last10_margin"]
AVAILABILITY_COLUMNS = ["game_id", "team", "missing_eff", "missing_players", "roster_strength"]
TEAM_COLUMNS = FORM_COLUMNS + ["rest_days", "missing_eff", "missing_players", "roster_strength"]
DIFF_BASES = ["win_pct", "avg_margin", "last10_win_pct", "last10_margin", "missing_eff", "roster_strength", "rest_days"]
FEATURE_COLUMNS = ["elo_diff"] + [f"{b}_diff" for b in DIFF_BASES] + ["h2h_margin", "neutral_site"]
FEATURES_PATH = config.PROCESSED_DIR / "nba_features.parquet"

# Human-readable labels for FEATURE_COLUMNS, for the frontend's model-weights
# view. All "_diff" features are home minus away.
FEATURE_LABELS = {
    "elo_diff": "Elo rating gap",
    "win_pct_diff": "Season win % gap",
    "avg_margin_diff": "Season point differential gap",
    "last10_win_pct_diff": "Last-10 win % gap",
    "last10_margin_diff": "Last-10 point differential gap",
    "missing_eff_diff": "Injured/out player value gap",
    "roster_strength_diff": "Available roster strength gap",
    "rest_days_diff": "Rest days gap",
    "h2h_margin": "Recent head-to-head margin",
    "neutral_site": "Neutral site game",
}

# Bumped whenever FEATURE_COLUMNS changes, so frozen predictions record which
# model made them. v1 (the shared default) had no roster strength.
MODEL_VERSION = "v2-logistic-ridge-nba"

# Groups for the per-game explanation view (api/main.py's /explain). Season
# win % and point differential are strongly correlated (same for the last-10
# pair), so each pair is combined into one net number. See
# src/sports/cfb/features.py for why correlated families get grouped.
FEATURE_GROUPS = [
    {"key": "elo", "label": "Elo rating", "features": ["elo_diff"]},
    {"key": "standings", "label": "Season record", "features": ["win_pct_diff", "avg_margin_diff"]},
    {"key": "form", "label": "Recent form (last 10)", "features": ["last10_win_pct_diff", "last10_margin_diff"]},
    {"key": "injuries", "label": "Roster & injuries", "features": ["roster_strength_diff", "missing_eff_diff"]},
    {"key": "h2h", "label": "Head-to-head", "features": ["h2h_margin"]},
    {"key": "rest", "label": "Rest days", "features": ["rest_days_diff"]},
    {"key": "context", "label": "Game context", "features": ["neutral_site"]},
]


def _team_game_log(games: pd.DataFrame) -> pd.DataFrame:
    """One row per team per completed game, carrying running season stats
    *including* that game: the state a team brings into its next game."""
    sides = []
    for team_col, sign in (("home_team", 1), ("away_team", -1)):
        margin = sign * (games["home_points"] - games["away_points"])
        sides.append(
            pd.DataFrame(
                {
                    "season": games["season"],
                    "team": games[team_col],
                    "last_game_date": pd.to_datetime(games["game_date"]),
                    "won": (margin > 0).astype(int),
                    "margin": margin,
                }
            )
        )
    log = pd.concat(sides, ignore_index=True).sort_values(["season", "team", "last_game_date"])
    grouped = log.groupby(["season", "team"])
    log["games_played"] = grouped.cumcount() + 1
    log["win_pct"] = (grouped["won"].cumsum() + 0.5 * PRIOR_GAMES) / (log["games_played"] + PRIOR_GAMES)
    log["avg_margin"] = grouped["margin"].cumsum() / (log["games_played"] + PRIOR_GAMES)
    recent = log["games_played"].clip(upper=FORM_WINDOW) + PRIOR_GAMES
    rolling_sum = lambda s: s.rolling(FORM_WINDOW, min_periods=1).sum()  # noqa: E731
    log["last10_win_pct"] = (grouped["won"].transform(rolling_sum) + 0.5 * PRIOR_GAMES) / recent
    log["last10_margin"] = grouped["margin"].transform(rolling_sum) / recent
    return log


def _form_before(sides: pd.DataFrame, log: pd.DataFrame) -> pd.DataFrame:
    """sides: one row per (team, target game) with season, team, date.
    Attaches the team's running stats as of its latest game strictly before
    `date` in the same season (allow_exact_matches=False is the leakage
    guard), plus rest days since that game."""
    left = sides.reset_index().sort_values("date")
    right = log[["season", "team", "last_game_date"] + FORM_COLUMNS].sort_values("last_game_date")
    merged = pd.merge_asof(
        left, right, left_on="date", right_on="last_game_date",
        by=["season", "team"], allow_exact_matches=False,
    )
    merged = merged.set_index("index").sort_index()
    # No earlier game this season: the shrinkage prior is the whole estimate.
    merged["games_played"] = merged["games_played"].fillna(0).astype(int)
    merged[["win_pct", "last10_win_pct"]] = merged[["win_pct", "last10_win_pct"]].fillna(0.5)
    merged[["avg_margin", "last10_margin"]] = merged[["avg_margin", "last10_margin"]].fillna(0.0)
    rest = (merged["date"] - merged["last_game_date"]).dt.days - 1
    merged["rest_days"] = rest.clip(0, REST_CAP).fillna(REST_CAP)
    return merged


def _elo_timeline(games: pd.DataFrame) -> pd.DataFrame:
    """Each team's post-game Elo after every completed game, from the same
    elo.simulate() run (and tuned constants) as the Phase 3 baseline."""
    sim = elo.simulate(games, ingest.ELO_K, ingest.ELO_HOME_ADVANTAGE)
    dates = pd.to_datetime(games["game_date"]).to_numpy()
    k = ingest.ELO_K
    home_post = sim["home_pregame_elo"] + k * (sim["home_win"] - sim["home_win_prob"])
    away_post = sim["away_pregame_elo"] + k * ((1 - sim["home_win"]) - (1 - sim["home_win_prob"]))
    timeline = pd.concat(
        [
            pd.DataFrame({"team": sim["home_team"], "elo_season": sim["season"], "elo_date": dates, "elo": home_post}),
            pd.DataFrame({"team": sim["away_team"], "elo_season": sim["season"], "elo_date": dates, "elo": away_post}),
        ],
        ignore_index=True,
    )
    return timeline.sort_values("elo_date")


def _elo_before(sides: pd.DataFrame, timeline: pd.DataFrame) -> pd.Series:
    """Rating after the team's latest game strictly before `date`, regressed
    toward the mean if that game was last season -- exactly the pregame
    rating elo.simulate() would assign, but also defined for games that
    haven't been played yet."""
    left = sides.reset_index().sort_values("date")
    merged = pd.merge_asof(
        left, timeline, left_on="date", right_on="elo_date", by="team", allow_exact_matches=False
    ).set_index("index").sort_index()
    carried = elo.INITIAL_RATING + elo.SEASON_CARRYOVER * (merged["elo"] - elo.INITIAL_RATING)
    rating = merged["elo"].where(merged["elo_season"] == merged["season"], carried)
    return rating.fillna(elo.INITIAL_RATING)


def _head_to_head(targets: pd.DataFrame, games: pd.DataFrame) -> pd.DataFrame:
    """Average margin (home team's side) over the last H2H_WINDOW meetings
    on strictly earlier dates, this season or last."""
    meetings: dict[frozenset, list] = {}
    for g in games.sort_values("game_date").itertuples():
        meetings.setdefault(frozenset((g.home_team, g.away_team)), []).append(
            (g.game_date, g.season, g.home_team, g.home_points - g.away_points)
        )
    dates_by_pair = {pair: [m[0] for m in rows] for pair, rows in meetings.items()}

    margins, counts = [], []
    for t in targets.itertuples():
        pair = frozenset((t.home_team, t.away_team))
        rows = meetings.get(pair, [])
        prior = rows[: bisect.bisect_left(dates_by_pair.get(pair, []), t.game_date)]
        prior = [m for m in prior if m[1] >= t.season - 1][-H2H_WINDOW:]
        from_home_side = [m[3] if m[2] == t.home_team else -m[3] for m in prior]
        margins.append(sum(from_home_side) / len(from_home_side) if from_home_side else float("nan"))
        counts.append(len(from_home_side))
    return pd.DataFrame({"h2h_margin": margins, "h2h_games": counts}, index=targets.index)


def _player_log(season: int) -> pd.DataFrame:
    """Player game rows for `season` and the one before, each with the
    player's value as of that game (inclusive): mean EFF over their last
    PLAYER_VALUE_WINDOW appearances within those two seasons."""
    frames = []
    for year in (season - 1, season):
        if year < config.START_SEASON - 1:
            continue
        raw = ingest.ingest_player_games(year)
        if raw.empty:
            continue
        frames.append(raw.assign(season=year))
    if not frames:
        return pd.DataFrame(columns=["season", "player_id", "player", "team", "game_id", "game_date", "value"])
    p = pd.concat(frames, ignore_index=True)
    p["eff"] = (
        p["PTS"] + p["REB"] + p["AST"] + p["STL"] + p["BLK"]
        - (p["FGA"] - p["FGM"]) - (p["FTA"] - p["FTM"]) - p["TOV"]
    )
    p = p.rename(
        columns={"PLAYER_ID": "player_id", "PLAYER_NAME": "player", "TEAM_ABBREVIATION": "team",
                 "GAME_ID": "game_id", "GAME_DATE": "game_date"}
    ).sort_values(["game_date", "game_id"])
    p["value"] = p.groupby("player_id")["eff"].transform(
        lambda s: s.rolling(PLAYER_VALUE_WINDOW, min_periods=1).mean()
    ).clip(lower=0)
    return p[["season", "player_id", "player", "team", "game_id", "game_date", "value"]]


def _summarize_missing(missing: list[tuple[float, str]]) -> tuple[float, str]:
    missing = sorted(missing, reverse=True)
    names = ", ".join(name for _, name in missing[:MISSING_NAMES_SHOWN])
    if len(missing) > MISSING_NAMES_SHOWN:
        names += f" +{len(missing) - MISSING_NAMES_SHOWN} more"
    return sum(v for v, _ in missing), names


class _RotationState:
    """Who's in each team's rotation as of a point in the season: players
    who appeared for the team this season, within its last ROTATION_WINDOW
    games, and haven't since played for another team. Folded forward one
    date at a time, so it only ever reflects strictly earlier games."""

    def __init__(self):
        self.roster: dict[str, dict[int, int]] = {}  # team -> {player_id: team game number of last appearance}
        self.current_team: dict[int, str] = {}
        self.value: dict[int, float] = {}
        self.name: dict[int, str] = {}
        self.team_games: dict[str, int] = {}

    def rotation(self, team: str) -> list[int]:
        n = self.team_games.get(team, 0)
        return [p for p, last in self.roster.get(team, {}).items() if n - last < ROTATION_WINDOW]

    def roster_strength(self, team: str, available: list[int]) -> float:
        """Sum of the ROSTER_STRENGTH_TOP highest values among available
        rotation players. NaN before a team's first game of the season,
        when there's no rotation to speak of yet."""
        if self.team_games.get(team, 0) == 0:
            return float("nan")
        return sum(sorted((self.value[p] for p in available), reverse=True)[:ROSTER_STRENGTH_TOP])

    def fold(self, appearances) -> None:
        for (_, team), players in appearances:
            self.team_games[team] = self.team_games.get(team, 0) + 1
            for p in players.itertuples():
                previous = self.current_team.get(p.player_id)
                if previous is not None and previous != team:
                    self.roster[previous].pop(p.player_id, None)
                self.current_team[p.player_id] = team
                self.roster.setdefault(team, {})[p.player_id] = self.team_games[team]
                self.value[p.player_id] = p.value
                self.name[p.player_id] = p.player


def _season_days(player_log: pd.DataFrame, season: int):
    current = player_log[player_log["season"] == season]
    for _, day in current.groupby("game_date", sort=True):
        yield list(day.groupby(["game_id", "team"]))


def availability_from_box_scores(player_log: pd.DataFrame, season: int) -> pd.DataFrame:
    """Historical availability: walk the season one date at a time,
    computing every game's missing players and roster strength from the
    rotation state *before* that date, then folding that date's
    appearances in. One row per (game_id, team)."""
    state = _RotationState()
    rows = []
    for appearances in _season_days(player_log, season):
        for (game_id, team), players in appearances:
            played = set(players["player_id"])
            rotation = state.rotation(team)
            missing = [(state.value[p], state.name[p]) for p in rotation if p not in played]
            eff, names = _summarize_missing(missing)
            strength = state.roster_strength(team, [p for p in rotation if p in played])
            rows.append({"game_id": game_id, "team": team, "missing_eff": eff,
                         "missing_players": names, "roster_strength": strength})
        state.fold(appearances)
    return pd.DataFrame(rows, columns=AVAILABILITY_COLUMNS)


def availability_from_injury_report(
    targets: pd.DataFrame, player_log: pd.DataFrame, season: int, injuries: list[dict]
) -> pd.DataFrame:
    """Upcoming games. Missing: every "Out" player on the live report with
    any game history this season or last, valued at their most recent
    value. Roster strength: the current rotation minus those players."""
    state = _RotationState()
    for appearances in _season_days(player_log, season):
        state.fold(appearances)

    latest = player_log.drop_duplicates("player_id", keep="last")
    by_name = {ingest.normalize_player_name(r.player): (r.player_id, r.value, r.player) for r in latest.itertuples()}

    out_by_team: dict[str, list[tuple[int, float, str]]] = {}
    for injury in injuries:
        if injury["status"] != "Out":
            continue
        match = by_name.get(ingest.normalize_player_name(injury["player"]))
        if match:
            out_by_team.setdefault(injury["team"], []).append(match)

    rows = []
    for t in targets.itertuples():
        for team in (t.home_team, t.away_team):
            out = out_by_team.get(team, [])
            out_ids = {player_id for player_id, _, _ in out}
            eff, names = _summarize_missing([(v, n) for _, v, n in out])
            strength = state.roster_strength(team, [p for p in state.rotation(team) if p not in out_ids])
            rows.append({"game_id": t.game_id, "team": team, "missing_eff": eff,
                         "missing_players": names, "roster_strength": strength})
    return pd.DataFrame(rows, columns=AVAILABILITY_COLUMNS)


def _assemble(targets: pd.DataFrame, games: pd.DataFrame, availability: pd.DataFrame, completed: bool) -> pd.DataFrame:
    """targets: games to build features for (common schema + game_date).
    games: every completed game from config.START_SEASON on (Elo needs the
    full history; standings/form/h2h only ever look at this season and last)."""
    targets = targets.reset_index(drop=True)
    log = _team_game_log(games)
    timeline = _elo_timeline(games)

    result = targets.copy()
    for prefix in ("home", "away"):
        sides = pd.DataFrame(
            {"season": targets["season"], "team": targets[f"{prefix}_team"], "date": pd.to_datetime(targets["game_date"])}
        )
        form = _form_before(sides, log)
        result[f"{prefix}_pregame_elo"] = _elo_before(sides, timeline)
        side = targets[["game_id", f"{prefix}_team"]].merge(
            availability, left_on=["game_id", f"{prefix}_team"], right_on=["game_id", "team"], how="left"
        )
        for col in FORM_COLUMNS + ["rest_days"]:
            result[f"{prefix}_{col}"] = form[col].values
        result[f"{prefix}_missing_eff"] = side["missing_eff"].values
        result[f"{prefix}_missing_players"] = side["missing_players"].fillna("").values
        result[f"{prefix}_roster_strength"] = side["roster_strength"].values

    result = result.join(_head_to_head(targets, games))
    result["neutral_site"] = result["neutral_site"].astype(int)

    keep = ["game_id", "season", "week", "start_date", "home_team", "away_team", "neutral_site",
            "home_pregame_elo", "away_pregame_elo", "h2h_margin", "h2h_games"]
    keep += [f"{p}_{c}" for p in ("home", "away") for c in TEAM_COLUMNS]
    if completed:
        result["margin"] = result["home_points"] - result["away_points"]
        keep += ["home_points", "away_points", "home_win", "margin"]
    return result[keep]


def _build_season_features(season: int, games: pd.DataFrame) -> pd.DataFrame:
    targets = games[games["season"] == season]
    if targets.empty:
        return pd.DataFrame()
    availability = availability_from_box_scores(_player_log(season), season)
    return _assemble(targets, games[games["season"] <= season], availability, completed=True)


def build_season_features(season: int) -> pd.DataFrame:
    return _build_season_features(season, ingest.load_games(config.START_SEASON, season))


def build_upcoming_features(season: int, week: int) -> pd.DataFrame:
    """Every not-yet-played game in the given NBA week (Monday-Sunday, see
    ingest._week_numbers), with team form as of now and the live injury
    report. The report changes daily, which is why refresh.py only freezes
    games tipping off soon rather than a whole week up front."""
    sched = ingest.ingest_schedule(season)
    games = ingest.load_games(config.START_SEASON, season)
    played = set(games["game_id"])
    targets = sched[
        (sched["week"] == week) & ~sched["completed"] & ~sched["postponed"] & ~sched["game_id"].isin(played)
    ]
    if targets.empty:
        return pd.DataFrame()
    availability = availability_from_injury_report(targets, _player_log(season), season, ingest.fetch_injuries())
    return _assemble(targets, games, availability, completed=False)


def build_features(start_season: int, end_season: int) -> pd.DataFrame:
    games = ingest.load_games(config.START_SEASON, end_season)
    frames = [_build_season_features(year, games) for year in range(start_season, end_season + 1)]
    frames = [f for f in frames if not f.empty]
    return pd.concat(frames, ignore_index=True)


def add_model_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["elo_diff"] = df["home_pregame_elo"] - df["away_pregame_elo"]
    for base in DIFF_BASES:
        df[f"{base}_diff"] = df[f"home_{base}"] - df[f"away_{base}"]
    return df


def load_feature_table() -> pd.DataFrame:
    if not FEATURES_PATH.exists():
        # Fresh checkout (e.g. the GitHub Actions runner): build it once, the
        # same way `python -m src.sports.nba.features` does. Raw data is
        # downloaded and cached on first use, so later runs just read the file.
        build_features(config.START_SEASON, config.CURRENT_SEASON).to_parquet(FEATURES_PATH, index=False)
    return add_model_features(pd.read_parquet(FEATURES_PATH))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=config.START_SEASON)
    parser.add_argument("--end", type=int, default=config.CURRENT_SEASON)
    args = parser.parse_args()

    df = build_features(args.start, args.end)
    df.to_parquet(FEATURES_PATH, index=False)
    print(f"Wrote {len(df)} rows, {len(df.columns)} columns to {FEATURES_PATH}")


if __name__ == "__main__":
    main()
