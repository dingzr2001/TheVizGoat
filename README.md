# Shoot More, Win More?

An interactive, scroll-driven visualization story about the NBA's three-point revolution, made for CS 6730 by team
TheVizG.O.A.T. It asks one question: **does shooting more threes mean winning more games?**

## Run it

The site is static HTML + [D3 v7](https://d3js.org) with no build step. Browsers block `fetch()` from `file://`,
so serve the folder over HTTP:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Scroll to read. Each chapter opens with a title card and a headline number, then its chart stays pinned while the
text cards scroll past and move the chart through the story. **⚙ Explore this chart** opens the chart's controls
(they open on their own at each chapter's last card); **↺ Back to story view** puts the chart back where the story
left it. **Chapters** in the top bar jumps anywhere, and URLs like `#core/3` link straight to a chapter and card.

## Story outline

| # | Chapter | Chart | Message (Week 6) |
|---|---------|-------|------------------|
| 0 | Intro | 1,600 real shots from 2003-04 move to their 2024-25 positions; reader guesses the answer | Hook |
| 1 | The rise | League 3PA / 3PA share / 3P% since 1979-80, annotated with rule changes | M1, M8 |
| 2 | The court | Hex-binned shot charts for any two seasons (league or one team), share of attempts or points per shot | M2 |
| 3 | Eras | Radar + table of league-average stats for two eras, per game or per 100 possessions | M3 |
| 4 | Volume vs accuracy | Linked scatterplots: 3PA share vs win% and 3P% vs win%, any season, with r | M4 |
| 5 | Every season | The two correlations (plus TS%) for every season, with era averages | M4 |
| 6 | Team cases | Volume × accuracy quadrants colored by win%, team details and top shooters | M4, M6 |
| 7 | Players | Six-skill percentile radar, careers (300+ games since 1996-97) or single seasons | M5 |
| 8 | MVPs | MVP winners by position, sized by 3PA per game | M5 |
| 9 | Answer | Findings, the reader's guess, limitations, data & methods | — |

## Data

| Source | Used for | Coverage |
|--------|----------|----------|
| [NBA Stats (1947-present)](https://www.kaggle.com/datasets/sumitrodatta/nba-aba-baa-stats) (Kaggle, from Basketball-Reference) | team seasons, league averages, player totals, MVP awards | 1979-80 to 2025-26 (MVPs to 2024-25) |
| [DomSamangy/NBA_Shots_04_25](https://github.com/DomSamangy/NBA_Shots_04_25) (from NBA.com) | every regular-season shot with court coordinates | 2003-04 to 2024-25 |

The site only loads the preprocessed files in `data/` (about 8 MB in total; per-team shot files load only when a team is picked). To rebuild them from the raw data:

```bash
./scripts/fetch_data.sh          # downloads ~900 MB of raw CSVs into raw/ (git-ignored)
python3 scripts/build_data.py    # writes data/*.json and clean/*.csv (standard library only, ~35 s)
```

The same run also writes the cleaned, merged tables before aggregation to `clean/` as CSV; `clean/README.md`
lists the cleaning steps and columns.

## Code layout

```
index.html            page shell (top bar, title page, footer)
css/style.css         layout + color tokens (light = paper cream, dark = jersey navy)
img/                  illustrations for the title page and chapter title cards
js/main.js            scroll engine: data loading, chapter sections, scroll-triggered steps, URL hash, theme
js/lib.js             formatting, statistics (Pearson r, regression, percentiles), tooltip, controls
js/court.js           half-court drawing and hexagon geometry
js/slides/*.js        one module per chapter
scripts/              data download + preprocessing
data/                 generated JSON loaded by the site
```

### Adding or editing a chapter

Each file in `js/slides/` exports an object:

```js
export default {
  id: "core",                  // used in the URL hash
  nav: "Volume vs accuracy",   // label in the chapter bar
  kicker: "Message 4 · ...",
  title: "Do teams that shoot more threes win more?",
  lede: (data) => ({ stat: "47<small>seasons</small>", caption: "…" }),  // optional: big number on the title card
  // opener: false,            // optional: no title card (the intro uses the page's title instead)
  // layout: "page",           // optional: a plain page instead of a pinned chart (used by the conclusion)
  // art: { img: "img/cards.jpg", tone: "paper", align: "center",   // optional: full-screen illustrated title card;
  //        position: "center", positionSmall: "right bottom" },    // tone "paper" or "navy" sets the text colors;
  //                                                              // no tone (transparent art) follows the theme;
  //                                                              // align "left" | "center" | "narrow"
  steps: [ "<p>html…</p>", (data) => `<p>text built from ${data}</p>` ],   // one text card each
  notes: "Shown under 'About this data'",
  mount({ viz, controls, text, data, ctx }) {
    // build the chart into `viz`, controls into `controls` (add class "keep" to a .ctl that must stay
    // visible while the controls are folded away, e.g. a color legend)
    return {
      step(i) { /* put the chart into the story state for step i */ },
      apply(params) { /* optional: state passed by ctx.go(id, { params }) */ },
      redraw() { /* optional: re-render after a theme change */ },
    };
  },
};
```

Then add it to the `SLIDES` list in `js/main.js`. Use `ctx.go("players", { step, params })` to link between chapters
(`step: -1` = the last card); the reader gets a "↩ Back to …" button to return.

Step text that quotes numbers is computed from the data (see the functions in each `steps` array), so the story
stays correct if the data is rebuilt with a newer season.
