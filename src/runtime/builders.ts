import type { Look, Scene, VisualStyle, LookRenderCtx } from "./types";

export function look(
  name: string,
  render: Look["render"],
  opts?: {
    visualStyle?: (ctx: Parameters<Look["render"]>[0]) => VisualStyle;
  }
): Look {
  return {
    id: 1, // placeholder; Scene will remap order to 1..4 at runtime
    name,
    render,
    visualStyle: opts?.visualStyle,
  };
}

export function scene(
  id: string,
  name: string,
  looks: Look[],
  opts?: {
    visual?: {
      init?: () => unknown;
      update?: (state: unknown, ctx: Parameters<Look["render"]>[0]) => void;
      draw?: (
        p5: unknown,
        state: unknown,
        ctx: Parameters<Look["render"]>[0],
        style?: VisualStyle
      ) => void;
    };
    crossfadeMs?: number;
  }
): Scene {
  const sc: Scene = {
    id,
    name,
    looks,
    updateVisual: opts?.visual?.update
      ? (ctx) => {
          const key = "sceneState" as const;
          const rec = ctx as Record<string, unknown>;
          const s =
            rec[key] ?? ((rec[key] = opts?.visual?.init?.() ?? {}), rec[key]);
          opts!.visual!.update!(s, ctx);
        }
      : undefined,
    drawVisual: opts?.visual?.draw
      ? (p5, ctx, style) => {
          const key = "sceneState" as const;
          const rec = ctx as Record<string, unknown>;
          const s =
            rec[key] ?? ((rec[key] = opts?.visual?.init?.() ?? {}), rec[key]);
          opts!.visual!.draw!(
            p5 as unknown as import("p5"),
            s,
            ctx as LookRenderCtx,
            style
          );
        }
      : undefined,
  };
  return sc;
}
