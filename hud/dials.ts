/**
 * The knob dials on the display. Knobs with ends get an arc with a start and an end; knobs
 * that wrap around get a ring with no ends, so the picture matches how the knob behaves:
 *  - hue:     a color wheel, with a pointer on the color you get
 *  - palette: a ring of dots, one per palette, in its color
 *  - shape:   a ring of segments, one per option
 * All drawn in a 40×40 SVG viewBox.
 */
import { hsv, type Rgb } from "../src/engine/color.ts";

const NS = "http://www.w3.org/2000/svg";
const FAINT = "#2b2824";

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** A point on a circle around the center; turn 0 = top, increasing clockwise. */
function point(turn: number, r: number): string {
  const a = turn * 2 * Math.PI;
  return `${(20 + r * Math.sin(a)).toFixed(2)} ${(20 - r * Math.cos(a)).toFixed(2)}`;
}

function arcPath(from: number, to: number, r: number): string {
  const large = to - from > 0.5 ? 1 : 0;
  return `M ${point(from, r)} A ${r} ${r} 0 ${large} 1 ${point(to, r)}`;
}

export const css = ({ r, g, b }: Rgb) =>
  `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;

function base(): SVGSVGElement {
  return svgEl("svg", { viewBox: "0 0 40 40", "aria-hidden": "true" });
}

export interface ArcDial {
  svg: SVGSVGElement;
  /** `t` 0–1 of the way along the arc. */
  update(t: number): void;
}

/** A 270° arc from bottom-left to bottom-right, for knobs that have ends. */
export function arcDial(): ArcDial {
  const svg = base();
  const START = -0.375; // bottom-left
  const SPAN = 0.75;
  const stroke = { fill: "none", "stroke-width": 4, "stroke-linecap": "round" };
  svg.append(
    svgEl("path", {
      ...stroke,
      d: arcPath(START, START + SPAN, 16),
      stroke: FAINT,
    }),
  );
  const fill = svgEl("path", { ...stroke, stroke: "var(--ink)" });
  svg.append(fill);
  return {
    svg,
    update(t) {
      const clamped = Math.max(0.001, Math.min(1, t));
      fill.setAttribute("d", arcPath(START, START + SPAN * clamped, 16));
    },
  };
}

export interface HueDial {
  svg: SVGSVGElement;
  /** `keyHue`: the palette's main color (turns). `shift`: the hue knob (turns). */
  update(keyHue: number, shift: number): void;
}

/**
 * A color wheel starting at the palette's main color. The pointer sits on the color you
 * get, and the dot in the middle shows it.
 */
export function hueDial(): HueDial {
  const svg = base();
  const SEGMENTS = 24;
  const segments = Array.from({ length: SEGMENTS }, (_, k) => {
    const seg = svgEl("path", {
      d: arcPath(k / SEGMENTS + 0.004, (k + 1) / SEGMENTS - 0.004, 15),
      fill: "none",
      "stroke-width": 4,
    });
    svg.append(seg);
    return seg;
  });
  const pointer = svgEl("circle", {
    r: 3.6,
    fill: "none",
    stroke: "var(--ink)",
    "stroke-width": 1.6,
  });
  const middle = svgEl("circle", { cx: 20, cy: 20, r: 6 });
  svg.append(pointer, middle);
  let lastKey = NaN;
  return {
    svg,
    update(keyHue, shift) {
      if (keyHue !== lastKey) {
        segments.forEach((seg, k) =>
          seg.setAttribute(
            "stroke",
            css(hsv(keyHue + (k + 0.5) / SEGMENTS, 1, 1)),
          ),
        );
        lastKey = keyHue;
      }
      const [x, y] = point(shift, 15).split(" ");
      pointer.setAttribute("cx", x!);
      pointer.setAttribute("cy", y!);
      middle.setAttribute("fill", css(hsv(keyHue + shift, 1, 1)));
    },
  };
}

export interface DotsDial {
  svg: SVGSVGElement;
  update(index: number, colors: readonly string[]): void;
}

/** One dot per option around a ring (palettes): the current one is bigger and outlined. */
export function dotsDial(count: number): DotsDial {
  const svg = base();
  const dots = Array.from({ length: count }, (_, i) => {
    const [cx, cy] = point(i / count, 15).split(" ");
    const dot = svgEl("circle", { cx: cx!, cy: cy!, r: 2 });
    svg.append(dot);
    return dot;
  });
  let lastIndex = -1;
  return {
    svg,
    update(index, colors) {
      dots.forEach((dot, i) => {
        dot.setAttribute("fill", colors[i] ?? FAINT);
        if (i === index) {
          dot.setAttribute("r", "3.6");
          dot.setAttribute("stroke", "var(--ink)");
          dot.setAttribute("stroke-width", "1.4");
        } else if (i === lastIndex || lastIndex === -1) {
          dot.setAttribute("r", "2");
          dot.removeAttribute("stroke");
        }
      });
      lastIndex = index;
    },
  };
}

export interface SegmentDial {
  svg: SVGSVGElement;
  update(index: number): void;
}

/** One segment per option around a ring (shapes): the current one is lit. */
export function segmentDial(count: number): SegmentDial {
  const svg = base();
  const gap = 0.03;
  const segments = Array.from({ length: count }, (_, i) => {
    const seg = svgEl("path", {
      d: arcPath(i / count + gap - 0.125, (i + 1) / count - gap - 0.125, 15),
      fill: "none",
      "stroke-width": 4,
      "stroke-linecap": "round",
      stroke: FAINT,
    });
    svg.append(seg);
    return seg;
  });
  return {
    svg,
    update(index) {
      segments.forEach((seg, i) =>
        seg.setAttribute("stroke", i === index ? "var(--ink)" : FAINT),
      );
    },
  };
}
