type DmxValue = number; // 0-255

// Defines the public API for a generic, label-driven fixture.
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

class Fixture<L extends string = string> implements IFixture<L> {
  private _startChannel: number;
  private _labels: readonly L[];
  private _values: Record<L, DmxValue>;

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

    // Initialize to 0 for all labels, override with any provided initial values.
    const initValues = labels.reduce((acc, label) => {
      acc[label] = 0 as DmxValue;
      return acc;
    }, {} as Record<L, DmxValue>);

    if (initial) {
      for (const [k, v] of Object.entries(initial) as [L, DmxValue][]) {
        this.assertValidLabel(k);
        this.assertValidValue(v);
        initValues[k] = v;
      }
    }

    this._values = initValues;
  }

  // --- Validation helpers ---
  private assertValidStart(val: number) {
    if (!Number.isInteger(val) || val < 1 || val > 512)
      throw new Error(
        `startChannel must be an integer in [1,512]; received ${val}`
      );
  }

  private assertValidLabels(labels: readonly L[]) {
    if (!labels.length)
      throw new Error("labels must contain at least one entry");
    if (
      this._startChannel != null &&
      this._startChannel + labels.length - 1 > 512
    ) {
      throw new Error("Fixture exceeds DMX universe (1-512)");
    }
  }

  private assertValidLabel(label: L) {
    if (!this._labels.includes(label))
      throw new Error(`Unknown label '${String(label)}' for this fixture`);
  }

  private assertValidValue(val: number) {
    if (!Number.isInteger(val) || val < 0 || val > 255)
      throw new Error(
        `DMX values must be integers in [0,255]; received ${val}`
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
