import { describe, it, expect } from "vitest";
import { isValidDmxValue, assertValidDmxValue, isValidAddress, assertValidAddress, toZeroBasedIndex, toOneBasedAddress } from "../data/dmx/utils";

describe("dmx utils", () => {
  it("validates values and addresses", () => {
    expect(isValidDmxValue(0)).toBe(true);
    expect(isValidDmxValue(255)).toBe(true);
    expect(isValidDmxValue(256)).toBe(false);
    expect(isValidAddress(1)).toBe(true);
    expect(isValidAddress(512)).toBe(true);
    expect(isValidAddress(0)).toBe(false);
    expect(() => assertValidDmxValue(300)).toThrow();
    expect(() => assertValidAddress(0)).toThrow();
  });

  it("converts between 1-based and 0-based", () => {
    expect(toZeroBasedIndex(1)).toBe(0);
    expect(toOneBasedAddress(0)).toBe(1);
  });
});

