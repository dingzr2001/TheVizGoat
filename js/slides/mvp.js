// 08 · MVP winners by listed position, 1955-56 to 2024-25. Dot size can show three-point attempts per game.
import { svgIn, segmented, tooltip, tipHtml, fmt, seasonLabel } from "../lib.js";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];
const POS_NAME = { PG: "Point guard", SG: "Shooting guard", SF: "Small forward", PF: "Power forward", C: "Center" };
const DECADES = [[1956, 1969], [1970, 1979], [1980, 1989], [1990, 1999], [2000, 2009], [2010, 2019], [2020, 2025]];
const FIRST_PLAYER_SEASON = 1997;   // the player chapter covers 1996-97 onward

const W = 680, H = 460;
const M = { top: 40, right: 20, bottom: 40, left: 120 };

const STORY = [{ size: "same" }, { size: "x3pa" }];

export default {
  id: "mvp",
  nav: "MVPs",
  kicker: "Message 5 · A side note",
  title: "Has the MVP moved away from the basket?",
  art: { img: "img/legends.jpg", tone: "paper", align: "left", position: "right bottom", positionSmall: "right bottom" },
  lede: (d) => ({
    stat: `${d.mvps.length}<small>MVPs</small>`,
    caption: `from ${seasonLabel(d.mvps[0].season)} to ${seasonLabel(d.mvps.at(-1).season)}. Where did they play, and did they shoot?`,
  }),
  steps: [
    (d) => {
      const c = d.mvps.filter((m) => m.pos === "C");
      const early = c.filter((m) => m.season < 1990).length;
      return `<p>Every MVP since 1955-56, placed by listed position. Centers won <span class="key-num">${c.length} of ${d.mvps.length}</span>
        awards, <strong>${early}</strong> of them before 1990.</p>
        <p>Since then the award has moved across all five positions, from Jordan to Curry to Jokić.</p>`;
    },
    (d) => {
      const recent = d.mvps.filter((m) => m.season >= 2015);
      const lo = d3.min(recent, (m) => m.x3pa);
      return `<p>Now dot size shows the winner's <strong>three-point attempts per game</strong>.
        Before the mid-1990s the dots are tiny for every position.</p>
        <p>Every MVP since 2014-15 attempted at least <span class="key-num">${fmt.dec1(lo)}</span> threes a game,
        including the centers. Click a dot from 1996-97 onward to open that season in the player comparison.</p>`;
    },
  ],
  notes: `MVP winners and players' listed positions for the winning season from Basketball-Reference (Kaggle: NBA Stats
    1947-present). Listed positions are a simplification; many players played more than one. This chapter is a
    side note to the main question.`,

  mount({ viz, controls, data, ctx }) {
    const st = { ...STORY[0] };
    const sizeCtl = segmented(controls, "Dot size", [["same", "Same for all"], ["x3pa", "3PA per game"]], st.size,
      (v) => { st.size = v; render(); });

    viz.innerHTML = `<div class="split"><div class="chart"></div><div class="panel"></div></div>`;
    const panel = viz.querySelector(".panel");
    const svg = svgIn(viz.querySelector(".chart"), W, H);
    const x = d3.scaleLinear().domain([1955, 2026]).range([M.left, W - M.right]);
    const y = d3.scalePoint().domain(POSITIONS).range([M.top + 20, H - M.bottom - 20]);
    const size = d3.scaleSqrt().domain([0, 12]).range([3, 15]);

    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - M.bottom})`)
      .call(d3.axisBottom(x).tickValues(d3.range(1960, 2026, 20)).tickFormat(seasonLabel).tickSizeOuter(0));
    POSITIONS.forEach((p) => {
      svg.append("line").attr("x1", M.left).attr("x2", W - M.right).attr("y1", y(p)).attr("y2", y(p)).attr("stroke", "var(--grid)");
      svg.append("text").attr("class", "label-strong").attr("x", M.left - 12).attr("y", y(p)).attr("dy", "0.32em")
        .attr("text-anchor", "end").text(POS_NAME[p]);
    });
    const dots = svg.append("g");
    const sizeKey = svg.append("g").attr("transform", `translate(${W - M.right - 200},${M.top - 8})`);
    sizeKey.append("text").attr("class", "chart-sub").attr("y", 4).text("3PA / game");
    [1, 5, 10].forEach((v, k) => {
      sizeKey.append("circle").attr("cx", 86 + k * 42).attr("cy", 0).attr("r", size(v))
        .attr("fill", "none").attr("stroke", "var(--muted)");
      sizeKey.append("text").attr("class", "chart-sub").attr("x", 86 + k * 42 + size(v) + 3).attr("y", 4).text(v);
    });

    panel.innerHTML = `<h4>MVPs by position and decade</h4>
      <table class="data-table"><thead><tr><th>Decade</th>${POSITIONS.map((p) => `<th>${p}</th>`).join("")}</tr></thead>
      <tbody>${DECADES.map(([a, b]) => {
        const rows = data.mvps.filter((m) => m.season >= a && m.season <= b);
        return `<tr><td>${a === 1956 ? "1956–69" : `${a}s`}</td>${POSITIONS.map((p) => {
          const n = rows.filter((m) => m.pos === p).length;
          return `<td style="${n ? "font-weight:600" : "color:var(--muted)"}">${n || "·"}</td>`;
        }).join("")}</tr>`;
      }).join("")}</tbody></table>
      <p class="muted" style="margin-top:8px">Seasons labelled by the year they end. The 2025-26 award is not in the dataset yet.</p>`;

    function render() {
      sizeCtl.set(st.size);
      sizeKey.style("display", st.size === "x3pa" ? null : "none");
      dots.selectAll("circle").data(data.mvps, (m) => m.season).join("circle")
        .attr("cx", (m) => x(m.season)).attr("cy", (m) => y(m.pos))
        .attr("fill", "var(--series-1)").attr("fill-opacity", 0.8)
        .attr("stroke", "var(--surface)").attr("stroke-width", 2)
        .style("cursor", (m) => (m.season >= FIRST_PLAYER_SEASON ? "pointer" : "default"))
        .on("pointerenter", (event, m) => tooltip.show(tipHtml(`${m.player} · ${seasonLabel(m.season)}`, [
          ["Team", m.team], ["Position", POS_NAME[m.pos]],
          ["Points / rebounds / assists", `${fmt.dec1(m.pts)} / ${fmt.dec1(m.trb)} / ${fmt.dec1(m.ast)}`],
          ["3PA per game", m.x3pa == null ? "–" : fmt.dec1(m.x3pa)],
          ["True shooting %", m.ts == null ? "–" : fmt.pct(m.ts)],
        ]) + (m.season >= FIRST_PLAYER_SEASON ? `<div class="muted" style="margin-top:4px">Click to compare</div>` : ""), event))
        .on("pointermove", (e) => tooltip.move(e))
        .on("pointerleave", () => tooltip.hide())
        .on("click", (event, m) => {
          if (m.season < FIRST_PLAYER_SEASON) return;
          tooltip.hide();
          // Compare with the previous season's MVP when that season is also in the player data.
          const prev = data.mvps.find((p) => p.season === m.season - 1 && p.season >= FIRST_PLAYER_SEASON);
          ctx.go("players", { params: {
            mode: "season", a: { id: m.id, season: m.season }, b: prev ? { id: prev.id, season: prev.season } : undefined,
          } });
        })
        .transition().duration(600)
        .attr("r", (m) => (st.size === "same" ? 6 : size(m.x3pa ?? 0)));
    }

    return {
      step(i) { Object.assign(st, STORY[i]); render(); },
      redraw() { render(); },
    };
  },
};
