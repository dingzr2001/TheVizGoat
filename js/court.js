// Half-court drawing in feet. Shot data uses x in [-25, 25] (sideline to sideline)
// and y = feet from the baseline, with the hoop at (0, 5.25). The baseline is drawn at the top.

export const HEX_RADIUS = 1.0;          // must match HEX_RADIUS in scripts/build_data.py
export const COURT_DEPTH = 38;          // feet of court shown below the baseline
const HOOP_Y = 5.25;
const THREE_R = 23.75;
const CORNER_X = 22;
const CORNER_Y = HOOP_Y + Math.sqrt(THREE_R ** 2 - CORNER_X ** 2);

export const HEX_DX = HEX_RADIUS * 2 * Math.sin(Math.PI / 3);
export const HEX_DY = HEX_RADIUS * 1.5;

/** Center (in feet) of the hexagon with integer index (i, j), as produced by build_data.py. */
export function hexCenter(i, j) {
  return [(i + (j & 1) / 2) * HEX_DX, j * HEX_DY];
}

/** Pointy-top hexagon path of radius r pixels, centered on (0, 0). */
export function hexPath(r) {
  const pts = d3.range(6).map((k) => {
    const a = (k * Math.PI) / 3;
    return [Math.sin(a) * r, -Math.cos(a) * r];
  });
  return "M" + pts.map((p) => p.map((v) => v.toFixed(2)).join(",")).join("L") + "Z";
}

/**
 * Draw court lines into `g`. `k` is pixels per foot.
 * Returns { x(ft), y(ft) } converters for plotting shots in the same group.
 */
export function drawCourt(g, k) {
  const x = (ft) => (ft + 25) * k;
  const y = (ft) => ft * k;
  const court = g.append("g").attr("class", "court");

  court.append("rect").attr("class", "floor")
    .attr("x", 0).attr("y", 0).attr("width", 50 * k).attr("height", COURT_DEPTH * k);
  // Sidelines and baseline.
  court.append("path").attr("d", `M${x(-25)},${y(COURT_DEPTH)} V${y(0)} H${x(25)} V${y(COURT_DEPTH)}`);
  // Paint and free-throw circle.
  court.append("rect").attr("x", x(-8)).attr("y", y(0)).attr("width", 16 * k).attr("height", 19 * k);
  court.append("circle").attr("cx", x(0)).attr("cy", y(19)).attr("r", 6 * k);
  // Backboard, rim, restricted area.
  court.append("line").attr("x1", x(-3)).attr("x2", x(3)).attr("y1", y(4)).attr("y2", y(4));
  court.append("circle").attr("cx", x(0)).attr("cy", y(HOOP_Y)).attr("r", 0.75 * k);
  court.append("path").attr("d", `M${x(-4)},${y(HOOP_Y)} A${4 * k},${4 * k} 0 0 0 ${x(4)},${y(HOOP_Y)}`);
  // Three-point line: straight corners, then the 23.75 ft arc.
  court.append("path").attr("d",
    `M${x(-CORNER_X)},${y(0)} V${y(CORNER_Y)} A${THREE_R * k},${THREE_R * k} 0 0 0 ${x(CORNER_X)},${y(CORNER_Y)} V${y(0)}`);
  return { x, y };
}
