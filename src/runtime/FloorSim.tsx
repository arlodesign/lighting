"use client";
import React, { useMemo } from "react";
import { FIXTURE_CONFIG, getFixture } from "@/data/fixtures";

/**
 * FloorSim renders an HTML-based, accessible top-down view of the stage.
 * - Downstage (DS) is at the TOP of the box; Upstage (US) at the bottom
 * - Stage Left (SL) on the left half; Stage Right (SR) on the right half
 * - Dots are positioned by slot within each side/row
 */
export function FloorSim({
  levels,
  width,
}: {
  levels: Record<number, number>;
  width: number;
}) {
  const dims = useMemo(() => {
    const w = Math.round(width);
    const h = Math.max(72, Math.min(120, Math.round(width * 0.14))); // compact strip height
    return { w, h };
  }, [width]);

  // Downstage fixtures split by Stage Left (SL) and Stage Right (SR)
  const leftDS = useMemo(
    () =>
      FIXTURE_CONFIG.filter(
        (f) => f.location.y === "DS" && f.location.x === "SL"
      ).sort((a, b) => a.location.slot - b.location.slot),
    []
  );
  const rightDS = useMemo(
    () =>
      FIXTURE_CONFIG.filter(
        (f) => f.location.y === "DS" && f.location.x === "SR"
      ).sort((a, b) => a.location.slot - b.location.slot),
    []
  );

  return (
    <div
      className="rounded border border-zinc-600 bg-black/60 px-4 py-3"
      style={{ width: dims.w }}
      aria-label="Downstage fixtures"
    >
      <div
        className="flex items-center justify-center gap-10"
        style={{ minHeight: dims.h }}
      >
        {/* Stage Left group */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${leftDS.length}, minmax(0,1fr))`,
            gap: 16,
          }}
        >
          {leftDS.map((fc) => (
            <FixtureChip
              key={fc.id}
              id={fc.id}
              levels={levels}
              width={dims.w}
            />
          ))}
        </div>
        {/* Spacer to visually separate SL and SR */}
        <div aria-hidden="true" style={{ width: 40 }} />
        {/* Stage Right group */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${rightDS.length}, minmax(0,1fr))`,
            gap: 16,
          }}
        >
          {rightDS.map((fc) => (
            <FixtureChip
              key={fc.id}
              id={fc.id}
              levels={levels}
              width={dims.w}
            />
          ))}
        </div>
      </div>
    </div>
  );

  function FixtureChip({
    id,
    levels,
    width,
  }: {
    id: import("@/data/fixtures").FixtureId;
    levels: Record<number, number>;
    width: number;
  }) {
    const fx = getFixture(id);
    const addr = (label: import("@/data/fixtures").LedParLabel) =>
      fx.getAddress(label);
    const r = (levels[addr("r")] ?? fx.getValue("r") ?? 0) as number;
    const g = (levels[addr("g")] ?? fx.getValue("g") ?? 0) as number;
    const b = (levels[addr("b")] ?? fx.getValue("b") ?? 0) as number;
    const master = (levels[addr("master")] ??
      fx.getValue("master") ??
      0) as number;
    const size = Math.max(18, Math.min(24, Math.round(width * 0.022)));
    const alpha = Math.max(0.2, Math.min(0.95, master / 255));
    return (
      <div className="flex flex-col items-center min-w-[40px]">
        <div
          className="rounded-full border"
          style={{
            width: size,
            height: size,
            backgroundColor: `rgb(${r}, ${g}, ${b})`,
            opacity: alpha,
            borderColor: "#a1a1aa",
          }}
          role="img"
          aria-label={`${id}, master ${Math.round((master / 255) * 100)}%`}
        />
        <div
          className="mt-1 text-[11px] leading-none text-zinc-200"
          style={{ textShadow: "0 1px 0 #000" }}
        >
          {id}
        </div>
      </div>
    );
  }
}

function FixtureDot({
  id,
  x,
  y,
  slot,
  maxSlotSL,
  maxSlotSR,
  levels,
}: {
  id: string;
  x: "SL" | "SR";
  y: "DS" | "US";
  slot: number;
  maxSlotSL: number;
  maxSlotSR: number;
  levels: Record<number, number>;
}) {
  const fx = getFixture(id as import("@/data/fixtures").FixtureId);
  const addr = (label: import("@/data/fixtures").LedParLabel) =>
    fx.getAddress(label);

  // DS at top (0.15), US at bottom (0.85)
  const yNorm = y === "DS" ? 0.15 : 0.85;

  // Spread slots evenly within each side half, avoid edge collisions
  const halfPadding = 0.06; // inner margin per half
  const slotsInSide = x === "SL" ? maxSlotSL : maxSlotSR;
  const t = (slot - 0.5) / slotsInSide; // 0..1 within side
  const xWithinHalf = halfPadding + (1 - 2 * halfPadding) * t;
  const xNorm = x === "SL" ? xWithinHalf * 0.5 : 0.5 + xWithinHalf * 0.5;

  const r = (levels[addr("r")] ?? fx.getValue("r") ?? 0) as number;
  const g = (levels[addr("g")] ?? fx.getValue("g") ?? 0) as number;
  const b = (levels[addr("b")] ?? fx.getValue("b") ?? 0) as number;
  const master = (levels[addr("master")] ??
    fx.getValue("master") ??
    0) as number;

  const size = 22;
  const left = `calc(${(xNorm * 100).toFixed(3)}% - ${size / 2}px)`;
  const top = `calc(${(yNorm * 100).toFixed(3)}% - ${size / 2}px)`;
  const alpha = Math.max(0.15, Math.min(0.95, master / 255));

  return (
    <div
      className="absolute"
      style={{ left, top, width: size, height: size, textAlign: "center" }}
    >
      <div
        className="rounded-full border"
        style={{
          width: size,
          height: size,
          backgroundColor: `rgb(${r}, ${g}, ${b})`,
          opacity: alpha,
          borderColor: "#a1a1aa", // zinc-400
        }}
        role="img"
        aria-label={`${id}, master ${Math.round((master / 255) * 100)}%`}
      />
      <div
        className="mt-1 text-[11px] leading-none text-zinc-200"
        style={{ textShadow: "0 1px 0 #000" }}
      >
        {id}
      </div>
    </div>
  );
}
