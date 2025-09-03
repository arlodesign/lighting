import { DMX_MAX_ADDRESS, DMX_MAX_VALUE, DMX_MIN_ADDRESS, DMX_MIN_VALUE } from "./constants";

export function isValidDmxValue(n: number): boolean {
  return Number.isInteger(n) && n >= DMX_MIN_VALUE && n <= DMX_MAX_VALUE;
}

export function assertValidDmxValue(n: number): void {
  if (!isValidDmxValue(n)) {
    throw new Error(`DMX values must be integers in [${DMX_MIN_VALUE},${DMX_MAX_VALUE}]; received ${n}`);
  }
}

export function isValidAddress(address: number): boolean {
  return Number.isInteger(address) && address >= DMX_MIN_ADDRESS && address <= DMX_MAX_ADDRESS;
}

export function assertValidAddress(address: number): void {
  if (!isValidAddress(address)) {
    throw new Error(`DMX address must be an integer in [${DMX_MIN_ADDRESS},${DMX_MAX_ADDRESS}]; received ${address}`);
  }
}

export function toZeroBasedIndex(address: number): number {
  // DMX addresses are 1-based on the wire; internal arrays are 0-based.
  return address - 1;
}

export function toOneBasedAddress(index: number): number {
  return index + 1;
}

