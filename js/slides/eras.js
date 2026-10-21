// 03 · Era comparison: league-average team stats for two eras on a radar, with the raw numbers beside it.
import { svgIn, segmented, selectBox, tooltip, tipHtml, fmt, seasonLabel } from "../lib.js";

const ERAS = [
  [1980, 1989, "1980s"], [1990, 1999, "1990s"], [2000, 2009, "2000s"], [2010, 2019, "2010s"], [2020, 2026, "2020s"],
];

// per100: whether the stat is a count that should be divided by pace in "per 100 possessions" mode.
const METRICS = [
  { key: "pts", label: "Points", per100: true, f: fmt.dec1 },
  { key: "pace", label: "Pace", per100: false, f: fmt.dec1 },
  { key: "x3pa", label: "3-pt attempts", per100: true, f: fmt.dec1 },
  { key: "fta", label: "Free-throw att.", per100: true, f: fmt.dec1 },
  { key: "ast", label: "Assists", per100: true, f: fmt.dec1 },
  { key: "orb", label: "Off. rebounds", per100: true, f: fmt.dec1 },
  { key: "stl", label: "Steals", per100: true, f: fmt.dec1 },
  { key: "blk", label: "Blocks", per100: true, f: fmt.dec1 },
  { key: "tov", label: "Turnovers", per100: true, f: fmt.dec1 },
  { key: "ortg", label: "Off. rating", per100: false, f: fmt.dec1 },
];

const STORY = [
  { a: "2000s", b: "2020s", unit: "game" },
  { a: "2000s", b: "2020s", unit: "100" },
  { a: "1980s", b: "2020s", unit: "game" },
];

const W = 560, H = 500, R = 175;
const CX = W / 2, CY = H / 2 + 6;

export default {
  id: "eras",
  nav: "Eras",
  kicker: "Message 3 · Context",
  title: "What else changed about the game?",
  art: { img: "img/jerseys.jpg", tone: "navy", align: "center", position: "center", positionSmall: "left bottom" },
  lede: (d) => {
    const ortg = (a, b) => d3.mean(d.league.filter((l) => l.season >= a && l.season <= b), (l) => l.ortg);
    return {
      stat: `${fmt.dec1(ortg(2000, 2009))} <span class="arrow">→</span> ${fmt.dec1(ortg(2020, 2026))}`,
      caption: "points scored per 100 possessions, 2000s vs 2020s. More threes came with more efficient offenses.",
    };
  },
  steps: [
    `<p>Three-pointers didn't change alone. Here is the average team in the <span class="key">2000s</span>
      next to the <span class="key b">2020s</span>. Each axis runs from the lowest to the highest
      league average since 1979-80.</p>
      <p>Today's teams play <strong>faster</strong>, score <strong>more</strong>, and take more than twice as many threes,
      while grabbing fewer offensive rebounds and shooting fewer free throws.</p>`,
    `<p>Faster pace means more possessions, which inflates every per-game count. Switching to
      <strong>per 100 possessions</strong> removes that effect.</p>
      <p>Scoring is still clearly higher (about 106 → 114 points per 100 possessions). Offenses didn't just get
      busier. They got <strong>more efficient</strong>.</p>`,
    `<p>Now compare the <span class="key">1980s</span>. Pace and points look much like today,
      but the 1980s got there with about 3 threes a game, more free throws and more offensive rebounds.</p>
      <p>Same scoreboard, very different route. That's why the question isn't just
      <em>how many</em> threes a team takes, but <em>how well</em> those shots pay off.</p>`,
  ],
  notes: `League-average team statistics per season from Basketball-Reference (Kaggle: NBA Stats 1947-present),
    averaged across the seasons in each era. "Pace" = possessions per 48 minutes; "Off. rating" = points per 100
    possessions. Per-100 values are approximated as per-game value ÷ pace × 100. Each radar axis is scaled from the
    lowest to the highest season average since 1979-80 in the chosen unit, so shapes show relative position, not
    absolute size; read exact values in the table.`,

  mount({ viz, controls, data }) {
    const st = { ...STORY[0] };
    const eraOpts = ERAS.map((e) => [e[2], `${e[2]} (${seasonLabel(e[0])} – ${seasonLabel(e[1])})`]);
    const aCtl = selectBox(controls, "Era A", eraOpts, st.a, (v) => { st.a = v; render(); });
    const bCtl = selectBox(controls, "Era B", eraOpts, st.b, (v) => { st.b = v; render(); });
    const unitCtl = segmented(controls, "Per", [["game", "Game"], ["100", "100 possessions"]], st.unit, (v) => { st.unit = v; render(); });

    viz.innerHTML = `<div class="split"><div class="radar"></div><div class="panel"></div></div>`;
    const svg = svgIn(viz.querySelector(".radar"), W, H);
    const panel = viz.querySelector(".panel");
    const n = METRICS.length;
    const angle = (i) => (i / n) * 2 * Math.PI - Math.PI / 2;
    const r = d3.scaleLinear().domain([0, 1]).range([R * 0.12, R]);

    const value = (row, m) => (st.unit === "100" && m.per100 ? (row[m.key] / row.pace) * 100 : row[m.key]);
    const eraRows = (name) => {
      const [a, b] = ERAS.find((e) => e[2] === name);
      return data.league.filter((l) => l.season >= a && l.season <= b);
    };
    const eraMean = (name) => {
      const rows = eraRows(name);
      return Object.fromEntries(METRICS.map((m) => [m.key, d3.mean(rows, (row) => value(row, m))]));
    };

    // Grid rings and spokes.
    const grid = svg.append("g");
    [0.25, 0.5, 0.75, 1].forEach((t) => grid.append("circle").attr("cx", CX).attr("cy", CY).attr("r", r(t))
      .attr("fill", "none").attr("stroke", "var(--grid)"));
    METRICS.forEach((m, i) => {
      const a = angle(i);
      grid.append("line").attr("x1", CX).attr("y1", CY)
        .attr("x2", CX + Math.cos(a) * R).attr("y2", CY + Math.sin(a) * R).attr("stroke", "var(--grid)");
      const lx = CX + Math.cos(a) * (R + 22), ly = CY + Math.sin(a) * (R + 22);
      grid.append("text").attr("class", "label").attr("x", lx).attr("y", ly).attr("dy", "0.32em")
        .attr("text-anchor", Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end")
        .text(m.label);
    });
    const shapes = svg.append("g");

    function render() {
      aCtl.set(st.a); bCtl.set(st.b); unitCtl.set(st.unit);
      // Axis ranges from all seasons, in the current unit.
      const ext = Object.fromEntries(METRICS.map((m) => [m.key, d3.extent(data.league, (row) => value(row, m))]));
      const norm = (m, v) => (v - ext[m.key][0]) / (ext[m.key][1] - ext[m.key][0]);
      const eras = [
        { name: st.a, color: "var(--series-1)", vals: eraMean(st.a) },
        { name: st.b, color: "var(--series-2)", vals: eraMean(st.b) },
      ];
      const pts = (e) => METRICS.map((m, i) => {
        const rr = r(norm(m, e.vals[m.key]));
        return [CX + Math.cos(angle(i)) * rr, CY + Math.sin(angle(i)) * rr, m, e];
      });

      const g = shapes.selectAll("g.era").data(eras, (e, i) => i).join((enter) => {
        const eg = enter.append("g").attr("class", "era");
        eg.append("path").attr("stroke-width", 2).attr("fill-opacity", 0.12);
        return eg;
      });
      g.select("path").attr("stroke", (e) => e.color).attr("fill", (e) => e.color)
        .transition().duration(600).attr("d", (e) => `M${pts(e).map((p) => p.slice(0, 2).join(",")).join("L")}Z`);
      g.selectAll("circle").data((e) => pts(e)).join("circle")
        .attr("r", 4.5).attr("fill", (p) => p[3].color).attr("stroke", "var(--surface)").attr("stroke-width", 2)
        .on("pointerenter", (event, p) => tooltip.show(tipHtml(`${p[2].label}`, eras.map((e) => [e.name, p[2].f(e.vals[p[2].key])])), event))
        .on("pointermove", (e) => tooltip.move(e))
        .on("pointerleave", () => tooltip.hide())
        .transition().duration(600).attr("cx", (p) => p[0]).attr("cy", (p) => p[1]);

      // Raw values table (the exact numbers behind the shapes).
      const unitLabel = st.unit === "100" ? "per 100 possessions" : "per game";
      panel.innerHTML = `
        <h4>League average ${unitLabel}</h4>
        <div class="legend" style="margin-bottom:8px">
          <span><span class="sw" style="background:var(--series-1)"></span>${st.a}</span>
          <span><span class="sw" style="background:var(--series-2)"></span>${st.b}</span>
        </div>
        <table class="data-table">
          <thead><tr><th>Stat</th><th>${st.a}</th><th>${st.b}</th><th>Change</th></tr></thead>
          <tbody>${METRICS.map((m) => {
            const a = eras[0].vals[m.key], b = eras[1].vals[m.key];
            const ch = (b - a) / a;
            return `<tr><td>${m.label}</td><td>${m.f(a)}</td><td>${m.f(b)}</td><td>${ch >= 0 ? "+" : ""}${fmt.pct0(ch)}</td></tr>`;
          }).join("")}</tbody>
        </table>
        <p class="muted" style="margin-top:10px">Pace and offensive rating are already per-possession measures, so they don't change with the unit.</p>`;
    }

    return {
      step(i) { Object.assign(st, STORY[i]); render(); },
      redraw() { render(); },
    };
  },
};
