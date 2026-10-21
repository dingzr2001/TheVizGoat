// 00 · Opening: the same number of shots from 2003-04 and 2024-25 on one court, then a guess.
import { drawCourt, COURT_DEPTH } from "../court.js";
import { svgIn, legend, fmt, store } from "../lib.js";

export const GUESSES = [
  ["volume", "Teams that take more of their shots from three"],
  ["accuracy", "Teams that make a higher share of their threes"],
  ["both", "Both about equally"],
  ["neither", "Neither — threes don't predict winning"],
];

const K = 14;                 // pixels per foot
const M = { top: 34, right: 20, bottom: 12, left: 20 };

function shares(data, season) {
  const s = data.shots.seasons[season];
  const z = s.zones.map((d) => d[0] / s.fga);
  return { three: z[3] + z[4], mid: z[2] };
}

export default {
  id: "intro",
  nav: "Intro",
  kicker: "The question",
  title: "Shoot more, win more?",
  opener: false,          // the title page introduces this chapter
  steps: [
    (d) => `<p>Watch any NBA game today and you will see a lot of three-pointers. Fans like to say the modern
      game is <em>all about the three</em>.</p>
      <p>Each dot on the court is one real shot from the <strong>2003-04</strong> season (a random sample of
      1,600). Back then, <span class="key-num">${fmt.pct0(shares(d, 2004).three)}</span> of shots were threes and
      <span class="key-num">${fmt.pct0(shares(d, 2004).mid)}</span> were mid-range jumpers.</p>`,
    (d) => `<p>Now the same number of shots from <strong>2024-25</strong>. Each dot moves to the shot of the same
      distance rank in the newer season.</p>
      <p>Three-pointers rose to <span class="key-num">${fmt.pct0(shares(d, 2025).three)}</span> of all attempts, and
      the mid-range nearly disappeared (<span class="key-num">${fmt.pct0(shares(d, 2025).mid)}</span>).</p>`,
    () => `<p>So teams shoot far more threes. But <strong>does shooting more threes mean winning more?</strong></p>
      <p>Before you see the evidence, make a guess. Within a single season, which teams tend to win more?</p>
      <div class="poll" role="group" aria-label="Your guess">
        ${GUESSES.map(([v, t]) => `<button type="button" data-guess="${v}">${t}</button>`).join("")}
      </div>
      <p class="muted" data-guess-note></p>`,
  ],
  notes: `Shots: every regular-season field-goal attempt from NBA.com, via the
    <a href="https://github.com/DomSamangy/NBA_Shots_04_25" target="_blank" rel="noopener">NBA_Shots_04_25</a> dataset.
    1,600 attempts were sampled at random from each season, limited to the half court (38 ft from the baseline).`,

  mount({ viz, controls, text, data }) {
    const W = 50 * K + M.left + M.right;
    const H = COURT_DEPTH * K + M.top + M.bottom;
    const svg = svgIn(viz, W, H);
    const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
    const { x, y } = drawCourt(g, K);
    const yearLabel = svg.append("text").attr("class", "chart-title")
      .attr("x", M.left).attr("y", 22).style("font-size", "18px").text("2003-04 season");

    legend(controls, [
      { label: "2-point attempt", color: "var(--series-1)" },
      { label: "3-point attempt", color: "var(--series-2)" },
    ]);

    // Pair the k-th closest shot of 2004 with the k-th closest shot of 2025.
    const dist = (s) => Math.hypot(s[0], s[1] - 5.25);
    const a = [...data.shotSample[2004]].sort((p, q) => dist(p) - dist(q));
    const b = [...data.shotSample[2025]].sort((p, q) => dist(p) - dist(q));
    const pairs = a.map((s, i) => ({ from: s, to: b[i] }));
    const color = (s) => (s[3] >= 3 ? "var(--series-2)" : "var(--series-1)");

    const dots = g.append("g").selectAll("circle").data(pairs).join("circle")
      .attr("r", 3.2)
      .attr("fill-opacity", 0.75)
      .attr("cx", (d) => x(d.from[0])).attr("cy", (d) => y(d.from[1]))
      .attr("fill", (d) => color(d.from));

    let shown = 2004;
    function showSeason(season) {
      if (season === shown) return;
      shown = season;
      yearLabel.text(season === 2004 ? "2003-04 season" : "2024-25 season");
      const key = season === 2004 ? "from" : "to";
      dots.transition().duration(1400).delay((d, i) => (i / pairs.length) * 900).ease(d3.easeCubicInOut)
        .attr("cx", (d) => x(d[key][0])).attr("cy", (d) => y(d[key][1]))
        // d3 can't interpolate between two var() colors, so the color switches as each dot starts moving.
        .on("start", function (d) { d3.select(this).attr("fill", color(d[key])); });
    }

    // Poll: remember the reader's guess so the last chapter can refer back to it.
    const note = () => text.querySelector("[data-guess-note]");
    function markGuess(v) {
      text.querySelectorAll("[data-guess]").forEach((btn) => btn.classList.toggle("chosen", btn.dataset.guess === v));
      if (note() && v) note().textContent = "Got it. We'll come back to your guess at the end.";
    }
    text.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-guess]");
      if (!btn) return;
      store.set("guess", btn.dataset.guess);
      markGuess(btn.dataset.guess);
    });
    markGuess(store.get("guess"));

    return {
      step(i) { showSeason(i === 0 ? 2004 : 2025); },
    };
  },
};
