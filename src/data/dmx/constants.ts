/**
 * Shared DMX constants for clarity and single source of truth.
 * DMX uses 1-based addressing and 8-bit channel values.
 */
export const DMX_UNIVERSE_SIZE = 512 as const;
export const DMX_MIN_VALUE = 0 as const;
export const DMX_MAX_VALUE = 255 as const;
export const DMX_MIN_ADDRESS = 1 as const;
export const DMX_MAX_ADDRESS = DMX_UNIVERSE_SIZE;

