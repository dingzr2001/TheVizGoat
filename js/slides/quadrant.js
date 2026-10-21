// 06 · Volume x accuracy quadrants: each team placed by how many threes it takes and how well it makes them,
// colored by win%. Clicking a team opens its details and links to its shot chart and its shooters.
import { svgIn, seasonSlider, tooltip, tipHtml, fmt, seasonLabel, ordinalBlue } from "../lib.js";
import { seasonTeams } from "./scatter.js";

const W = 620, H = 480;
const M = { top: 20, right: 20, bottom: 46, left: 58 };
const LATEST = 2026;

const QUADS = [
  { id: "hh", label: "Many threes, made well", vol: 1, acc: 1 },
  { id: "lh", label: "Few threes, made well", vol: 0, acc: 1 },
  { id: "hl", label: "Many threes, missed often", vol: 1, acc: 0 },
  { id: "ll", label: "Few threes, missed often", vol: 0, acc: 0 },
];

/** Classify each team against its own season's average volume and accuracy. */
function classify(rows) {
  const mv = d3.mean(rows, (t) => t.x3pRate), ma = d3.mean(rows, (t) => t.x3pPct);
  return {
    mv, ma,
    quad: (t) => QUADS.find((q) => q.vol === +(t.x3pRate >= mv) && q.acc === +(t.x3pPct >= ma)),
  };
}

function quadSummary(data) {
  const sums = new Map(QUADS.map((q) => [q.id, []]));
  d3.groups(data.teams.filter((t) => t.x3pPct != null), (t) => t.season).forEach(([, rows]) => {
    const c = classify(rows);
    rows.forEach((t) => sums.get(c.quad(t).id).push(t.winPct));
  });
  return QUADS.map((q) => ({ ...q, win: d3.mean(sums.get(q.id)), n: sums.get(q.id).length }));
}

function strugglingShooter(data, season) {
  const rows = seasonTeams(data, season);
  const c = classify(rows);
  return d3.least(rows.filter((t) => c.quad(t).id === "hl"), (t) => t.winPct);
}

const STORY = [
  { season: LATEST, selected: null, summary: false },
  { season: LATEST, selected: null, summary: true },
  { season: 2016, selected: "Golden State Warriors", summary: true },
  { season: LATEST, selected: "@struggling", summary: true },
];

export default {
  id: "quadrant",
  nav: "Team cases",
  kicker: "Message 4 · Team cases",
  title: "Volume and accuracy together",
  lede: (d) => ({
    stat: `${fmt.int(d.teams.filter((t) => t.x3pPct != null).length)}<small>team-seasons</small>`,
    caption: "sorted into four groups by how often, and how well, they shot from three.",
  }),
  steps: [
    `<p>Put both measures on one chart: <strong>volume</strong> left to right, <strong>accuracy</strong> bottom to
      top. The cross marks this season's league averages, splitting teams into four groups. Color shows win%
      (scale above the chart).</p>
      <p>The winningest teams tend to sit <strong>higher up</strong>, at any volume.</p>`,
    (d) => {
      const s = quadSummary(d);
      const get = (id) => s.find((q) => q.id === id);
      return `<p>Across all ${d3.sum(s, (q) => q.n).toLocaleString()} team-seasons since 1979-80, the average win% in each group:</p>
        <p>Many &amp; made well: <span class="key-num">${fmt.winPct(get("hh").win)}</span><br>
        Few &amp; made well: <span class="key-num">${fmt.winPct(get("lh").win)}</span><br>
        Many &amp; missed often: <span class="key-num">${fmt.winPct(get("hl").win)}</span><br>
        Few &amp; missed often: <span class="key-num">${fmt.winPct(get("ll").win)}</span></p>
        <p>Teams that shot well won more at either volume. High volume with poor accuracy left teams below .500 on average.</p>`;
    },
    `<p>The best-known case: the <strong>2015-16 Golden State Warriors</strong>, 73-9. They were high on <em>both</em> axes,
      led by Stephen Curry's record 402 threes.</p>
      <p>Open their shot chart or compare their shooters using the links in the panel.</p>`,
    (d) => {
      const t = strugglingShooter(d, LATEST);
      return t
        ? `<p>The other side: in 2025-26 the <strong>${t.team}</strong> took threes at an above-average rate but made a
          below-average ${fmt.pct(t.x3pPct)}, and finished <strong>${t.w}-${t.l}</strong>.</p>
          <p>Click any dot to see that team's season and its top three-point shooters. Then we'll go from teams to players.</p>`
        : `<p>Click any dot to see that team's season and its top three-point shooters.</p>`;
    },
  ],
  notes: `Team-season totals from Basketball-Reference (Kaggle: NBA Stats 1947-present). Quadrants are drawn at each
    season's average team 3PA share and 3P%, so every season is split on its own terms. Group averages pool all
    team-seasons from 1979-80 to 2025-26. Top shooters are the team's four players with the most made threes for that team.`,

  mount({ viz, controls, data, ctx }) {
    const st = { ...STORY[0] };
    const slider = seasonSlider(controls, 1980, LATEST, st.season, (v) => { st.season = v; render(); });
    // Win% color legend lives in the control row so it never covers a dot.
    const legendEl = document.createElement("span");
    legendEl.className = "ctl keep";
    legendEl.innerHTML = `Win % <span class="muted">.200</span><span data-ramp style="display:inline-block;width:110px;height:8px;border-radius:2px"></span><span class="muted">.800</span>`;
    controls.appendChild(legendEl);
    const summary = quadSummary(data);

    viz.innerHTML = `<div class="split"><div class="chart"></div><div class="panel"></div></div>`;
    const panel = viz.querySelector(".panel");
    const svg = svgIn(viz.querySelector(".chart"), W, H);
    const x = d3.scaleLinear().range([M.left, W - M.right]);
    const y = d3.scaleLinear().range([H - M.bottom, M.top]);
    const xAxis = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - M.bottom})`);
    const yAxis = svg.append("g").attr("class", "axis").attr("transform", `translate(${M.left},0)`);
    svg.append("text").attr("class", "axis-title").attr("x", W - M.right).attr("y", H - 8).attr("text-anchor", "end")
      .text("Share of shots from three →");
    svg.append("text").attr("class", "axis-title").attr("transform", "rotate(-90)")
      .attr("x", -M.top).attr("y", 14).attr("text-anchor", "end").text("3P% →");
    const cross = svg.append("g");
    const vLine = cross.append("line").attr("stroke", "var(--axis)").attr("stroke-width", 1.5);
    const hLine = cross.append("line").attr("stroke", "var(--axis)").attr("stroke-width", 1.5);
    const quadLabels = svg.append("g").selectAll("text").data(QUADS).join("text").attr("class", "chart-sub halo")
      .attr("text-anchor", (q) => (q.vol ? "end" : "start")).text((q) => q.label);
    const dots = svg.append("g");
    const labels = svg.append("g");


    function teamPanel(t, c) {
      const q = c.quad(t);
      const shooters = t.shooters.map(([name, id, made, att]) => `
        <tr><td><a href="#" data-player="${id}" data-season="${t.season}">${name}</a></td>
        <td>${made}</td><td>${att}</td><td>${fmt.pct(made / att)}</td></tr>`).join("");
      const hasShots = t.nbaId && t.season >= 2004 && t.season <= 2025;
      return `
        <h4>${t.team}</h4>
        <div class="muted">${seasonLabel(t.season)} · ${t.w}-${t.l} (${fmt.winPct(t.winPct)})${t.playoffs ? " · playoffs" : ""}</div>
        <table class="data-table" style="margin-top:8px">
          <tr><td>3PA per game</td><td>${fmt.dec1(t.x3pa)}</td></tr>
          <tr><td>Share of shots from three</td><td>${fmt.pct(t.x3pRate)} <span class="muted">(avg ${fmt.pct(c.mv)})</span></td></tr>
          <tr><td>3P%</td><td>${fmt.pct(t.x3pPct)} <span class="muted">(avg ${fmt.pct(c.ma)})</span></td></tr>
          <tr><td>Group</td><td>${q.label}</td></tr>
        </table>
        <h4 style="margin-top:12px">Top three-point shooters</h4>
        <table class="data-table"><thead><tr><th>Player</th><th>3PM</th><th>3PA</th><th>3P%</th></tr></thead><tbody>${shooters}</tbody></table>
        ${t.shooters.length ? `<button class="link-btn" data-compare>Compare top two shooters →</button>` : ""}
        ${hasShots ? `<button class="link-btn" data-shots>See their shot chart →</button>` : ""}`;
    }

    function summaryPanel() {
      const max = 0.65;
      return `<h4>Average win% by group, 1979-80 to 2025-26</h4>
        ${summary.map((q) => `
          <div style="margin:8px 0 2px;font-size:12px" class="muted">${q.label}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="height:12px;border-radius:0 4px 4px 0;background:var(--series-1);width:${(q.win / max) * 75}%"></div>
            <span style="font-variant-numeric:tabular-nums">${fmt.winPct(q.win)}</span>
          </div>`).join("")}
        <p class="muted" style="margin-top:10px">${d3.sum(summary, (q) => q.n).toLocaleString()} team-seasons, each split by its own season's averages.</p>`;
    }

    function render() {
      slider.set(st.season);
      const rows = seasonTeams(data, st.season);
      const c = classify(rows);
      if (st.selected === "@struggling") st.selected = strugglingShooter(data, st.season)?.team ?? null;
      const sel = rows.find((t) => t.team === st.selected);

      const pad = (e) => [e[0] - (e[1] - e[0]) * 0.08, e[1] + (e[1] - e[0]) * 0.08];
      x.domain(pad(d3.extent(rows, (t) => t.x3pRate)));
      y.domain(pad(d3.extent(rows, (t) => t.x3pPct)));
      xAxis.transition().duration(500).call(d3.axisBottom(x).ticks(6).tickFormat(d3.format(".0%")).tickSizeOuter(0));
      yAxis.transition().duration(500).call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(".0%")).tickSizeOuter(0));
      vLine.transition().duration(500).attr("x1", x(c.mv)).attr("x2", x(c.mv)).attr("y1", M.top).attr("y2", H - M.bottom);
      hLine.transition().duration(500).attr("x1", M.left).attr("x2", W - M.right).attr("y1", y(c.ma)).attr("y2", y(c.ma));
      d3.select(quadLabels.node().parentNode).raise();   // keep corner labels above the dots
      quadLabels
        .attr("x", (q) => (q.vol ? W - M.right - 4 : M.left + 6))
        .attr("y", (q) => (q.acc ? M.top + 12 : H - M.bottom - 8));

      const color = d3.scaleSequential(ordinalBlue()).domain([0.2, 0.8]).clamp(true);
      legendEl.querySelector("[data-ramp]").style.background =
        `linear-gradient(to right, ${d3.range(0, 1.01, 0.25).map((t) => color(0.2 + t * 0.6)).join(",")})`;

      dots.selectAll("circle").data(rows, (t) => t.team).join(
        (enter) => enter.append("circle").attr("r", 0).attr("cx", (t) => x(t.x3pRate)).attr("cy", (t) => y(t.x3pPct)),
      )
        .attr("stroke", (t) => (t === sel ? "var(--series-2)" : "var(--surface)"))
        .attr("stroke-width", (t) => (t === sel ? 3 : 2))
        .style("cursor", "pointer")
        .on("pointerenter", (event, t) => tooltip.show(tipHtml(`${t.team} · ${seasonLabel(t.season)}`, [
          ["Record", `${t.w}-${t.l}`], ["Share from three", fmt.pct(t.x3pRate)], ["3P%", fmt.pct(t.x3pPct)], ["Group", c.quad(t).label],
        ]), event))
        .on("pointermove", (e) => tooltip.move(e))
        .on("pointerleave", () => tooltip.hide())
        .on("click", (event, t) => { st.selected = st.selected === t.team ? null : t.team; render(); })
        .transition().duration(600)
        .attr("cx", (t) => x(t.x3pRate)).attr("cy", (t) => y(t.x3pPct))
        .attr("r", (t) => (t === sel ? 10 : 8))
        .attr("fill", (t) => color(t.winPct));

      labels.selectAll("text").data(sel ? [sel] : [], (t) => t.team).join("text")
        .attr("class", "label-strong halo").attr("dy", "0.32em")
        .attr("x", (t) => x(t.x3pRate) + (x(t.x3pRate) > W * 0.75 ? -14 : 14))
        .attr("text-anchor", (t) => (x(t.x3pRate) > W * 0.75 ? "end" : "start"))
        .attr("y", (t) => y(t.x3pPct))
        .text((t) => `${t.abbr} ${t.w}-${t.l}`);

      panel.innerHTML = sel ? teamPanel(sel, c) : st.summary ? summaryPanel()
        : `<h4>Pick a team</h4><p class="muted">Click a dot to see its record, its three-point profile and its top shooters.</p>`;
      panel.querySelectorAll("[data-player]").forEach((a) => a.addEventListener("click", (e) => {
        e.preventDefault();
        ctx.go("players", { params: { mode: "season", a: { id: a.dataset.player, season: +a.dataset.season } } });
      }));
      panel.querySelector("[data-compare]")?.addEventListener("click", () => {
        const [p1, p2] = sel.shooters;
        ctx.go("players", { params: { mode: "season", a: { id: p1[1], season: sel.season }, b: p2 ? { id: p2[1], season: sel.season } : undefined } });
      });
      panel.querySelector("[data-shots]")?.addEventListener("click", () => {
        ctx.go("space", { step: 3, params: { team: sel.nbaId, a: 2004, b: sel.season, mode: "freq" } });
      });
    }

    return {
      step(i) { slider.stop(); Object.assign(st, STORY[i]); render(); },
      apply(params) { Object.assign(st, params); render(); },
      redraw() { render(); },
    };
  },
};
