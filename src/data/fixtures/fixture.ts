/** DMX channel value (0-255). */
type DmxValue = number; // 0-255
import {
  DMX_MIN_ADDRESS,
  DMX_MAX_ADDRESS,
  DMX_MIN_VALUE,
  DMX_MAX_VALUE,
} from "../dmx/constants";

/**
 * Public API for a generic, label-driven DMX fixture.
 * - startChannel is 1-based (DMX standard)
 * - labels array order defines the channel offsets for this fixture
 * - values are integers in [DMX_MIN_VALUE, DMX_MAX_VALUE]
 */
interface IFixture<L extends string = string> {
  readonly startChannel: number; // 1-based DMX address of the first channel this fixture occupies
  readonly labels: readonly L[]; // ordered labels for channels, determines channel offsets

  // Returns the absolute DMX address for a given label.
  getAddress(label: L): number;

  // Returns/sets a single channel value (0-255).
  getValue(label: L): DmxValue;
  setValue(label: L, value: DmxValue): this;

  // Batch update multiple labeled channels.
  setValues(values: Partial<Record<L, DmxValue>>): this;

  // Produces a sparse DMX map of absolute addresses to values for this fixture only.
  toDmx(): Record<number, DmxValue>;
}

/**
 * Label-driven Fixture implementation. Label order defines channel offsets.
 * Changing labels changes absolute addressing for this fixture.
 */
class Fixture<L extends string = string> implements IFixture<L> {
  private _startChannel: number;
  private _labels: readonly L[];
  private _values: Record<L, DmxValue>;

  /**
   * @param opts.startChannel 1-based DMX address for the first channel
   * @param opts.labels Ordered labels (array order defines channel offsets)
   * @param opts.initial Optional initial non-zero values per label
   */
  constructor(opts: {
    startChannel: number;
    labels: readonly L[];
    initial?: Partial<Record<L, DmxValue>>;
  }) {
    const { startChannel, labels, initial } = opts;
    this.assertValidStart(startChannel);

    // assign before validating total footprint so we can check universe overflow
    this._startChannel = startChannel;
    this._labels = labels;

    this.assertValidLabels(labels);

    // Initialize internal value map
    this._values = this.buildInitialValues(labels, initial);
  }

  // --- Validation helpers ---
  private assertValidStart(val: number) {
    if (
      !Number.isInteger(val) ||
      val < DMX_MIN_ADDRESS ||
      val > DMX_MAX_ADDRESS
    ) {
      throw new Error(
        `startChannel must be an integer in [${DMX_MIN_ADDRESS},${DMX_MAX_ADDRESS}]; received ${val}`
      );
    }
  }

  // --- Initialization helpers ---
  private buildInitialValues(
    labels: readonly L[],
    initial?: Partial<Record<L, DmxValue>>
  ): Record<L, DmxValue> {
    // Initialize to 0 for all labels, then override with provided initial values.
    const values = labels.reduce((acc, label) => {
      acc[label] = 0 as DmxValue;
      return acc;
    }, {} as Record<L, DmxValue>);

    if (initial) {
      for (const [k, v] of Object.entries(initial) as [L, DmxValue][]) {
        this.assertValidLabel(k);
        this.assertValidValue(v);
        values[k] = v;
      }
    }

    return values;
  }

  private assertValidLabels(labels: readonly L[]) {
    if (!labels.length)
      throw new Error("labels must contain at least one entry");
    if (
      this._startChannel != null &&
      this._startChannel + labels.length - 1 > DMX_MAX_ADDRESS
    ) {
      throw new Error(
        `Fixture exceeds DMX universe (${DMX_MIN_ADDRESS}-${DMX_MAX_ADDRESS})`
      );
    }
  }

  private assertValidLabel(label: L) {
    if (!this._labels.includes(label))
      throw new Error(`Unknown label '${String(label)}' for this fixture`);
  }

  private assertValidValue(val: number) {
    // Values are 8-bit per DMX channel.
    if (!Number.isInteger(val) || val < DMX_MIN_VALUE || val > DMX_MAX_VALUE)
      throw new Error(
        `DMX values must be integers in [${DMX_MIN_VALUE},${DMX_MAX_VALUE}]; received ${val}`
      );
  }

  // --- Public API ---
  get startChannel(): number {
    return this._startChannel;
  }

  get labels(): readonly L[] {
    return this._labels;
  }

  getAddress(label: L): number {
    this.assertValidLabel(label);
    const idx = this._labels.indexOf(label); // 0-based index
    return this._startChannel + idx; // 1-based absolute address
  }

  getValue(label: L): DmxValue {
    this.assertValidLabel(label);
    return this._values[label];
  }

  setValue(label: L, value: DmxValue): this {
    this.assertValidLabel(label);
    this.assertValidValue(value);
    this._values[label] = value;
    return this;
  }

  setValues(values: Partial<Record<L, DmxValue>>): this {
    for (const [k, v] of Object.entries(values) as [L, DmxValue][]) {
      this.setValue(k, v);
    }
    return this;
  }

  toDmx(): Record<number, DmxValue> {
    const out: Record<number, DmxValue> = {};
    this._labels.forEach((label, i) => {
      const addr = this._startChannel + i; // absolute 1-based address
      out[addr] = this._values[label];
    });
    return out;
  }
}

export { Fixture };
export type { IFixture, DmxValue };
