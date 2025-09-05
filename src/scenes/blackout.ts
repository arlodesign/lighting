import type { Look, Scene } from "@/runtime/types";

const BlackoutLook: Look = {
  id: 1,
  name: "Blackout",
  render: ({ lights }) => {
    lights?.off();
  },
};

export const BlackoutScene: Scene = {
  id: "blackout",
  name: "Blackout",
  looks: [BlackoutLook],
};
