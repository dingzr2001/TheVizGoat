// Scrollytelling engine: loads the data, builds the title page and one <section> per chapter, and drives each
// chapter's chart from the text cards scrolling past it. Each chapter module exports
// { id, nav, kicker, title, lede?, opener?, layout?, steps, notes, mount(api) } where mount returns
// { step(i), apply?(params), redraw?() }. step(i) puts the chart in the story state for step i; the reader
// can change it freely with the chapter's controls until the next card scrolls into view.
import { store, tooltip, fmt, seasonLabel } from "./lib.js";
import hook from "./slides/hook.js";
import rise from "./slides/rise.js";
import space from "./slides/space.js";
import eras from "./slides/eras.js";
import scatter from "./slides/scatter.js";
import seasons from "./slides/seasons.js";
import quadrant from "./slides/quadrant.js";
import players from "./slides/players.js";
import mvp from "./slides/mvp.js";
import conclusion from "./slides/conclusion.js";

const SLIDES = [hook, rise, space, eras, scatter, seasons, quadrant, players, mvp, conclusion];

const el = {
  story: document.getElementById("story"),
  hero: document.querySelector(".hero"),
  masthead: document.querySelector(".masthead"),
  current: document.getElementById("current"),
  progress: document.querySelector(".progress span"),
  menuBtn: document.getElementById("menu-btn"),
  menu: document.getElementById("menu"),
  theme: document.getElementById("theme"),
  back: document.getElementById("back"),
};

// Per chapter: { slide, section, graphic, body, controls, text, exploreBtn, stepEls, instance, current, pinned }
const views = [];
let data = null;
let currentChapter = -1;
let returnTo = null;     // { y, chapter, target } after a cross-chapter link, for the "back" chip

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const num = (i) => String(i).padStart(2, "0");

async function loadData() {
  const [league, teams, players, mvps, shots, shotSample, shotTeams] = await Promise.all([
    d3.json("data/league.json"),
    d3.json("data/teams.json"),
    d3.json("data/players.json"),
    d3.json("data/mvp.json"),
    d3.json("data/shots/league.json"),
    d3.json("data/shots/sample.json"),
    d3.json("data/shots/teams.json"),
  ]);
  const teamShotCache = new Map();
  return {
    league, teams, players, mvps, shots, shotSample, shotTeams,
    /** Per-franchise shot bins, fetched the first time a team is chosen. */
    teamShots(id) {
      if (!teamShotCache.has(id)) teamShotCache.set(id, d3.json(`data/shots/teams/${id}.json`));
      return teamShotCache.get(id);
    },
  };
}

const ctx = {
  /** Scroll to a chapter by id, optionally to a step (negative = last) and with parameters for that chapter. */
  go(id, { step = 0, params = null } = {}) {
    const i = SLIDES.findIndex((s) => s.id === id);
    if (i < 0) return;
    if (i !== currentChapter) {
      returnTo = { y: window.scrollY, chapter: currentChapter, target: i };
      el.back.textContent = `↩ Back to ${currentChapter >= 0 ? SLIDES[currentChapter].nav : "the start"}`;
      el.back.hidden = false;
    }
    const v = jumpTo(i, step);
    if (params) {
      v.instance.apply?.(params);
      // The chart no longer shows what the card says, so no card is highlighted until the reader resets or scrolls on.
      v.stepEls.forEach((s) => s.classList.remove("active"));
      v.pinned = true;
      setExplore(v, true);
    }
  },
  store,
};

// ---------------------------------------------------------------- building the page

function buildHero() {
  const [a, z] = [data.league[0], data.league.at(-1)];
  el.hero.querySelector("[data-dek]").innerHTML = `In ${seasonLabel(a.season)}, the first season with a three-point
    line, an average NBA team tried <strong>${fmt.dec1(a.x3pa)}</strong> threes a game. In ${seasonLabel(z.season)} it
    tried <strong>${fmt.dec1(z.x3pa)}</strong>. The league bet on the long shot. Did it pay off?`;
}

function buildChapter(slide, i) {
  const section = document.createElement("section");
  const page = slide.layout === "page";
  section.className = `chapter${page ? " page" : ""}`;
  section.id = slide.id;
  section.dataset.chapter = i;
  section.setAttribute("aria-label", slide.title);

  const lede = slide.lede?.(data);
  // An illustrated opener fills the screen; its tone ("paper" or "navy") fixes the text colors to suit the art.
  // Art with a transparent background has no tone and follows the page theme.
  const art = slide.art;
  const opener = slide.opener === false ? "" : `
    <div class="band${art ? ` art${art.tone ? ` ${art.tone}` : ""}` : ""}">
      ${art ? `<div class="band-img" aria-hidden="true" style="background-image: url('${art.img}');
        --art-pos: ${art.position}; --art-pos-small: ${art.positionSmall}"></div>` : ""}
      <header class="opener${art?.align && art.align !== "center" ? ` ${art.align}` : ""}">
        <div class="kicker">Chapter ${num(i)} · ${slide.kicker}</div>
        <h2>${slide.title}</h2>
        ${lede?.stat ? `<div class="stat">${lede.stat}</div>` : ""}
        ${lede?.caption ? `<p class="caption">${lede.caption}</p>` : ""}
      </header>
    </div>`;
  const stepText = (s) => (typeof s === "function" ? s(data) : s);

  if (page) {
    section.innerHTML = `${opener}
      <div class="page-body" data-chapter="${i}">
        <div class="lead">${slide.steps.map(stepText).join("")}</div>
        <div class="viz-body"></div>
      </div>`;
  } else {
    section.innerHTML = `${opener}
      <div class="scrolly" data-chapter="${i}">
        <figure class="graphic">
          <div class="graphic-head">
            <div class="viz-controls"></div>
            <button class="explore-btn" type="button" aria-expanded="false" hidden>Explore this chart</button>
          </div>
          <div class="viz-body"></div>
          <figcaption class="viz-foot">
            <details><summary>About this data</summary><div>${slide.notes || ""}</div></details>
            <button class="reset-btn" type="button">↺ Back to story view</button>
          </figcaption>
        </figure>
        <div class="steps">${slide.steps.map((s, k) => `
          <article class="step" data-chapter="${i}" data-step="${k}"><div class="card">${stepText(s)}</div></article>`).join("")}
        </div>
      </div>`;
  }
  el.story.appendChild(section);

  const v = {
    slide, section,
    graphic: section.querySelector(".graphic"),
    body: section.querySelector(".viz-body"),
    controls: section.querySelector(".viz-controls") ?? document.createElement("div"),
    text: section.querySelector(".steps, .lead"),
    exploreBtn: section.querySelector(".explore-btn"),
    stepEls: [...section.querySelectorAll(".step")],
    instance: null, current: null, pinned: false,
  };
  v.exploreBtn?.addEventListener("click", () => {
    v.pinned = true;
    setExplore(v, !v.graphic.classList.contains("explore"));
  });
  section.querySelector(".reset-btn")?.addEventListener("click", () => {
    v.pinned = false;
    activate(i, v.current ?? 0, true);
  });
  views.push(v);
}

function buildMenu() {
  el.menu.innerHTML = `<ol>${SLIDES.map((s, i) => `
    <li><a href="#${s.id}" data-go="${i}"><span>${num(i)}</span>${s.title}</a></li>`).join("")}</ol>`;
  el.menu.addEventListener("click", (e) => {
    const a = e.target.closest("[data-go]");
    if (!a) return;
    e.preventDefault();
    toggleMenu(false);
    views[+a.dataset.go].section.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
  });
  el.menuBtn.addEventListener("click", () => toggleMenu());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggleMenu(false); });
  document.addEventListener("click", (e) => {
    if (!el.menu.hidden && !e.target.closest("#menu, #menu-btn")) toggleMenu(false);
  });
}

function toggleMenu(open = el.menu.hidden) {
  el.menu.hidden = !open;
  el.menuBtn.setAttribute("aria-expanded", open);
}

// ---------------------------------------------------------------- story state

function mount(i) {
  const v = views[i];
  if (v.instance) return v;
  v.instance = v.slide.mount({ viz: v.body, controls: v.controls, text: v.text, data, ctx });
  // Chapters without interactive controls (only a legend) don't need the explore toggle.
  if (v.exploreBtn) v.exploreBtn.hidden = !v.controls.querySelector(".ctl:not(.keep)");
  return v;
}

function setExplore(v, on) {
  if (!v.graphic) return;
  v.graphic.classList.toggle("explore", on);
  v.exploreBtn.textContent = on ? "Hide controls" : "Explore this chart";
  v.exploreBtn.setAttribute("aria-expanded", on);
}

/** Put chapter i's chart into story step k (and highlight that card). */
function activate(i, k, force = false) {
  const v = mount(i);
  if (v.current === k && !force) return;
  v.current = k;
  v.stepEls.forEach((s, j) => s.classList.toggle("active", j === k));
  // Controls open by themselves on a chapter's last step, where the text invites the reader to explore.
  if (!v.pinned) setExplore(v, v.stepEls.length > 1 && k === v.stepEls.length - 1);
  tooltip.hide();
  v.instance.step(k);
  if (i === currentChapter) writeHash(i);
}

/** Keep the URL pointing at the chapter and step in view, so it can be shared or reloaded. */
function writeHash(i) {
  const v = views[i];
  const hash = !v ? "" : `#${v.slide.id}${v.current != null ? `/${v.current + 1}` : ""}`;
  history.replaceState(null, "", hash || location.pathname + location.search);
}

/** Scroll straight to chapter i, step k (negative = last step), and put the chart into that step. */
function jumpTo(i, k = 0) {
  const v = mount(i);
  const n = Math.max(1, v.stepEls.length);
  const step = k < 0 ? n - 1 : Math.min(k, n - 1);
  const target = v.stepEls[step];
  if (target) target.scrollIntoView({ block: "center", behavior: "instant" });
  else v.section.scrollIntoView({ block: "start", behavior: "instant" });
  activate(i, step, true);
  setCurrent(i);
  return v;
}

function setCurrent(i) {
  if (i === currentChapter) return;
  currentChapter = i;
  el.current.textContent = i >= 0 ? `${num(i)} · ${SLIDES[i].nav}` : "";
  el.menu.querySelectorAll("[data-go]").forEach((a) => a.classList.toggle("on", +a.dataset.go === i));
  writeHash(i);
  // Once the reader moves on from where a link took them, the way back is no longer useful.
  if (returnTo && i !== returnTo.target) { returnTo = null; el.back.hidden = true; }
}

function observe() {
  // A card is "current" while it crosses the middle of the screen.
  const stepIO = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) activate(+e.target.dataset.chapter, +e.target.dataset.step);
  }), { rootMargin: "-50% 0px -50% 0px" });
  document.querySelectorAll(".step").forEach((s) => stepIO.observe(s));

  // Charts are built and put into their first step as they come into view, so their entry animations are seen.
  const mountIO = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const i = +e.target.dataset.chapter;
    if (views[i].current == null) activate(i, 0);
    mountIO.unobserve(e.target);
  }), { rootMargin: "0px 0px -10% 0px" });
  document.querySelectorAll(".scrolly, .page-body").forEach((s) => mountIO.observe(s));

  const chapterIO = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) setCurrent(e.target === el.hero ? -1 : +e.target.dataset.chapter);
  }), { rootMargin: "-50% 0px -50% 0px" });
  [el.hero, ...views.map((v) => v.section)].forEach((s) => chapterIO.observe(s));

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      el.progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
      el.masthead.classList.toggle("solid", window.scrollY > window.innerHeight * 0.5);
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  el.back.addEventListener("click", () => {
    if (!returnTo) return;
    const { y, chapter } = returnTo;
    returnTo = null;
    el.back.hidden = true;
    window.scrollTo({ top: y, behavior: "instant" });
    setCurrent(chapter);
  });
}

// ---------------------------------------------------------------- hash, theme

function fromHash() {
  const [id, step] = location.hash.slice(1).split("/");
  const i = SLIDES.findIndex((s) => s.id === id);
  return i < 0 ? null : [i, Math.max(0, (+step || 1) - 1)];
}

function redrawAll() {
  views.forEach((v) => v.instance?.redraw?.());
}

function setupTheme() {
  const saved = store.get("theme");
  if (saved) document.documentElement.dataset.theme = saved;
  el.theme.addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const t = dark ? "light" : "dark";
    document.documentElement.dataset.theme = t;
    store.set("theme", t);
    redrawAll();
  });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redrawAll);
}

async function init() {
  setupTheme();
  try {
    data = await loadData();
  } catch (err) {
    el.hero.insertAdjacentHTML("beforeend", `<p class="load-error">Could not load the data files (${err.message}).
      Serve this folder over HTTP, e.g. <code>python3 -m http.server</code>, then open http://localhost:8000.</p>`);
    return;
  }
  buildHero();
  SLIDES.forEach(buildChapter);
  buildMenu();
  observe();
  const target = fromHash();
  if (target) requestAnimationFrame(() => jumpTo(...target));
  window.addEventListener("hashchange", () => {
    const t = fromHash();
    if (t) jumpTo(...t);
  });
}

init();
