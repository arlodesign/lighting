import type { Look, Scene, VisualStyle } from "./types";

export function look(name: string, render: Look["render"], opts?: {
  visualStyle?: (ctx: Parameters<Look["render"]>[0]) => VisualStyle;
}): Look {
  return {
    id: 1 as 1, // placeholder; Scene will remap order to 1..4 at runtime
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
      init?: () => any;
      update?: (state: any, ctx: any) => void;
      draw?: (p5: any, state: any, ctx: any, style?: VisualStyle) => void;
    };
    crossfadeMs?: number;
  }
): Scene {
  const sc: Scene = {
    id,
    name,
    looks,
    updateVisual: opts?.visual?.update ? (ctx: any) => {
      const s = (ctx as any).sceneState ?? ((ctx as any).sceneState = opts?.visual?.init?.() ?? {});
      opts!.visual!.update!(s, ctx);
    } : undefined,
    drawVisual: opts?.visual?.draw ? (p5: any, ctx: any, style?: VisualStyle) => {
      const s = (ctx as any).sceneState ?? ((ctx as any).sceneState = opts?.visual?.init?.() ?? {});
      opts!.visual!.draw!(p5, s, ctx, style);
    } : undefined,
  };
  return sc;
}

