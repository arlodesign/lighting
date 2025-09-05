import { allFixtures } from "@/data/fixtures";
import type { Look, Scene } from "@/runtime/types";

const BlackoutLook: Look = {
  id: 1,
  name: "Blackout",
  render: ({ universe }) => {
    for (const [_, f] of allFixtures()) {
      universe.setAddress(f.getAddress("master" as any), 0);
      universe.setAddress(f.getAddress("r" as any), 0);
      universe.setAddress(f.getAddress("g" as any), 0);
      universe.setAddress(f.getAddress("b" as any), 0);
      // keep strobe/mode at defaults if needed; we leave as-is
    }
  },
};

export const BlackoutScene: Scene = {
  id: "blackout",
  name: "Blackout",
  looks: [BlackoutLook],
};
