"use client";
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Universe } from "@/data/universe";
import { applySparsePatch } from "@/data/universe/apply";
import { DEFAULT_KEYMAP } from "./keys";
import { NoopTransport } from "./transport";
import { SceneManager } from "./sceneManager";
import type { KeyMap, Show } from "./types";
import { FloorSim } from "./FloorSim";
import Link from "next/link";

// Simple 2D canvas runner (p5 can be integrated later). Keeps 4:3 aspect (800x600 logical).
const ASPECT = 4 / 3;
const LOGICAL_W = 800;
const LOGICAL_H = 600;

export function ShowRunner({
  show,
  keymap = DEFAULT_KEYMAP,
  initialSceneId,
  initialLook,
  onNavigate,
}: {
  show: Show;
  keymap?: KeyMap;
  initialSceneId?: string;
  initialLook?: 1 | 2 | 3 | 4;
  onNavigate?: (sceneId: string, look: 1 | 2 | 3 | 4) => void;
  // Optional hook to gate URL updates until transitions complete
  onNavigateReady?: (sceneId: string, look: 1 | 2 | 3 | 4) => void;
}) {
  const p5CanvasElRef = useRef<HTMLCanvasElement | null>(null);
  const p5ContainerRef = useRef<HTMLDivElement | null>(null);
  const p5Ref = useRef<any>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef<HTMLDivElement | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [, setUiVersion] = useState(0); // nudge React to reflect look changes instantly

  const manager = useMemo(() => new SceneManager(show, keymap), [show, keymap]);

  // Initialize from URL-derived props once per manager instance
  // Ensure initial scene/look are applied before first paint to avoid flicker
  useLayoutEffect(() => {
    if (!manager) return;
    if (initialSceneId) manager.setSceneById(initialSceneId);
    if (initialLook) manager.setLook(initialLook);
    const scId = manager.currentScene().id;
    onNavigate?.(scId, manager.getState().lookIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Defer URL updates until transitions (e.g., look crossfade) complete
    const onMaybeNavigateReady = () => {
      const st = manager.getState();
      const ready = !st.lookCrossfadeActive;
      if (ready) onNavigateReady?.(manager.currentScene().id, st.lookIndex);
    };
  }, [manager]);
  const universe = useMemo(() => new Universe(), []);
  const transport = useMemo(() => new NoopTransport(), []);
  const levelsRef = useRef<Record<number, number>>({});
  const [hudWidth, setHudWidth] = useState<number>(Math.min(LOGICAL_W, 900));

  // Resize to fit viewport while preserving 4:3; scale canvas CSS, keep 800x600 drawing units
  const [, setCanvasCssWidth] = useState<number>(LOGICAL_W);
  useEffect(() => {
    const onResize = () => {
      const el = p5CanvasElRef.current;
      if (!el) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Measure actual header and sim heights to reserve exact space
      const headerH = headerRef.current?.getBoundingClientRect().height ?? 56;
      const hudW = Math.min(vw - 32, 900);
      setHudWidth(Math.round(hudW));
      // Allow the DOM to lay out FloorSim at the new width, then measure
      const simH = simRef.current?.getBoundingClientRect().height ?? 120;
      const reserved = headerH + simH + 24; // include breathing space

      const maxByWidth = vw / ASPECT;
      const targetH = Math.max(120, Math.min(maxByWidth, vh - reserved));
      const targetW = targetH * ASPECT;

      el.style.width = `${targetW}px`;
      el.style.height = `${targetH}px`;
      const rect = el.getBoundingClientRect();
      setCanvasCssWidth(Math.round(rect.width));
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Keyboard handling: always enabled
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const handled = manager.handleKey(e, performance.now());
      if (handled) {
        setUiVersion((v) => v + 1);
        // Inform parent about navigation-relevant changes
        const scId = manager.currentScene().id;
        onNavigate?.(scId, manager.getState().lookIndex);
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () =>
      window.removeEventListener("keydown", handler, { capture: true } as any);
  }, [manager]);

  // Main loop (requestAnimationFrame)
  const [, setTick] = useState(0); // force minimal re-render for aria-live
  // Initialize p5 sketch; use p5's draw to drive our frame updates.
  useEffect(() => {
    let cleaned = false;

    // Guard against React Strict Mode double-invocation in dev:
    // remove any existing sketch/canvas synchronously before creating a new one.
    if (p5Ref.current && typeof (p5Ref.current as any).remove === "function") {
      try {
        (p5Ref.current as any).remove();
      } catch {}
      p5Ref.current = null;
    }
    const container = p5ContainerRef.current;
    if (container) {
      container.querySelectorAll("canvas").forEach((c) => c.remove());
    }

    let inst: any = null;

    (async () => {
      const p5Constructor = (await import("p5")).default;
      // Safety: if unmounted while loading, bail
      if (cleaned) return;

      inst = new p5Constructor((sk) => {
        sk.setup = () => {
          sk.createCanvas(LOGICAL_W, LOGICAL_H);
          sk.pixelDensity(1);
          // Capture the actual p5 canvas element so we can size it; no second canvas needed
          p5CanvasElRef.current = (sk as any)
            .canvas as HTMLCanvasElement | null;
          if (p5CanvasElRef.current) {
            p5CanvasElRef.current.setAttribute(
              "aria-label",
              "Projection graphics"
            );
          }
        };
        sk.draw = () => {
          const now = performance.now();
          const delta =
            (sk as any)._last ?? now ? now - ((sk as any)._last ?? now) : 16;
          (sk as any)._last = now;

          const { patch } = manager.renderFrame(now, delta, {
            p5: sk,
            canvas: (sk as any).canvas?.getContext("2d") ?? null,
          } as any);
          applySparsePatch(universe, patch);
          const diff = universe.update();
          if (diff) transport.send(diff);
          if (diff) {
            Object.assign(levelsRef.current, diff);
            setTick((v) => v + 1); // re-render to update FloorSim HUD
          }
        };
      }, p5ContainerRef.current!);
      p5Ref.current = inst;
    })();

    return () => {
      cleaned = true;
      if (inst && typeof inst.remove === "function") {
        try {
          inst.remove();
        } catch {}
      }
      // Also clear any straggler canvases in the container
      const node = p5ContainerRef.current;
      if (node) node.querySelectorAll("canvas").forEach((c) => c.remove());
    };
  }, [manager, show, transport, universe]);

  return (
    <div className="fixed inset-0 bg-black text-zinc-100">
      <div className="absolute inset-0 grid grid-rows-[auto_auto_1fr] gap-3">
        {/* Header row */}
        <div ref={headerRef} className="px-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="px-3 py-2 rounded bg-zinc-700 text-white hover:bg-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-colors"
              >
                ← Shows
              </Link>
            </div>

            {/* Center: Scene label + Look selector */}
            <div className="flex items-center gap-4">
              <div className="font-semibold text-white">
                {manager.currentScene().name}
              </div>
              {(() => {
                const lookCount = manager.currentScene().looks.length;
                const count = Math.min(4, lookCount);
                if (count < 2) return null; // Hide numbering when there's only 1 look
                const nums = Array.from(
                  { length: count },
                  (_, idx) => (idx + 1) as 1 | 2 | 3 | 4
                );
                return (
                  <div
                    role="group"
                    aria-label="Looks"
                    className="flex items-center gap-2"
                  >
                    {nums.map((i) => (
                      <button
                        key={i}
                        onClick={() => {
                          manager.setLook(i);
                          setUiVersion((v) => v + 1);
                          const scId = manager.currentScene().id;
                          onNavigate?.(scId, manager.getState().lookIndex);
                        }}
                        aria-pressed={manager.getState().lookIndex === i}
                        className={
                          "w-8 h-8 rounded-full border flex items-center justify-center text-sm " +
                          (manager.getState().lookIndex === i
                            ? "bg-white text-black border-white"
                            : "bg-zinc-800 text-zinc-200 border-zinc-500 hover:bg-zinc-700")
                        }
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>

            <button
              onClick={() => setHelpOpen((v) => !v)}
              className="px-3 py-2 rounded bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              aria-expanded={helpOpen}
            >
              Help
            </button>
          </div>
        </div>

        {/* Floor sim row (always visible) */}
        <div ref={simRef} className="flex items-center justify-center px-4">
          <FloorSim levels={levelsRef.current} width={hudWidth} />
        </div>

        {/* Canvas row: projection uses remaining height */}
        <div className="relative flex flex-col items-center justify-start">
          <div className="flex items-center justify-center">
            {/* p5 canvas mounts here (single canvas) */}
            <div ref={p5ContainerRef} aria-label="Projection graphics" />
          </div>
        </div>
      </div>
      {helpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="absolute top-16 left-3 p-3 bg-zinc-900/90 rounded max-w-md"
        >
          <h2 className="font-semibold text-white">Controls</h2>
          <ul className="list-disc ml-5 text-sm">
            {manager.currentScene().looks.length >= 2 && (
              <li>
                {`1–${Math.min(
                  4,
                  manager.currentScene().looks.length
                )}: switch Looks`}
              </li>
            )}
            <li>Arrow Up/Down: next/previous Scene</li>
            <li>B: Blackout toggle</li>
            <li>T: Tap tempo; Shift+T double, Alt+T half; R: reset</li>
            <li>H/?: toggle this help</li>
          </ul>
        </div>
      )}
      {/* aria-live region for Scene/Look changes (simplified for now) */}
      <div className="sr-only" aria-live="polite">
        {(() => {
          const sceneNum = manager.getState().sceneIndex + 1;
          const totalScenes = show.scenes.length;
          const lookCount = manager.currentScene().looks.length;
          const lookPart =
            lookCount >= 2 ? ` Look ${manager.getState().lookIndex}.` : "";
          return `Scene ${sceneNum} of ${totalScenes}.${lookPart}`;
        })()}
      </div>
    </div>
  );
}
