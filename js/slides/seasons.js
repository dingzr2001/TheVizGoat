// 05 · Is it just one season? The volume-vs-win and accuracy-vs-win correlations for every season since 1979-80.
import { svgIn, tooltip, tipHtml, fmt, seasonLabel, legend } from "../lib.js";
import { seasonCorr } from "./scatter.js";

const W = 720, H = 540;
const M = { top: 24, right: 80, bottom: 40, left: 56 };
const NOISE = 0.36;     // |r| a 30-team season can show by chance (two-sided p = 0.05)

const SERIES = [
  { key: "rate", label: "Volume (3PA share)", color: "var(--series-1)" },
  { key: "pct", label: "Accuracy (3P%)", color: "var(--series-2)" },
  { key: "ts", label: "Overall shooting (TS%)", color: "var(--series-3)" },
];

const ERAS = [[1980, 1989], [1990, 1999], [2000, 2009], [2010, 2019], [2020, 2026]];

const STORY = [
  { show: ["rate"], eras: false },
  { show: ["rate", "pct"], eras: false },
  { show: ["rate", "pct"], eras: true },
  { show: ["rate", "pct", "ts"], eras: true },
];

function allCorr(data) {
  const seasons = [...new Set(data.teams.filter((t) => t.x3pPct != null).map((t) => t.season))].sort();
  return seasons.map((s) => ({ season: s, ...seasonCorr(data, s) }));
}

export default {
  id: "seasons",
  nav: "Every season",
  kicker: "Message 4 · More evidence",
  title: "Was that just one season?",
  lede: (d) => ({
    stat: `${allCorr(d).length}<small>seasons</small>`,
    caption: "The same test, repeated for every season since the three-point line arrived.",
  }),
  steps: [
    (d) => {
      const c = allCorr(d);
      const weak = c.filter((s) => Math.abs(s.rate) < NOISE).length;
      return `<p>One season is a small sample. So we repeated the test for <strong>every season since 1979-80</strong>.
        Each point is that season's correlation between <span class="key">volume</span>
        and win%.</p>
        <p>The gray band is the range that ~30 teams could produce by chance. Volume lands inside it in
        <span class="key-num">${weak} of ${c.length}</span> seasons.</p>`;
    },
    (d) => {
      const c = allCorr(d);
      const wins = c.filter((s) => s.pct > s.rate).length;
      const recent = c.filter((s) => s.season >= 2010);
      const recentWins = recent.filter((s) => s.pct > s.rate).length;
      return `<p>Now <span class="key b">accuracy</span>. It beats volume in
        <span class="key-num">${wins} of ${c.length}</span> seasons, including
        ${recentWins === recent.length ? "every one" : `${recentWins} of ${recent.length}`} since 2009-10.</p>
        <p>Click any season to open it in the scatterplots.</p>`;
    },
    `<p>By era, the gap <strong>widened</strong> as the three became central. In the 1980s neither measure said much.
      In the 2020s volume went quiet, because nearly every team now shoots a lot, while accuracy stayed strongly tied to winning.</p>
      <p>When everyone shoots threes, taking more of them no longer sets a team apart. Making them still does.</p>`,
    `<p>One more line: <span class="key c">true shooting %</span>, a team's
      efficiency on <em>all</em> shots, including twos and free throws. It tracks winning even more closely.</p>
      <p>So the three-pointer matters <strong>through efficiency</strong>. Threes help when they are part of an
      offense that turns its possessions into points.</p>`,
  ],
  notes: `For each regular season, Pearson's r between team win% and (a) 3PA ÷ FGA, (b) 3P%, (c) true shooting %
    = PTS ÷ (2 × (FGA + 0.44 × FTA)), across all teams that season (22-30 teams). The gray band marks |r| < ${NOISE},
    roughly what chance alone produces for 30 teams at p = 0.05. Correlation describes association, not causation.`,

  mount({ viz, controls, data, ctx }) {
    const st = { ...STORY[0] };
    const corr = allCorr(data);
    legend(controls, SERIES.map((s) => ({ ...s, type: "line" })));

    viz.innerHTML = `<div class="split"><div class="chart"></div><div class="panel"></div></div>`;
    const panel = viz.querySelector(".panel");
    const svg = svgIn(viz.querySelector(".chart"), W, H);
    const x = d3.scaleLinear().domain([1979.5, 2026.5]).range([M.left, W - M.right]);
    const y = d3.scaleLinear().domain([-0.6, 1]).range([H - M.bottom, M.top]);

    svg.append("rect").attr("x", M.left).attr("width", W - M.left - M.right)
      .attr("y", y(NOISE)).attr("height", y(-NOISE) - y(NOISE)).attr("fill", "var(--surface-2)");
    svg.append("text").attr("class", "chart-sub").attr("x", W - M.right - 6).attr("y", y(-NOISE) - 6)
      .attr("text-anchor", "end").text("could be chance");
    svg.append("g").attr("class", "grid").attr("transform", `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(8).tickSize(-(W - M.left - M.right)).tickFormat(""));
    svg.append("line").attr("x1", M.left).attr("x2", W - M.right).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", "var(--axis)");
    svg.append("g").attr("class", "axis").attr("transform", `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(8).tickFormat(d3.format("+.1f")).tickSizeOuter(0));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - M.bottom})`)
      .call(d3.axisBottom(x).tickValues(d3.range(1980, 2027, 10)).tickFormat(seasonLabel).tickSizeOuter(0));
    svg.append("text").attr("class", "axis-title").attr("transform", "rotate(-90)")
      .attr("x", -(M.top + H - M.bottom) / 2).attr("y", 14).attr("text-anchor", "middle").text("Correlation with win % (r)");

    const eraG = svg.append("g");
    const lineG = svg.append("g");
    const line = (key) => d3.line().x((d) => x(d.season)).y((d) => y(d[key]));

    const paths = lineG.selectAll("g").data(SERIES).join("g");
    paths.append("path").attr("fill", "none").attr("stroke", (s) => s.color).attr("stroke-width", 2)
      .attr("d", (s) => line(s.key)(corr));
    // End labels at each line's recent level, pushed apart so they never overlap.
    const labelY = SERIES.map((s) => ({ key: s.key, y: y(d3.mean(corr.slice(-5), (d) => d[s.key])) })).sort((a, b) => a.y - b.y);
    labelY.forEach((l, i) => { if (i && l.y - labelY[i - 1].y < 16) l.y = labelY[i - 1].y + 16; });
    paths.append("text").attr("class", "label-strong").attr("x", W - M.right + 8)
      .attr("y", (s) => labelY.find((l) => l.key === s.key).y).attr("dy", "0.32em")
      .text((s) => s.label.split(" ")[0]);

    // Crosshair, season tooltip and click-through to the scatterplots.
    const hover = svg.append("g").style("pointer-events", "none").style("display", "none");
    hover.append("line").attr("y1", M.top).attr("y2", H - M.bottom).attr("stroke", "var(--axis)");
    const hoverDots = hover.selectAll("circle").data(SERIES).join("circle")
      .attr("r", 4.5).attr("fill", (s) => s.color).attr("stroke", "var(--surface)").attr("stroke-width", 2);
    svg.append("rect").attr("x", M.left).attr("y", M.top).attr("width", W - M.left - M.right).attr("height", H - M.top - M.bottom)
      .attr("fill", "transparent").style("cursor", "pointer")
      .on("pointermove", (event) => {
        const s = Math.round(x.invert(d3.pointer(event)[0]));
        const d = corr.find((c) => c.season === s);
        if (!d) return;
        const shown = SERIES.filter((sr) => st.show.includes(sr.key));
        hover.style("display", null).attr("transform", `translate(${x(s)},0)`);
        hoverDots.attr("cy", (sr) => y(d[sr.key])).style("display", (sr) => (st.show.includes(sr.key) ? null : "none"));
        tooltip.show(tipHtml(`${seasonLabel(s)} · ${d.n} teams`, shown.map((sr) => [sr.label, fmt.r(d[sr.key])]))
          + `<div class="muted" style="margin-top:4px">Click to open this season</div>`, event);
      })
      .on("pointerleave", () => { hover.style("display", "none"); tooltip.hide(); })
      .on("click", (event) => {
        const s = Math.round(x.invert(d3.pointer(event)[0]));
        tooltip.hide();
        ctx.go("core", { step: 3, params: { season: s } });
      });

    function render() {
      paths.transition().duration(500).style("opacity", (s) => (st.show.includes(s.key) ? 1 : 0));

      // Era means as short horizontal segments.
      const eraRows = ERAS.map(([a, b]) => {
        const rows = corr.filter((c) => c.season >= a && c.season <= b);
        return { a, b, rate: d3.mean(rows, (r) => r.rate), pct: d3.mean(rows, (r) => r.pct), ts: d3.mean(rows, (r) => r.ts) };
      });
      const segs = st.eras ? eraRows.flatMap((e) => SERIES.filter((s) => st.show.includes(s.key)).map((s) => ({ ...e, s }))) : [];
      eraG.selectAll("line").data(segs, (d) => `${d.a}${d.s.key}`).join("line")
        .attr("x1", (d) => x(d.a - 0.4)).attr("x2", (d) => x(d.b + 0.4))
        .attr("y1", (d) => y(d[d.s.key])).attr("y2", (d) => y(d[d.s.key]))
        .attr("stroke", (d) => d.s.color).attr("stroke-width", 6).attr("stroke-opacity", 0.28).attr("stroke-linecap", "round");

      const shown = SERIES.filter((s) => st.show.includes(s.key));
      panel.innerHTML = `
        <h4>Average r by era</h4>
        <table class="data-table">
          <thead><tr><th>Era</th>${shown.map((s) => `<th>${s.label.split(" ")[0]}</th>`).join("")}</tr></thead>
          <tbody>${eraRows.map((e) => `<tr><td>${e.a}–${String(e.b).slice(2)}</td>${shown.map((s) => `<td>${fmt.r(e[s.key])}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
        <p class="muted" style="margin-top:10px">Seasons are labelled by the year they end (1980 = 1979-80).
        Shaded bars on the chart show these era averages${st.eras ? "" : " (from step 3)"}.</p>`;
    }

    return {
      step(i) { Object.assign(st, STORY[i]); render(); },
      redraw() { render(); },
    };
  },
};
