// Shared helpers: formatting, statistics, theme colors, tooltip and small UI controls.
/* global d3 */

export const fmt = {
  pct: d3.format(".1%"),
  pct0: d3.format(".0%"),
  dec1: d3.format(".1f"),
  dec2: d3.format(".2f"),
  dec3: d3.format(".3f"),
  r: d3.format("+.2f"),
  int: d3.format(",d"),
  winPct: (v) => d3.format(".3f")(v).replace(/^0/, ""),
};

/** "2016" -> "2015-16" (seasons are labelled by the year they end). */
export const seasonLabel = (s) => `${s - 1}-${String(s).slice(2)}`;

// ---------------------------------------------------------------- statistics

export function pearson(xs, ys) {
  const n = xs.length;
  const mx = d3.mean(xs), my = d3.mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxy / Math.sqrt(sxx * syy);
}

export function linreg(xs, ys) {
  const mx = d3.mean(xs), my = d3.mean(ys);
  let sxy = 0, sxx = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

/** Percentile rank (0-100) of v in sortedValues; ties count half, so many equal values don't inflate it. */
export function percentile(sortedValues, v) {
  const below = d3.bisectLeft(sortedValues, v), atOrBelow = d3.bisectRight(sortedValues, v);
  return ((below + atOrBelow) / 2 / sortedValues.length) * 100;
}

// ---------------------------------------------------------------- theme

export function isDark() {
  const t = document.documentElement.dataset.theme;
  if (t) return t === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Single-hue blue ramp for magnitude; in dark mode low values recede into the dark surface. */
export function sequentialInterpolator() {
  return isDark()
    ? d3.interpolateRgbBasis(["#1d2a3a", "#184f95", "#3987e5", "#86b6ef", "#cde2fb"])
    : d3.interpolateRgbBasis(["#eef4fc", "#b7d3f6", "#6da7ec", "#2a78d6", "#104281"]);
}

/** Ordinal-safe blue ramp for scatter dots (the faintest step still clears 2:1 on the page, navy in dark mode). */
export function ordinalBlue() {
  return isDark()
    ? d3.interpolateRgb("#3170c4", "#dbe9fc")
    : d3.interpolateRgb("#86b6ef", "#0d366b");
}

/** Blue <-> gray <-> red diverging ramp (blue = below the midpoint, red = above). */
export function divergingInterpolator() {
  const mid = isDark() ? "#383835" : "#e7e6e1";
  return isDark()
    ? d3.interpolateRgbBasis(["#3987e5", "#25456b", mid, "#7a2f2f", "#e66767"])
    : d3.interpolateRgbBasis(["#1c5cab", "#86b6ef", mid, "#f0a3a2", "#c23b3a"]);
}

// ---------------------------------------------------------------- tooltip

const tipEl = document.createElement("div");
tipEl.className = "tooltip";
tipEl.setAttribute("role", "status");
document.body.appendChild(tipEl);

export const tooltip = {
  show(html, event) {
    tipEl.innerHTML = html;
    tipEl.classList.add("show");
    this.move(event);
  },
  move(event) {
    if (!event) return;
    const pad = 14;
    const { innerWidth: W, innerHeight: H } = window;
    const r = tipEl.getBoundingClientRect();
    let x = event.clientX + pad, y = event.clientY + pad;
    if (x + r.width > W - 8) x = event.clientX - r.width - pad;
    if (y + r.height > H - 8) y = event.clientY - r.height - pad;
    tipEl.style.left = `${Math.max(8, x)}px`;
    tipEl.style.top = `${Math.max(8, y)}px`;
  },
  hide() { tipEl.classList.remove("show"); },
};

/** Build a tooltip body from a title and [label, value] rows. */
export function tipHtml(title, rows) {
  return `<b>${title}</b>` + rows.map(([k, v]) => `<div class="row"><span>${k}</span><span>${v}</span></div>`).join("");
}

// ---------------------------------------------------------------- DOM / SVG

export function svgIn(el, width, height) {
  return d3.select(el).append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");
}

// Only a <select> gets a <label> wrapper: a label around buttons would forward clicks to them.
function ctlWrap(parent, label, tag = "span") {
  const wrap = document.createElement(tag);
  wrap.className = "ctl";
  if (label) wrap.append(label);
  parent.appendChild(wrap);
  return wrap;
}

/** Segmented button group. Returns { set(value), get() }. */
export function segmented(parent, label, options, value, onChange) {
  const wrap = ctlWrap(parent, label);
  const seg = document.createElement("span");
  seg.className = "seg";
  seg.setAttribute("role", "group");
  wrap.appendChild(seg);
  let current = value;
  const buttons = options.map(([v, text]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.addEventListener("click", (e) => { e.preventDefault(); set(v); onChange(v); });
    seg.appendChild(b);
    return [v, b];
  });
  function set(v) {
    current = v;
    buttons.forEach(([bv, b]) => {
      b.classList.toggle("on", bv === v);
      b.setAttribute("aria-pressed", bv === v);
    });
  }
  set(value);
  return { set, get: () => current, el: wrap };
}

/** <select>. options: [value, text][]. Returns { set(value), get(), setOptions() }. */
export function selectBox(parent, label, options, value, onChange) {
  const wrap = ctlWrap(parent, label, "label");
  const sel = document.createElement("select");
  wrap.appendChild(sel);
  function setOptions(opts) {
    sel.innerHTML = "";
    opts.forEach(([v, text]) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = text;
      sel.appendChild(o);
    });
  }
  setOptions(options);
  sel.value = value;
  sel.addEventListener("change", () => onChange(sel.value));
  return { set: (v) => { sel.value = v; }, get: () => sel.value, setOptions, el: wrap };
}

/** Season slider with a play button. Returns { set(season), stop() }. */
export function seasonSlider(parent, min, max, value, onChange) {
  const wrap = ctlWrap(parent, "");
  const play = document.createElement("button");
  play.type = "button";
  play.className = "play-btn";
  play.title = "Play through seasons";
  play.textContent = "▶";
  const input = document.createElement("input");
  input.type = "range";
  input.min = min; input.max = max; input.step = 1; input.value = value;
  input.setAttribute("aria-label", "Season");
  const out = document.createElement("span");
  out.style.minWidth = "58px";
  out.style.fontVariantNumeric = "tabular-nums";
  wrap.append(play, input, out);
  let timer = null;
  const show = (v) => { out.textContent = seasonLabel(+v); };
  show(value);
  input.addEventListener("input", () => { show(input.value); onChange(+input.value); });
  function stop() { clearInterval(timer); timer = null; play.textContent = "▶"; }
  play.addEventListener("click", (e) => {
    e.preventDefault();
    if (timer) return stop();
    if (+input.value >= max) input.value = min;
    play.textContent = "❚❚";
    timer = setInterval(() => {
      const v = +input.value + 1;
      if (v > max) return stop();
      input.value = v; show(v); onChange(v);
    }, 700);
  });
  return { set: (v) => { input.value = v; show(v); }, stop, el: wrap };
}

/** Legend row: items are { label, color, type: "swatch" | "line" }. */
export function legend(parent, items) {
  const el = document.createElement("div");
  el.className = "legend";
  el.innerHTML = items.map((d) =>
    `<span><span class="${d.type === "line" ? "ln" : "sw"}" style="background:${d.color}"></span>${d.label}</span>`
  ).join("");
  parent.appendChild(el);
  return el;
}

// ---------------------------------------------------------------- storage (per-viewer convenience only)

export const store = {
  get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key, v) { try { window.localStorage.setItem(key, v); } catch { /* storage unavailable */ } },
};
