interface IFixture {
  dmx: number;
  master: number;
  r: number;
  g: number;
  b: number;
  rgb: number;
  strobe: number;
  mode: number;
}

class Fixture {
  private _dmx: number;
  private _master: number;
  private _r: number;
  private _g: number;
  private _b: number;
  private _rgb: number;
  private _strobe: number;
  private _mode: number;

  constructor(init?: Partial<IFixture>) {
    if (init?.dmx == null) {
      throw new Error(
        "Fixture requires 'dmx' to be provided to the constructor."
      );
    }

    this._dmx = init.dmx;

    this._master = init.master ?? 0;
    this._r = init.r ?? 0;
    this._g = init.g ?? 0;
    this._b = init.b ?? 0;
    this._rgb = init.rgb ?? 0;
    this._strobe = init.strobe ?? 1;
    this._mode = init.mode ?? 1;
  }

  private validateValue(val: number, min = 0, max = 255): boolean {
    if (val >= min && val <= max) return true;

    console.trace(`Invalid fixture value: ${val}`);
    return false;
  }

  get dmx(): number {
    return this._dmx;
  }
  set dmx(value: number) {
    if (this.validateValue(value)) this._dmx = value;
  }

  get master(): number {
    return this._master;
  }
  set master(value: number) {
    if (this.validateValue(value)) this._master = value;
  }

  get r(): number {
    return this._r;
  }
  set r(value: number) {
    if (this.validateValue(value)) this._r = value;
  }

  get g(): number {
    return this._g;
  }
  set g(value: number) {
    if (this.validateValue(value)) this._g = value;
  }

  get b(): number {
    return this._b;
  }
  set b(value: number) {
    if (this.validateValue(value)) this._b = value;
  }

  get rgb(): number {
    return this._rgb;
  }
  set rgb(value: number) {
    if (this.validateValue(value)) this._rgb = value;
  }

  get strobe(): number {
    return this._strobe;
  }
  set strobe(value: number) {
    if (this.validateValue(value, 1, 255)) this._strobe = value;
  }

  get mode(): number {
    return this._mode;
  }
  set mode(value: number) {
    if (this.validateValue(value, 1, 255)) this._mode = value;
  }

  update() {
    console.log(this);
  }
}

export { Fixture };
export type { IFixture };
