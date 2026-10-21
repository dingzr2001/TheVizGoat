// 09 · Answer the opening question, recall the reader's guess, and open everything up for exploration.
import { fmt, seasonLabel } from "../lib.js";
import { GUESSES } from "./hook.js";
import { seasonCorr } from "./scatter.js";

const VERDICT = {
  accuracy: "Your guess matches the evidence.",
  volume: "The evidence points the other way.",
  both: "Partly. Accuracy mattered much more than volume.",
  neither: "Half right. Volume says little, but accuracy says a lot.",
};

const EXPLORE = [
  ["rise", "Trend since 1979-80"],
  ["space", "Shot charts by team & season"],
  ["eras", "Compare any two eras"],
  ["core", "Volume vs accuracy, any season"],
  ["seasons", "Correlation by season"],
  ["quadrant", "Team cases & shooters"],
  ["players", "Compare any two players"],
  ["mvp", "MVP positions"],
];

function findings(data) {
  const L = data.league;
  const corr = [...new Set(data.teams.filter((t) => t.x3pPct != null).map((t) => t.season))].map((s) => ({ s, ...seasonCorr(data, s) }));
  const recent = corr.filter((c) => c.s >= 2010);
  const z04 = data.shots.seasons[2004], z25 = data.shots.seasons[2025];
  return {
    rate: [L[0].x3pRate, L.at(-1).x3pRate],
    mid: [z04.zones[2][0] / z04.fga, z25.zones[2][0] / z25.fga],
    rRate: d3.mean(recent, (c) => c.rate),
    rPct: d3.mean(recent, (c) => c.pct),
    wins: corr.filter((c) => c.pct > c.rate).length,
    n: corr.length,
  };
}

export default {
  id: "answer",
  nav: "Answer",
  kicker: "Conclusion",
  title: "Shoot more, win more? Not by itself.",
  art: { img: "img/trophy.jpg", tone: "paper", align: "center", position: "left bottom", positionSmall: "left bottom" },
  layout: "page",
  steps: [
    `<p>The NBA really did become a three-point league. But within a season, <strong>shooting more threes</strong> has had
      only a weak link to winning, and close to none in the 2020s, now that everyone shoots them.</p>
      <p>What separates winners is <strong>how well</strong> those shots go in, and how efficient the whole offense is.</p>
      <p class="muted">Every chart above can be explored on its own: use its ⚙ Explore button, or jump to one below.</p>`,
  ],
  notes: `See the "Data &amp; methods" section in this panel.`,

  mount({ viz, data, ctx }) {
    function render() {
      const f = findings(data);
      const guess = ctx.store.get("guess");
      const guessText = GUESSES.find(([v]) => v === guess)?.[1];
      viz.innerHTML = `<div class="conclusion-body">
        <div class="finding" style="margin-bottom:12px">
          ${guessText
            ? `<div class="muted">At the start you guessed: <strong style="color:var(--ink)">${guessText}</strong></div>
               <div style="font-size:18px;font-weight:600;margin-top:4px">${VERDICT[guess]}</div>`
            : `<div class="muted">You skipped the guess at the start. <a href="#intro/3">Go back and make one</a>.</div>`}
        </div>
        <div class="findings">
          <div class="finding"><div class="big">${fmt.pct0(f.rate[0])} → ${fmt.pct0(f.rate[1])}</div>
            <p>Share of shots taken from three, 1979-80 to 2025-26.</p></div>
          <div class="finding"><div class="big">${fmt.pct0(f.mid[0])} → ${fmt.pct0(f.mid[1])}</div>
            <p>Share of shots from mid-range, 2003-04 to 2024-25. That's the least valuable shot on the floor.</p></div>
          <div class="finding"><div class="big">r ${fmt.r(f.rRate)} vs ${fmt.r(f.rPct)}</div>
            <p>Average correlation with win% since 2009-10: three-point <em>volume</em> vs three-point <em>accuracy</em>.</p></div>
          <div class="finding"><div class="big">${f.wins} of ${f.n}</div>
            <p>Seasons in which accuracy was more closely tied to winning than volume.</p></div>
        </div>

        <h3>What this does and doesn't show</h3>
        <ul class="methods">
          <li>These are <strong>associations within each season</strong>, not causes. Teams that shoot threes well are often
            good in other ways too (talent, spacing, coaching).</li>
          <li>League-wide offensive efficiency rose over the same years as the move to threes (chapter 3). This site doesn't
            test whether one caused the other; it shows that, within a season, volume no longer separates teams.</li>
          <li>Regular season only. Shot locations cover 2003-04 to 2024-25; team stats run to 2025-26.</li>
        </ul>

        <h3>Explore</h3>
        <div>${EXPLORE.map(([id, label]) => `<button class="link-btn" data-go="${id}">${label} →</button>`).join("")}</div>

        <h3>Data &amp; methods</h3>
        <ul class="methods">
          <li><strong>Team, player and award tables:</strong> Basketball-Reference, via Sumitro Datta's
            <a href="https://www.kaggle.com/datasets/sumitrodatta/nba-aba-baa-stats" target="_blank" rel="noopener">NBA Stats (1947-present)</a> on Kaggle.</li>
          <li><strong>Shot locations:</strong> NBA.com shot charts, via
            <a href="https://github.com/DomSamangy/NBA_Shots_04_25" target="_blank" rel="noopener">DomSamangy/NBA_Shots_04_25</a>
            (${fmt.int(d3.sum(Object.values(data.shots.seasons), (s) => s.fga))} shots, ${seasonLabel(2004)} to ${seasonLabel(2025)}).</li>
          <li>Volume = 3PA ÷ FGA; accuracy = 3PM ÷ 3PA; true shooting % = PTS ÷ (2 × (FGA + 0.44 × FTA)); r = Pearson
            correlation across teams within a season.</li>
          <li>Rule-change dates come from the NBA's rule history. Processing scripts are in <code>scripts/</code>.</li>
        </ul>
        <p class="muted">CS 6730 · Team TheVizG.O.A.T: Kunhao Ni, Qixiang (David) Fan, Yurun Zhu, Zhaorui Ding, Jun Woo Beck.</p>
      </div>`;
      viz.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => ctx.go(b.dataset.go, { step: -1 })));
    }
    return { step() { render(); }, redraw() { render(); } };
  },
};
