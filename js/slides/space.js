// 02 · Where shots come from: two seasons side by side on the court, plus a zone-by-zone dumbbell chart.
import { drawCourt, hexCenter, hexPath, HEX_RADIUS, COURT_DEPTH } from "../court.js";
import {
  svgIn, segmented, selectBox, tooltip, tipHtml, fmt, seasonLabel,
  sequentialInterpolator, divergingInterpolator,
} from "../lib.js";

const K = 8.4;                       // pixels per foot
const COURT_W = 50 * K, COURT_H = COURT_DEPTH * K;
const GAP = 36;
const M = { top: 30, left: 12 };
const DUMB_TOP = M.top + COURT_H + 34;
const W = M.left * 2 + COURT_W * 2 + GAP;
const H = DUMB_TOP + 5 * 24 + 34;
const LEAGUE = "league";
const HOUSTON = "1610612745";
const PPS_DOMAIN = [0.6, 1.4];       // points per shot shown from cold (blue) to hot (red), 1.0 in the middle

const STORY = [
  { a: 2004, b: 2025, team: LEAGUE, mode: "freq", showB: false },
  { a: 2004, b: 2025, team: LEAGUE, mode: "freq", showB: true },
  { a: 2004, b: 2025, team: LEAGUE, mode: "pps", showB: true },
  { a: 2004, b: 2019, team: HOUSTON, mode: "freq", showB: true },
];

function zoneShares(season) {
  return season.zones.map((z) => z[0] / season.fga);
}

export default {
  id: "space",
  nav: "The court",
  kicker: "Message 2 · Shot locations",
  title: "Where on the court did the shots go?",
  lede: (d) => {
    const [a, b] = [2004, 2025].map((s) => zoneShares(d.shots.seasons[s])[2]);
    return {
      stat: `${fmt.pct0(a)} <span class="arrow">→</span> ${fmt.pct0(b)}`,
      caption: "of all shots were mid-range jumpers, 2003-04 vs 2024-25. Where did they go?",
    };
  },
  steps: [
    (d) => {
      const z = zoneShares(d.shots.seasons[2004]);
      return `<p>Here is every shot of the <strong>2003-04</strong> season, binned into hexagons. Color shows how many attempts came from each spot.</p>
        <p>Besides layups and dunks at the rim, there is a wide band of <strong>mid-range jumpers</strong> inside the arc:
        <span class="key-num">${fmt.pct0(z[2])}</span> of all shots. Only ${fmt.pct0(z[3] + z[4])} were threes.</p>`;
    },
    (d) => {
      const a = zoneShares(d.shots.seasons[2004]), b = zoneShares(d.shots.seasons[2025]);
      return `<p>Compare <strong>2024-25</strong>. The mid-range band has almost emptied
        (<span class="key-num">${fmt.pct0(a[2])} → ${fmt.pct0(b[2])}</span>), and the shots moved
        <em>outward to the arc</em> (${fmt.pct0(a[3] + a[4])} → ${fmt.pct0(b[3] + b[4])}).</p>
        <p>Rim attempts stayed roughly the same. The game didn't move away from the basket; it moved away from the
        middle distance.</p>`;
    },
    (d) => {
      const z = d.shots.seasons[2025].zones.map((v) => v[2] / v[0]);
      return `<p>Why there? Color now shows <strong>points per shot</strong>, and size shows how often teams shot from
        each spot.</p>
        <p>In 2024-25, a mid-range attempt was worth <span class="key-num">${fmt.dec2(z[2])}</span> points on average,
        a corner three <span class="key-num">${fmt.dec2(z[3])}</span>, and a shot at the rim
        <span class="key-num">${fmt.dec2(z[0])}</span>. Teams moved attempts away from the least valuable spot.</p>
        <p>But a three is only worth more <em>if it goes in</em>. Keep that in mind.</p>`;
    },
    `<p>Teams went at different speeds. The <strong>2018-19 Houston Rockets</strong> took only about one shot in twenty
      from mid-range, a third of the league rate that season.</p>
      <p>Try any team and any two seasons from 2003-04 to 2024-25 with the controls above.</p>`,
  ],
  notes: `Every regular-season shot from NBA.com via
    <a href="https://github.com/DomSamangy/NBA_Shots_04_25" target="_blank" rel="noopener">NBA_Shots_04_25</a>
    (about 200,000 per season). Hexagons are 1 ft in radius. "Share of attempts" uses the same color scale for both
    courts, so seasons are comparable. In points-per-shot mode, hexagons with too few attempts (fewer than 40 league-wide,
    or 6 for one team) are hidden to avoid noisy spots. Zones follow NBA.com's definitions; backcourt heaves count as
    above-the-break threes.`,

  mount({ viz, controls, data }) {
    const st = { ...STORY[0] };
    const seasons = Object.keys(data.shots.seasons).map(Number);
    const seasonOpts = seasons.map((s) => [s, seasonLabel(s)]);
    let teamData = null;     // loaded franchise file, or null for the whole league

    const teamOpts = [[LEAGUE, "Whole league"], ...data.shotTeams.map((t) => [t.id, t.name])];
    const teamCtl = selectBox(controls, "Team", teamOpts, LEAGUE, (v) => { st.team = v; load(); });
    const aCtl = selectBox(controls, "Season A", seasonOpts, st.a, (v) => { st.a = +v; render(); });
    const bCtl = selectBox(controls, "Season B", seasonOpts, st.b, (v) => { st.b = +v; st.showB = true; render(); });
    const modeCtl = segmented(controls, "Color", [["freq", "Share of attempts"], ["pps", "Points per shot"]], st.mode,
      (v) => { st.mode = v; render(); });

    const svg = svgIn(viz, W, H);
    const courts = [0, 1].map((k) => {
      const g = svg.append("g").attr("transform", `translate(${M.left + k * (COURT_W + GAP)},${M.top})`);
      drawCourt(g, K);
      const hexG = g.append("g");
      // Court lines are drawn again on top so they stay visible over dense hexagons.
      const over = g.append("g").style("opacity", 0.6).style("pointer-events", "none");
      drawCourt(over, K);
      over.select(".floor").remove();
      const title = svg.append("text").attr("class", "chart-title")
        .attr("x", M.left + k * (COURT_W + GAP)).attr("y", M.top - 10);
      const sub = svg.append("text").attr("class", "chart-sub").attr("text-anchor", "end")
        .attr("x", M.left + k * (COURT_W + GAP) + COURT_W).attr("y", M.top - 10);
      return { g, hexG, title, sub };
    });

    // Color legend (drawn once, updated per mode).
    const legendG = svg.append("g").attr("transform", `translate(${W - M.left - 220},${DUMB_TOP - 6})`);
    const gradId = "space-grad";
    const grad = svg.append("defs").append("linearGradient").attr("id", gradId);
    legendG.append("rect").attr("width", 220).attr("height", 8).attr("rx", 2).attr("fill", `url(#${gradId})`);
    const legendLo = legendG.append("text").attr("class", "chart-sub").attr("y", 22);
    const legendHi = legendG.append("text").attr("class", "chart-sub").attr("y", 22).attr("x", 220).attr("text-anchor", "end");
    const legendMid = legendG.append("text").attr("class", "chart-sub").attr("y", 22).attr("x", 110).attr("text-anchor", "middle");

    // Dumbbell chart: one row per zone, season A (blue) vs season B (orange).
    const dumbG = svg.append("g");
    const dumbX = d3.scaleLinear().range([M.left + 120, W - M.left - 330]);
    const dumbTitle = svg.append("text").attr("class", "chart-title").attr("x", M.left).attr("y", DUMB_TOP);
    const dumbAxis = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${DUMB_TOP + 5 * 24 + 14})`);
    const dumbKey = svg.append("g").attr("transform", `translate(${W - M.left - 220},${DUMB_TOP + 40})`);

    async function load() {
      // A story step and a link from another chapter can request different teams back to back;
      // only the latest request may update the chart.
      const team = st.team;
      const loaded = team === LEAGUE ? null : await data.teamShots(team);
      if (team !== st.team) return;
      teamData = loaded;
      render();
    }

    function seasonData(s) {
      return teamData ? teamData.seasons[s] : data.shots.seasons[s];
    }

    function render() {
      teamCtl.set(st.team); aCtl.set(st.a); bCtl.set(st.b); modeCtl.set(st.mode);
      const pair = [st.a, st.b].map((s) => seasonData(s));
      const minAttempts = teamData ? 6 : 40;
      const teamName = (s) => (teamData ? teamData.names[s] : "All teams");

      const shareMax = d3.quantile(
        pair.flatMap((sd) => (sd ? sd.bins.map((b) => b[2] / sd.fga) : [])).sort(d3.ascending), 0.985) || 1;
      const seq = d3.scaleSequentialSqrt(sequentialInterpolator()).domain([0, shareMax]).clamp(true);
      const div = d3.scaleSequential(divergingInterpolator()).domain(PPS_DOMAIN).clamp(true);
      // Size saturates at the 80th-percentile spot so the few very busy hexagons at the rim don't shrink the rest.
      const sizeMax = d3.quantile(
        pair.flatMap((sd) => (sd ? sd.bins.filter((b) => b[2] >= minAttempts).map((b) => b[2] / sd.fga) : [])).sort(d3.ascending), 0.8) || 1;
      const size = d3.scaleSqrt().domain([0, sizeMax]).range([0.3, 1]).clamp(true);

      courts.forEach((c, k) => {
        const s = k === 0 ? st.a : st.b;
        const sd = pair[k];
        const visible = k === 0 || st.showB;
        c.g.transition().duration(500).style("opacity", visible ? 1 : 0.12);
        c.title.text(`${seasonLabel(s)} · ${teamName(s)}`).style("opacity", visible ? 1 : 0.3);
        c.sub.text(sd ? `${fmt.int(sd.fga)} shots` : "No data").style("opacity", visible ? 1 : 0.3);
        const bins = !sd ? [] : sd.bins
          .filter((b) => (st.mode === "freq" ? b[2] > 0 : b[2] >= minAttempts))
          .map(([i, j, a, m, p]) => ({ i, j, a, m, p, share: a / sd.fga, pps: p / a }));
        c.hexG.selectAll("path").data(bins, (b) => `${b.i},${b.j}`).join(
          (enter) => enter.append("path").attr("fill-opacity", 0),
        )
          .attr("transform", (b) => {
            const [hx, hy] = hexCenter(b.i, b.j);
            return `translate(${(hx + 25) * K},${hy * K})`;
          })
          .on("pointerenter", (event, b) => tooltip.show(tipHtml(`${seasonLabel(s)} · ${teamName(s)}`, [
            ["Attempts", fmt.int(b.a)],
            ["Share of all shots", fmt.pct(b.share)],
            ["FG%", fmt.pct(b.m / b.a)],
            ["Points per shot", fmt.dec2(b.pps)],
          ]), event))
          .on("pointermove", (event) => tooltip.move(event))
          .on("pointerleave", () => tooltip.hide())
          .transition().duration(500)
          .attr("fill-opacity", 1)
          .attr("d", (b) => hexPath(HEX_RADIUS * K * (st.mode === "freq" ? 1.02 : size(b.share))))
          .attr("fill", (b) => (st.mode === "freq" ? seq(b.share) : div(b.pps)));
      });

      // Legend.
      const interp = st.mode === "freq" ? (t) => seq(shareMax * t * t) : (t) => div(PPS_DOMAIN[0] + t * (PPS_DOMAIN[1] - PPS_DOMAIN[0]));
      grad.selectAll("stop").data(d3.range(0, 1.01, 0.1)).join("stop")
        .attr("offset", (t) => `${t * 100}%`).attr("stop-color", (t) => interp(t));
      if (st.mode === "freq") {
        legendLo.text("fewer attempts"); legendHi.text("more attempts"); legendMid.text("");
      } else {
        legendLo.text(`${PPS_DOMAIN[0]} pts`); legendMid.text("1.0 point per shot"); legendHi.text(`${PPS_DOMAIN[1]}+ pts`);
      }

      renderDumbbell(pair);
    }

    function renderDumbbell(pair) {
      const zones = data.shots.zones;
      const val = (sd, z) => (!sd ? null : st.mode === "freq" ? sd.zones[z][0] / sd.fga : sd.zones[z][2] / Math.max(1, sd.zones[z][0]));
      const rows = zones.map((name, z) => ({ name, z, a: val(pair[0], z), b: st.showB ? val(pair[1], z) : null }));
      const isFreq = st.mode === "freq";
      dumbX.domain(isFreq ? [0, 0.5] : [0.6, 1.4]);
      dumbTitle.text(isFreq ? "Share of attempts by zone" : "Points per shot by zone");
      dumbAxis.transition().duration(400)
        .call(d3.axisBottom(dumbX).ticks(5).tickFormat(isFreq ? d3.format(".0%") : d3.format(".1f")).tickSizeOuter(0));

      const y = (z) => DUMB_TOP + 14 + z * 24;
      const row = dumbG.selectAll("g.row").data(rows, (r) => r.name).join((enter) => {
        const g = enter.append("g").attr("class", "row");
        g.append("text").attr("class", "label").attr("x", M.left).attr("dy", "0.32em");
        g.append("line").attr("class", "track").attr("stroke", "var(--grid)").attr("stroke-width", 1);
        g.append("line").attr("class", "conn").attr("stroke", "var(--axis)").attr("stroke-width", 2);
        g.append("circle").attr("class", "da").attr("r", 6).attr("fill", "var(--series-1)").attr("stroke", "var(--surface)").attr("stroke-width", 2);
        g.append("circle").attr("class", "db").attr("r", 6).attr("fill", "var(--series-2)").attr("stroke", "var(--surface)").attr("stroke-width", 2);
        g.append("text").attr("class", "val label").attr("dy", "0.32em");
        return g;
      });
      row.attr("transform", (r) => `translate(0,${y(r.z)})`);
      row.select("text.label:not(.val)").text((r) => r.name);
      row.select(".track").attr("x1", dumbX.range()[0]).attr("x2", dumbX.range()[1]);
      const f = isFreq ? fmt.pct0 : fmt.dec2;
      const t = row.transition().duration(500);
      t.select(".da").attr("cx", (r) => (r.a == null ? -99 : dumbX(r.a))).style("opacity", (r) => (r.a == null ? 0 : 1));
      t.select(".db").attr("cx", (r) => (r.b == null ? dumbX(r.a ?? 0) : dumbX(r.b))).style("opacity", (r) => (r.b == null ? 0 : 1));
      t.select(".conn")
        .attr("x1", (r) => dumbX(r.a ?? 0)).attr("x2", (r) => dumbX(r.b ?? r.a ?? 0));
      row.select(".val")
        .attr("x", dumbX.range()[1] + 10)
        .text((r) => (r.a == null ? "" : r.b == null ? f(r.a) : `${f(r.a)} → ${f(r.b)}`));
      row.on("pointerenter", (event, r) => tooltip.show(tipHtml(r.name, [
        [seasonLabel(st.a), r.a == null ? "–" : f(r.a)],
        ...(r.b == null ? [] : [[seasonLabel(st.b), f(r.b)]]),
      ]), event)).on("pointermove", (e) => tooltip.move(e)).on("pointerleave", () => tooltip.hide());

      dumbKey.selectAll("*").remove();
      [[st.a, "var(--series-1)"], ...(st.showB ? [[st.b, "var(--series-2)"]] : [])].forEach(([s, c], k) => {
        dumbKey.append("circle").attr("cx", 6 + k * 110).attr("cy", 0).attr("r", 6).attr("fill", c);
        dumbKey.append("text").attr("class", "label").attr("x", 16 + k * 110).attr("dy", "0.32em").text(seasonLabel(s));
      });
    }

    return {
      async step(i) {
        Object.assign(st, STORY[i]);
        await load();
      },
      apply(params) {
        Object.assign(st, params, { showB: true });
        load();
      },
      redraw() { render(); },
    };
  },
};
