import { getFixture } from "@/data/fixtures";
import type { FixtureId, LedParLabel } from "@/data/fixtures";
import type { DmxAddress, DmxPatch, DmxValue, UniverseWriter } from "./types";

export class FrameUniverseWriter implements UniverseWriter {
  patch: DmxPatch = {};

  setAddress(address: DmxAddress, value: DmxValue): void {
    this.patch[address] = clamp(value, 0, 255);
  }

  setFixture(fixtureId: FixtureId, label: LedParLabel, value: DmxValue): void {
    const f = getFixture(fixtureId);
    const addr = f.getAddress(label);
    this.setAddress(addr, value);
  }

  addPatch(p: DmxPatch): void {
    for (const [addr, val] of Object.entries(p)) {
      this.setAddress(Number(addr), val as unknown as number);
    }
  }
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

