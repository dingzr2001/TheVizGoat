// 07 · Player comparison radar: six skills as percentiles within a comparison group
// (all qualified players, or the same position group), for careers since 1996-97 or single seasons.
import { svgIn, segmented, selectBox, tooltip, tipHtml, fmt, seasonLabel, percentile } from "../lib.js";

const CAREER_MIN_GAMES = 300;   // careers: at least 300 games in 1996-97 .. 2025-26 (team decision, week 3)

const DIMS = [
  { key: "pts", label: "Scoring", desc: "Points per game", f: fmt.dec1 },
  { key: "ast", label: "Playmaking", desc: "Assists per game", f: fmt.dec1 },
  { key: "trb", label: "Rebounding", desc: "Rebounds per game", f: fmt.dec1 },
  { key: "def", label: "Defense", desc: "Steals + blocks per game", f: fmt.dec1 },
  { key: "ts", label: "Efficiency", desc: "True shooting %", f: fmt.pct },
  { key: "x3p", label: "Three-point", desc: "Threes made per game", f: fmt.dec1 },
];

const POS_GROUP = { PG: "Guards", SG: "Guards", G: "Guards", SF: "Forwards", PF: "Forwards", F: "Forwards", C: "Centers" };

const STORY = [
  { mode: "career", group: "position", a: { id: "iversal01" }, b: { id: "curryst01" } },
  { mode: "career", group: "position", a: { id: "onealsh01" }, b: { id: "jokicni01" } },
  { mode: "season", group: "all", a: { id: "jordami01", season: 1997 }, b: { id: "curryst01", season: 2016 } },
];

const W = 560, H = 480, R = 170;
const CX = W / 2, CY = H / 2 + 4;

/** Per-game profile from summed totals. */
function profile(t) {
  const g = Math.max(1, t.g);
  const tsa = 2 * (t.fga + 0.44 * t.fta);
  return {
    pts: t.pts / g, ast: t.ast / g, trb: t.trb / g, def: (t.stl + t.blk) / g,
    ts: tsa > 0 ? t.pts / tsa : 0, x3p: t.x3p / g,
  };
}

function buildIndex(data) {
  const cols = data.players.columns;
  const seasons = data.players.rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
  const byPlayer = d3.group(seasons, (s) => s.id);
  const careers = [...byPlayer].map(([id, rows]) => {
    const tot = {};
    ["g", "mp", "pts", "trb", "ast", "stl", "blk", "tov", "x3p", "x3pa", "fga", "fta"].forEach((k) => { tot[k] = d3.sum(rows, (r) => r[k]); });
    const pos = d3.greatest(d3.rollups(rows, (v) => d3.sum(v, (r) => r.g), (r) => r.pos), (d) => d[1])?.[0] || "";
    return {
      id, name: rows[0].name, pos, first: d3.min(rows, (r) => r.season), last: d3.max(rows, (r) => r.season),
      g: tot.g, ...profile(tot), seasons: rows,
    };
  });
  const careerById = new Map(careers.map((c) => [c.id, c]));
  const seasonRows = seasons.map((s) => ({ ...s, ...profile(s) }));
  return { careers, careerById, seasonRows };
}

export default {
  id: "players",
  nav: "Players",
  kicker: "Message 5 · From teams to players",
  title: "What does a player look like in the three-point era?",
  art: { img: "img/cards.jpg", tone: "paper", align: "center", position: "center", positionSmall: "right bottom" },
  lede: (d) => ({
    stat: `${fmt.int(d.players.rows.length)}<small>player-seasons</small>`,
    caption: "since 1996-97, each measured on six skills against the players of their time.",
  }),
  steps: [
    `<p>Teams win with efficient shooting, so what do the players look like? Each axis is a <strong>percentile</strong>:
      the share of comparable players this player beats (100 = best).</p>
      <p><span class="key">Allen Iverson</span> and <span class="key b">Stephen Curry</span>, careers compared with
      other guards. Both are elite scorers, but they got there differently: Iverson on high-volume twos and free
      throws, Curry on threes, and far more efficiently.</p>`,
    `<p>Centers changed too. <span class="key">Shaquille O'Neal</span> dominated scoring and
      rebounding near the rim but almost never shot threes, even compared with other centers.</p>
      <p><span class="key b">Nikola Jokić</span> is a center whose profile spreads across
      every axis, including playmaking and some outside shooting.</p>`,
    `<p>Single seasons, compared with everyone who played at least half that season:
      <span class="key">Michael Jordan, 1996-97</span> vs
      <span class="key b">Stephen Curry, 2015-16</span>, two MVP seasons 19 years apart.</p>
      <p>Their scoring percentiles are similar, but Curry's comes with elite three-point volume <em>and</em>
      efficiency. Pick any two players and seasons above to compare them yourself.</p>`,
  ],
  notes: `Player totals from Basketball-Reference (Kaggle: NBA Stats 1947-present), 1996-97 to 2025-26, regular season.
    Careers: totals summed over that window; the comparison group is every player with at least ${CAREER_MIN_GAMES}
    games. Single seasons: the group is everyone who played at least half of that season's games. For a traded player,
    the season's combined row is used. True shooting % = PTS ÷ (2 × (FGA + 0.44 × FTA)). Percentile = share of the group
    below the player's value (ties count half). Position groups use Basketball-Reference's listed position (for careers, the one
    held for the most games). Seasons with fewer than 10 games are left out.`,

  mount({ viz, controls, data }) {
    const idx = buildIndex(data);
    const st = { mode: "career", group: "position", a: { ...STORY[0].a }, b: { ...STORY[0].b } };

    // Player pickers: a searchable text input backed by a datalist of "Name (years)".
    const listId = "player-list";
    const datalist = document.createElement("datalist");
    datalist.id = listId;
    datalist.innerHTML = [...idx.careers].sort((p, q) => d3.descending(p.g, q.g))
      .map((c) => `<option value="${c.name} (${seasonLabel(c.first).slice(0, 4)}–${String(c.last).slice(2)})"></option>`).join("");
    controls.appendChild(datalist);
    const labelOf = (c) => `${c.name} (${seasonLabel(c.first).slice(0, 4)}–${String(c.last).slice(2)})`;
    const byLabel = new Map(idx.careers.map((c) => [labelOf(c), c]));

    const modeCtl = segmented(controls, "", [["career", "Career since 1996-97"], ["season", "Single season"]], st.mode,
      (v) => { st.mode = v; render(); });
    const groupCtl = segmented(controls, "Compare with", [["all", "All players"], ["position", "Same position"]], st.group,
      (v) => { st.group = v; render(); });

    const pickers = ["a", "b"].map((slot, k) => {
      const wrap = document.createElement("span");
      wrap.className = "ctl";
      wrap.innerHTML = `<span class="sw" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--series-${k + 1})"></span>`;
      const input = document.createElement("input");
      input.type = "search";
      input.setAttribute("list", listId);
      input.setAttribute("aria-label", `Player ${k + 1}`);
      input.placeholder = "Search a player";
      input.style.width = "230px";
      const sel = document.createElement("select");
      sel.setAttribute("aria-label", `Season for player ${k + 1}`);
      wrap.append(input, sel);
      controls.appendChild(wrap);
      input.addEventListener("change", () => {
        const c = byLabel.get(input.value);
        if (!c) return;
        st[slot] = { id: c.id, season: null };
        render();
      });
      sel.addEventListener("change", () => { st[slot].season = +sel.value; render(); });
      return { input, sel };
    });

    viz.innerHTML = `<div class="split"><div class="radar"></div><div class="panel"></div></div>`;
    const panel = viz.querySelector(".panel");
    const svg = svgIn(viz.querySelector(".radar"), W, H);
    const n = DIMS.length;
    const angle = (i) => (i / n) * 2 * Math.PI - Math.PI / 2;
    const r = d3.scaleLinear().domain([0, 100]).range([0, R]);

    const grid = svg.append("g");
    [25, 50, 75, 100].forEach((t) => {
      grid.append("circle").attr("cx", CX).attr("cy", CY).attr("r", r(t)).attr("fill", "none").attr("stroke", "var(--grid)");
      grid.append("text").attr("class", "chart-sub").attr("x", CX + 4).attr("y", CY - r(t) - 3).text(t);
    });
    DIMS.forEach((d, i) => {
      const a = angle(i);
      grid.append("line").attr("x1", CX).attr("y1", CY).attr("x2", CX + Math.cos(a) * R).attr("y2", CY + Math.sin(a) * R)
        .attr("stroke", "var(--grid)");
      const lx = CX + Math.cos(a) * (R + 20), ly = CY + Math.sin(a) * (R + 20);
      grid.append("text").attr("class", "label-strong").attr("x", lx).attr("y", ly).attr("dy", "0.32em")
        .attr("text-anchor", Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end")
        .text(d.label)
        .on("pointerenter", (event) => tooltip.show(tipHtml(d.label, [["Measure", d.desc]]), event))
        .on("pointerleave", () => tooltip.hide());
    });
    const shapes = svg.append("g");

    /** Resolve a slot to { label, row (profile), pool (sorted values per dim), poolName, qualified }. */
    function resolve(slot) {
      const career = idx.careerById.get(st[slot].id);
      if (!career) return null;
      const group = POS_GROUP[career.pos] || "All";
      if (st.mode === "career") {
        let pool = idx.careers.filter((c) => c.g >= CAREER_MIN_GAMES);
        if (st.group === "position") pool = pool.filter((c) => POS_GROUP[c.pos] === group);
        return {
          name: career.name, label: `${career.name}, career ${seasonLabel(career.first)} – ${seasonLabel(career.last)}`,
          row: career, pool, poolName: `${st.group === "position" ? group.toLowerCase() : "players"} with ${CAREER_MIN_GAMES}+ games`,
          qualified: career.g >= CAREER_MIN_GAMES, games: career.g,
        };
      }
      const seasons = career.seasons.map((s) => s.season);
      if (!seasons.includes(st[slot].season)) st[slot].season = d3.greatest(career.seasons, (s) => s.pts / s.g).season;
      const season = st[slot].season;
      const row = idx.seasonRows.find((s) => s.id === career.id && s.season === season);
      const minG = data.players.seasonGames[season] / 2;
      const rowGroup = POS_GROUP[row.pos] || "All";
      let pool = idx.seasonRows.filter((s) => s.season === season && s.g >= minG);
      if (st.group === "position") pool = pool.filter((s) => POS_GROUP[s.pos] === rowGroup);
      return {
        name: career.name, label: `${career.name}, ${seasonLabel(season)} (${row.team})`,
        row, pool, poolName: `${st.group === "position" ? rowGroup.toLowerCase() : "players"} with ${Math.ceil(minG)}+ games in ${seasonLabel(season)}`,
        qualified: row.g >= minG, games: row.g,
      };
    }

    function render() {
      modeCtl.set(st.mode); groupCtl.set(st.group);
      const players = ["a", "b"].map((slot, k) => {
        const p = resolve(slot);
        const career = idx.careerById.get(st[slot].id);
        const picker = pickers[k];
        if (career && document.activeElement !== picker.input) picker.input.value = labelOf(career);
        picker.sel.style.display = st.mode === "season" ? "" : "none";
        if (career) {
          picker.sel.innerHTML = career.seasons.map((s) => `<option value="${s.season}">${seasonLabel(s.season)}</option>`).join("");
          if (st[slot].season) picker.sel.value = st[slot].season;
        }
        if (!p) return null;
        const pct = Object.fromEntries(DIMS.map((d) => {
          const sorted = p.pool.map((q) => q[d.key]).sort(d3.ascending);
          return [d.key, percentile(sorted, p.row[d.key])];
        }));
        return { ...p, pct, color: `var(--series-${k + 1})` };
      }).filter(Boolean);

      const pts = (p) => DIMS.map((d, i) => [CX + Math.cos(angle(i)) * r(p.pct[d.key]), CY + Math.sin(angle(i)) * r(p.pct[d.key]), d, p]);
      const g = shapes.selectAll("g.player").data(players, (p, i) => i).join((enter) => {
        const pg = enter.append("g").attr("class", "player");
        pg.append("path").attr("stroke-width", 2).attr("fill-opacity", 0.14);
        return pg;
      });
      g.select("path").attr("stroke", (p) => p.color).attr("fill", (p) => p.color)
        .transition().duration(600).attr("d", (p) => `M${pts(p).map((q) => q.slice(0, 2).join(",")).join("L")}Z`);
      g.selectAll("circle").data((p) => pts(p)).join("circle")
        .attr("r", 4.5).attr("fill", (q) => q[3].color).attr("stroke", "var(--surface)").attr("stroke-width", 2)
        .on("pointerenter", (event, q) => tooltip.show(tipHtml(`${q[3].name} · ${q[2].label}`, [
          [q[2].desc, q[2].f(q[3].row[q[2].key])], ["Percentile", fmt.int(Math.round(q[3].pct[q[2].key]))],
        ]), event))
        .on("pointermove", (e) => tooltip.move(e))
        .on("pointerleave", () => tooltip.hide())
        .transition().duration(600).attr("cx", (q) => q[0]).attr("cy", (q) => q[1]);

      panel.innerHTML = `
        ${players.map((p) => `
          <div style="margin-bottom:8px"><span class="sw" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px"></span><strong>${p.label}</strong>
          <div class="muted">${p.games} games · vs ${p.pool.length} ${p.poolName}${p.qualified ? "" : " (below the games threshold, shown for reference)"}</div></div>`).join("")}
        <table class="data-table">
          <thead><tr><th>Skill</th>${players.map((p) => `<th>${p.name.split(" ").at(-1)}</th><th>Pct</th>`).join("")}</tr></thead>
          <tbody>${DIMS.map((d) => `<tr><td title="${d.desc}">${d.label}</td>${players.map((p) =>
            `<td>${d.f(p.row[d.key])}</td><td>${Math.round(p.pct[d.key])}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
        <p class="muted" style="margin-top:8px">Raw values per game (efficiency = true shooting %). Pct = percentile within the comparison group.</p>`;
    }

    return {
      step(i) {
        const s = STORY[i];
        Object.assign(st, { mode: s.mode, group: s.group, a: { ...s.a }, b: { ...s.b } });
        render();
      },
      apply(params) {
        if (params.mode) st.mode = params.mode;
        if (params.a) st.a = { ...params.a };
        if (params.b) st.b = { ...params.b };
        render();
      },
      redraw() { render(); },
    };
  },
};
