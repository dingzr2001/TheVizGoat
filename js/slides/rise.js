// 01 · League-wide three-point trend since 1979-80, annotated with rule changes and milestones.
import { svgIn, segmented, tooltip, tipHtml, fmt, seasonLabel } from "../lib.js";

// Seasons are labelled by the year they end (1995 = 1994-95).
export const EVENTS = [
  { season: 1980, title: "Three-point line arrives", text: "The NBA adopts the three-point line for the 1979-80 season." },
  { season: 1995, title: "Line moved in to 22 ft", text: "To boost scoring, the line is shortened to a uniform 22 feet for 1994-95 through 1996-97." },
  { season: 1998, title: "Line moved back", text: "The arc returns to 23 ft 9 in for 1997-98; attempts drop for a few seasons." },
  { season: 2002, title: "Zone defense legalized", text: "Illegal-defense rules are dropped in 2001-02, and the defensive three-second rule is added." },
  { season: 2005, title: "Hand-checking crackdown", text: "From 2004-05, defenders can no longer hand-check ball handlers on the perimeter." },
  { season: 2016, title: "Curry's 402 threes", text: "Stephen Curry makes 402 threes in 2015-16 and becomes the first unanimous MVP." },
  { season: 2025, title: "48.2 attempts a game", text: "The 2024-25 Celtics attempt a record 48.2 threes per game." },
];

const METRICS = {
  x3pa: { label: "3PA per game", short: "3PA / game", fmt: fmt.dec1 },
  x3pRate: { label: "Share of shots from three", short: "3PA share", fmt: fmt.pct },
  x3pPct: { label: "3P%", short: "3P%", fmt: fmt.pct },
};

const STORY = [
  { metric: "x3pa", events: [1980] },
  { metric: "x3pa", events: [1995, 1998] },
  { metric: "x3pRate", events: [2002, 2005, 2016, 2025] },
  { metric: "x3pPct", events: [] },
];

const W = 860, H = 470;
const M = { top: 56, right: 28, bottom: 40, left: 56 };

export default {
  id: "rise",
  nav: "The rise",
  kicker: "Message 1 · Trend",
  title: "How fast did the three-pointer take over?",
  lede: (d) => {
    const [a, z] = [d.league[0], d.league.at(-1)];
    return {
      stat: `${Math.round(z.x3pa / a.x3pa)}<small>×</small>`,
      caption: `as many three-point attempts per game in ${seasonLabel(z.season)} as in ${seasonLabel(a.season)}.`,
    };
  },
  steps: [
    (d) => {
      const [a, z] = [d.league[0], d.league.at(-1)];
      return `<p>In its first season (1979-80), an average team attempted <span class="key-num">${fmt.dec1(a.x3pa)}</span>
        threes per game. In 2025-26 it was <span class="key-num">${fmt.dec1(z.x3pa)}</span>, about
        <strong>${Math.round(z.x3pa / a.x3pa)}×</strong> as many.</p>
        <p>For about a decade the three was a novelty, used mostly at the end of quarters.</p>`;
    },
    `<p>The first jump came from a <strong>rule change, not a strategy change</strong>. From 1994-95 to 1996-97 the
      line was moved in to 22 feet everywhere, and attempts jumped.</p>
      <p>When the line moved back in 1997-98, attempts fell, then took about a decade to climb back.</p>`,
    (d) => {
      const r = (s) => d.league.find((l) => l.season === s).x3pRate;
      return `<p>As a <strong>share of all shots</strong>, the climb is steady: ${fmt.pct0(r(2004))} in 2003-04,
        ${fmt.pct0(r(2015))} in 2014-15, and <span class="key-num">${fmt.pct0(d.league.at(-1).x3pRate)}</span> in 2025-26.</p>
        <p>The steepest stretch came after 2015, around Golden State's titles and Curry's record seasons.
        Rule changes and star players line up with the trend in time, but the timeline alone can't show that they caused it.</p>`;
    },
    (d) => {
      const mid = d.league.filter((l) => l.season >= 1995);
      const [lo, hi] = d3.extent(mid, (l) => l.x3pPct);
      return `<p>Meanwhile, league-wide accuracy barely moved. Since 1994-95, league 3P% has stayed between
        <span class="key-num">${fmt.pct(lo)}</span> and <span class="key-num">${fmt.pct(hi)}</span>.</p>
        <p>Teams didn't become much better three-point shooters. They became <strong>more willing</strong>
        three-point shooters. So which one matters for winning: the volume or the accuracy?</p>`;
    },
  ],
  notes: `League averages per team-game from Basketball-Reference, via the Kaggle dataset
    <a href="https://www.kaggle.com/datasets/sumitrodatta/nba-aba-baa-stats" target="_blank" rel="noopener">NBA Stats (1947-present)</a>.
    "Share of shots from three" = 3PA ÷ FGA. Event dates come from NBA rule history; the timeline shows when things
    coincided, not what caused them.`,

  mount({ viz, controls, data }) {
    const league = data.league;
    let metric = "x3pa";
    let highlighted = [];

    const metricCtl = segmented(controls, "Show", Object.entries(METRICS).map(([k, m]) => [k, m.label]), metric,
      (v) => { metric = v; render(true); });

    const svg = svgIn(viz, W, H);
    const x = d3.scaleLinear().domain([1979.5, 2026.5]).range([M.left, W - M.right]);
    const y = d3.scaleLinear().range([H - M.bottom, M.top]);
    const gridG = svg.append("g").attr("class", "grid");
    const yAxisG = svg.append("g").attr("class", "axis").attr("transform", `translate(${M.left},0)`);
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - M.bottom})`)
      .call(d3.axisBottom(x).tickValues(d3.range(1980, 2027, 5)).tickFormat((s) => seasonLabel(s)).tickSizeOuter(0));
    const yTitle = svg.append("text").attr("class", "axis-title").attr("transform", "rotate(-90)")
      .attr("x", -(M.top + H - M.bottom) / 2).attr("y", 14).attr("text-anchor", "middle");

    // Event markers: a hairline and a numbered badge along the top of the plot.
    const evG = svg.append("g");
    const ev = evG.selectAll("g").data(EVENTS).join("g")
      .attr("transform", (e) => `translate(${x(e.season)},0)`)
      .style("cursor", "pointer");
    ev.append("line").attr("y1", M.top - 12).attr("y2", H - M.bottom).attr("stroke", "var(--grid)").attr("stroke-width", 1);
    ev.append("circle").attr("cy", M.top - 20).attr("r", 9);
    ev.append("text").attr("y", M.top - 16).attr("text-anchor", "middle").style("font-size", "11px").style("font-weight", 700)
      .text((e, i) => i + 1);
    ev.append("text").attr("class", "ev-title label").attr("y", M.top - 34).attr("text-anchor", "middle");
    ev.append("rect").attr("x", -12).attr("y", M.top - 32).attr("width", 24).attr("height", H - M.bottom - M.top + 32)
      .attr("fill", "transparent")
      .on("pointerenter", (event, e) => tooltip.show(tipHtml(`${seasonLabel(e.season)} · ${e.title}`, []) + `<div>${e.text}</div>`, event))
      .on("pointermove", (event) => tooltip.move(event))
      .on("pointerleave", () => tooltip.hide());

    const line = d3.line().x((d) => x(d.season)).y((d) => y(d[metric])).curve(d3.curveMonotoneX);
    const path = svg.append("path").attr("fill", "none").attr("stroke", "var(--series-1)").attr("stroke-width", 2.5);
    const endDot = svg.append("circle").attr("r", 4.5).attr("fill", "var(--series-1)").attr("stroke", "var(--surface)").attr("stroke-width", 2);
    const endLabel = svg.append("text").attr("class", "label-strong").attr("text-anchor", "end");

    // Crosshair + tooltip.
    const hover = svg.append("g").style("display", "none").style("pointer-events", "none");
    hover.append("line").attr("y1", M.top).attr("y2", H - M.bottom).attr("stroke", "var(--axis)");
    const hoverDot = hover.append("circle").attr("r", 5).attr("fill", "var(--series-1)").attr("stroke", "var(--surface)").attr("stroke-width", 2);
    svg.append("rect").attr("x", M.left).attr("y", M.top).attr("width", W - M.left - M.right).attr("height", H - M.top - M.bottom)
      .attr("fill", "transparent")
      .on("pointermove", (event) => {
        const [px] = d3.pointer(event);
        const s = Math.round(x.invert(px));
        const d = league.find((l) => l.season === s);
        if (!d) return;
        hover.style("display", null).attr("transform", `translate(${x(s)},0)`);
        hoverDot.attr("cy", y(d[metric]));
        const evt = EVENTS.find((e) => e.season === s);
        tooltip.show(tipHtml(seasonLabel(s), [
          ["3PA per game", fmt.dec1(d.x3pa)],
          ["Share of shots from three", fmt.pct(d.x3pRate)],
          ["3P%", fmt.pct(d.x3pPct)],
        ]) + (evt ? `<div style="margin-top:4px">● ${evt.title}</div>` : ""), event);
      })
      .on("pointerleave", () => { hover.style("display", "none"); tooltip.hide(); });

    function render(animate) {
      const m = METRICS[metric];
      const max = d3.max(league, (d) => d[metric]);
      y.domain(metric === "x3pPct" ? [0.2, 0.4] : [0, max * 1.08]).nice();
      const axis = d3.axisLeft(y).ticks(6).tickFormat(metric === "x3pa" ? d3.format("d") : d3.format(".0%")).tickSizeOuter(0);
      yAxisG.transition().duration(animate ? 600 : 0).call(axis);
      gridG.transition().duration(animate ? 600 : 0)
        .call(d3.axisLeft(y).ticks(6).tickSize(-(W - M.left - M.right)).tickFormat(""))
        .attr("transform", `translate(${M.left},0)`);
      yTitle.text(m.label + (metric === "x3pPct" ? " (axis starts at 20%)" : ""));

      const last = league.at(-1);
      (animate ? path.transition().duration(700) : path).attr("d", line(league));
      (animate ? endDot.transition().duration(700) : endDot).attr("cx", x(last.season)).attr("cy", y(last[metric]));
      endLabel.attr("x", x(last.season) - 8).attr("y", y(last[metric]) - 10).text(m.fmt(last[metric]));

      ev.select("circle")
        .attr("fill", (e) => (highlighted.includes(e.season) ? "var(--ink)" : "var(--surface)"))
        .attr("stroke", (e) => (highlighted.includes(e.season) ? "var(--ink)" : "var(--axis)"));
      ev.select("text:not(.ev-title)").attr("fill", (e) => (highlighted.includes(e.season) ? "var(--surface)" : "var(--muted)"));
      // Alternate label rows so neighbouring highlighted events don't collide.
      ev.select(".ev-title").text((e) => (highlighted.includes(e.season) ? e.title : ""))
        .attr("y", (e) => M.top - 34 - (highlighted.indexOf(e.season) % 2) * 15)
        .attr("text-anchor", (e) => (e.season > 2020 ? "end" : e.season < 1984 ? "start" : "middle"))
        .attr("dx", (e) => (e.season > 2020 ? 10 : e.season < 1984 ? -10 : 0));
      ev.select("line").attr("stroke", (e) => (highlighted.includes(e.season) ? "var(--axis)" : "var(--grid)"));
    }

    function drawIn() {
      const len = path.node().getTotalLength();
      path.attr("stroke-dasharray", `${len} ${len}`).attr("stroke-dashoffset", len)
        .transition().duration(1600).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0)
        .on("end", () => path.attr("stroke-dasharray", null));
    }

    render(false);
    let drawn = false;
    return {
      step(i) {
        const s = STORY[i];
        const metricChanged = s.metric !== metric;
        metric = s.metric;
        highlighted = s.events;
        metricCtl.set(metric);
        render(metricChanged);
        if (!drawn) { drawn = true; drawIn(); }
      },
      redraw() { render(false); },
    };
  },
};
