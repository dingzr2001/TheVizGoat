// 04 · The core test: in one season, does three-point volume or three-point accuracy go with winning?
// Two linked scatterplots share the win% axis; selecting a team highlights it in both.
import { svgIn, segmented, selectBox, seasonSlider, tooltip, tipHtml, fmt, seasonLabel, pearson, linreg } from "../lib.js";

const W = 900, H = 470;
const M = { top: 46, right: 18, bottom: 46, left: 52 };
const PANEL_GAP = 44;
const PW = (W - M.left - M.right - PANEL_GAP) / 2;
const LATEST = 2026;

const PANELS = [
  { key: "x3pRate", title: "Volume: share of shots from three", f: fmt.pct, tick: d3.format(".0%") },
  { key: "x3pPct", title: "Accuracy: three-point %", f: fmt.pct, tick: d3.format(".0%") },
];

export function seasonTeams(data, season) {
  return data.teams.filter((t) => t.season === season && t.x3pPct != null);
}

/** Per-season correlation of win% with each three-point measure. */
export function seasonCorr(data, season) {
  const rows = seasonTeams(data, season);
  const win = rows.map((t) => t.winPct);
  return {
    n: rows.length,
    rate: pearson(rows.map((t) => t.x3pRate), win),
    pct: pearson(rows.map((t) => t.x3pPct), win),
    ts: pearson(rows.map((t) => t.ts), win),
  };
}

function extremes(data, season) {
  const rows = seasonTeams(data, season);
  return {
    volume: d3.greatest(rows, (t) => t.x3pRate),
    accuracy: d3.greatest(rows, (t) => t.x3pPct),
  };
}

const STORY = [
  { season: LATEST, showB: false, trend: false, highlight: "none" },
  { season: LATEST, showB: true, trend: false, highlight: "none" },
  { season: LATEST, showB: true, trend: true, highlight: "none" },
  { season: LATEST, showB: true, trend: true, highlight: "extremes" },
];

const rec = (t) => `${t.w}-${t.l}`;

export default {
  id: "core",
  nav: "Volume vs accuracy",
  kicker: "Message 4 · The core question",
  title: "Do teams that shoot more threes win more?",
  lede: () => ({
    caption: `One season, thirty teams, and two ways to measure their three-point shooting:
      how <em>often</em> they shoot from three, and how <em>well</em>.`,
  }),
  steps: [
    `<p>Each dot is one team in the <strong>2025-26</strong> season. Left to right: how much of its offense came from
      three (3PA ÷ all shot attempts). Up and down: its winning percentage.</p>
      <p>If "shoot more threes" were the recipe, the dots would climb from left to right. Do they?</p>`,
    `<p>Now the same 30 teams, placed by how <strong>accurately</strong> they shot their threes.</p>
      <p>Hover over a team, or click one to follow it across both charts and through other seasons.</p>`,
    (d) => {
      const c = seasonCorr(d, LATEST);
      return `<p>A line of best fit and the correlation <em>r</em> summarize each cloud (r = 0 means no linear
        relationship, 1 a perfect one).</p>
        <p>Volume: <span class="key-num">r = ${fmt.r(c.rate)}</span>. Accuracy:
        <span class="key-num">r = ${fmt.r(c.pct)}</span>. In this season, how <em>well</em> teams shot their threes
        tracked winning far more closely than how <em>often</em> they shot them.</p>`;
    },
    (d) => {
      const e = extremes(d, LATEST);
      return `<p>Two examples. <strong>${e.volume.team}</strong> took the largest share of threes
        (${fmt.pct0(e.volume.x3pRate)}) and went <strong>${rec(e.volume)}</strong>.
        <strong>${e.accuracy.team}</strong> made them at the best rate (${fmt.pct(e.accuracy.x3pPct)}) and went
        <strong>${rec(e.accuracy)}</strong>.</p>
        <p>This is an association within one season, not proof of cause: good shooting teams may also be good at
        everything else. Use the slider to check other seasons, or press ▶ to play through them.</p>`;
    },
  ],
  notes: `Team-season totals from Basketball-Reference (Kaggle: NBA Stats 1947-present). Volume = 3PA ÷ FGA,
    accuracy = 3PM ÷ 3PA, win% = W ÷ (W + L), regular season only. r is Pearson's correlation across the teams in
    one season (about 30). With 30 teams, |r| below about 0.36 is within what random noise could produce.`,

  mount({ viz, controls, data }) {
    const st = { ...STORY[0], selected: null, axes: "fit" };
    const seasons = d3.extent(data.teams.filter((t) => t.x3pPct != null), (t) => t.season);

    const slider = seasonSlider(controls, seasons[0], seasons[1], st.season, (v) => { st.season = v; render(); });
    const teamCtl = selectBox(controls, "Highlight", [], "", (v) => { st.selected = v || null; render(); });
    const axesCtl = segmented(controls, "Axes", [["fit", "Fit this season"], ["fixed", "Same for all seasons"]], st.axes,
      (v) => { st.axes = v; render(); });

    const svg = svgIn(viz, W, H);
    const y = d3.scaleLinear().domain([0, 1]).range([H - M.bottom, M.top]);
    const allRows = data.teams.filter((t) => t.x3pPct != null);

    const panels = PANELS.map((p, k) => {
      const x0 = M.left + k * (PW + PANEL_GAP);
      const g = svg.append("g");
      const x = d3.scaleLinear().range([x0, x0 + PW]);
      g.append("g").attr("class", "grid").attr("transform", `translate(${x0},0)`)
        .call(d3.axisLeft(y).ticks(5).tickSize(-PW).tickFormat(""));
      g.append("line").attr("x1", x0).attr("x2", x0 + PW).attr("y1", y(0.5)).attr("y2", y(0.5))
        .attr("stroke", "var(--axis)");
      g.append("text").attr("class", "chart-sub").attr("x", x0 + PW - 4).attr("y", y(0.5) - 5).attr("text-anchor", "end").text(".500");
      g.append("g").attr("class", "axis").attr("transform", `translate(${x0},0)`)
        .call(d3.axisLeft(y).ticks(5).tickFormat((v) => fmt.winPct(v)).tickSizeOuter(0));
      const xAxis = g.append("g").attr("class", "axis").attr("transform", `translate(0,${H - M.bottom})`);
      g.append("text").attr("class", "chart-title").attr("x", x0).attr("y", M.top - 22).text(p.title);
      g.append("text").attr("class", "axis-title").attr("x", x0 + PW).attr("y", H - 8).attr("text-anchor", "end")
        .text(k === 0 ? "more threes →" : "more accurate →");
      const rLabel = g.append("text").attr("class", "label-strong").attr("x", x0 + PW).attr("y", M.top - 22).attr("text-anchor", "end");
      const trend = g.append("line").attr("stroke", "var(--ink-2)").attr("stroke-width", 2).attr("stroke-linecap", "round");
      const dots = g.append("g");
      const labels = g.append("g");
      return { ...p, g, x, x0, xAxis, rLabel, trend, dots, labels };
    });
    svg.append("text").attr("class", "axis-title").attr("transform", "rotate(-90)")
      .attr("x", -(M.top + H - M.bottom) / 2).attr("y", 14).attr("text-anchor", "middle").text("Win %");

    function render() {
      slider.set(st.season); axesCtl.set(st.axes);
      const rows = seasonTeams(data, st.season);
      teamCtl.setOptions([["", "None"], ...rows.map((t) => [t.team, t.team]).sort((a, b) => a[1].localeCompare(b[1]))]);
      teamCtl.set(rows.some((t) => t.team === st.selected) ? st.selected : "");

      let marked = [];
      if (st.highlight === "extremes") {
        const e = extremes(data, st.season);
        marked = [e.volume.team, e.accuracy.team];
      }
      if (st.selected) marked = [...new Set([st.selected, ...marked])];
      const win = rows.map((t) => t.winPct);

      panels.forEach((p, k) => {
        const visible = k === 0 || st.showB;
        p.g.transition().duration(400).style("opacity", visible ? 1 : 0.1);
        const domainRows = st.axes === "fixed" ? allRows.filter((t) => t.season >= 1980) : rows;
        const ext = d3.extent(domainRows, (t) => t[p.key]);
        const pad = (ext[1] - ext[0]) * 0.06;
        p.x.domain([Math.max(0, ext[0] - pad), ext[1] + pad]);
        p.xAxis.transition().duration(500).call(d3.axisBottom(p.x).ticks(6).tickFormat(p.tick).tickSizeOuter(0));

        const xs = rows.map((t) => t[p.key]);
        const r = pearson(xs, win);
        const fit = linreg(xs, win);
        const [lo, hi] = d3.extent(xs);
        p.trend.transition().duration(500)
          .attr("x1", p.x(lo)).attr("x2", p.x(hi))
          .attr("y1", y(fit.intercept + fit.slope * lo)).attr("y2", y(fit.intercept + fit.slope * hi))
          .style("opacity", st.trend ? 1 : 0);
        p.rLabel.text(st.trend ? `r = ${fmt.r(r)}` : "");

        p.dots.selectAll("circle.dot").data(rows, (t) => t.team).join(
          (enter) => enter.append("circle").attr("class", "dot").attr("r", 0)
            .attr("cx", (t) => p.x(t[p.key])).attr("cy", (t) => y(t.winPct)),
        )
          .attr("stroke", "var(--surface)").attr("stroke-width", 2)
          .style("cursor", "pointer")
          .on("pointerenter", (event, t) => tooltip.show(tipHtml(`${t.team} · ${seasonLabel(t.season)}`, [
            ["Record", rec(t)],
            ["Share of shots from three", fmt.pct(t.x3pRate)],
            ["3P%", fmt.pct(t.x3pPct)],
            ["3PA per game", fmt.dec1(t.x3pa)],
            ["Made playoffs", t.playoffs ? "Yes" : "No"],
          ]), event))
          .on("pointermove", (e) => tooltip.move(e))
          .on("pointerleave", () => tooltip.hide())
          .on("click", (event, t) => { st.selected = st.selected === t.team ? null : t.team; render(); })
          // Set outside the transition: d3 can't interpolate between two var() colors.
          .attr("fill", (t) => (marked.includes(t.team) ? "var(--series-2)" : "var(--series-1)"))
          .transition().duration(600)
          .attr("cx", (t) => p.x(t[p.key])).attr("cy", (t) => y(t.winPct))
          .attr("r", (t) => (marked.includes(t.team) ? 8 : 6))
          .attr("fill-opacity", (t) => (marked.length && !marked.includes(t.team) ? 0.45 : 0.85));
        p.dots.selectAll("circle.dot").filter((t) => marked.includes(t.team)).raise();

        p.labels.selectAll("text").data(rows.filter((t) => marked.includes(t.team)), (t) => t.team).join("text")
          .attr("class", "label-strong")
          .attr("text-anchor", (t) => (p.x(t[p.key]) > p.x0 + PW * 0.7 ? "end" : "start"))
          .attr("dx", (t) => (p.x(t[p.key]) > p.x0 + PW * 0.7 ? -12 : 12))
          .attr("dy", "0.32em")
          .text((t) => t.abbr)
          .transition().duration(600)
          .attr("x", (t) => p.x(t[p.key])).attr("y", (t) => y(t.winPct));
      });
    }

    return {
      step(i) {
        slider.stop();
        Object.assign(st, STORY[i], { selected: null, axes: "fit" });
        render();
      },
      apply(params) {
        Object.assign(st, { showB: true, trend: true, highlight: "none" }, params);
        render();
      },
      redraw() { render(); },
    };
  },
};
