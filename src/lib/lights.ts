const lightsDiv = document.getElementById("lights");
const websocket = new WebSocket("ws://127.0.0.1:9999/qlcplusWS");
let isConnected = false;
let youHaveBeenWarned = false;

websocket.onopen = function (event) {
  console.log("QLC+ connection successful", event);
  isConnected = true;
};

websocket.onclose = function (event) {
  console.warn("QLC+ connection lost!", event);
};

websocket.onerror = function (event) {
  console.error("QLC+ connection error!", event);
};

websocket.onmessage = function (event) {
  console.debug("QLC+ message", event);
};

type Fixture = {
  channel: number;
  master: number;
  r: number;
  g: number;
  b: number;
  strobe: number;
  effect: number;
  colorShift: number;
};

class Light {
  name!: string;
  channel!: Fixture["channel"];
  master!: Fixture["master"];
  r!: Fixture["r"];
  g!: Fixture["g"];
  b!: Fixture["b"];
  strobe!: Fixture["strobe"];
  effect!: Fixture["effect"];
  colorShift!: Fixture["colorShift"];
  li!: HTMLLIElement;
  dot!: HTMLDivElement;
  data!: Fixture;

  constructor(name: string, channel: number) {
    this.name = name;

    this.data = window.localStorage.getItem(this.name)
      ? JSON.parse(window.localStorage.getItem(this.name))
      : {};

    this.channel = channel || this.data.channel || 0;
    this.master = this.data.master || 255;
    this.r = this.data.r || 0;
    this.g = this.data.g || 0;
    this.b = this.data.b || 0;
    this.strobe = this.data.strobe || 0;
    this.effect = this.data.effect || 0;
    this.colorShift = this.data.colorShift || 0;

    this.li = document.createElement("li");
    this.li.setAttribute("id", name);
    this.li.innerText = name[0];

    this.dot = document.createElement("div");
    this.dot.classList.add("dot");

    this.li.append(this.dot);
    lightsDiv.append(this.li);

    this.updateDot();
    this.updateStorage();
  }

  /**
   * @param Object
   */
  set color({ r, g, b }: { r: number; g: number; b: number }) {
    this.r = Math.round(r);
    this.g = Math.round(g);
    this.b = Math.round(b);
  }

  update() {
    this.updateDot();
    this.updateFixture();
    this.updateStorage();
  }

  updateDot() {
    this.dot.style.backgroundColor = `rgb(${this.r},${this.g},${this.b})`;
    this.dot.style.opacity = String(this.master / 255);
  }

  updateStorage() {
    const { channel, master, r, g, b, strobe, effect, colorShift } = this;
    window.localStorage.setItem(
      this.name,
      JSON.stringify({
        channel,
        master,
        r,
        g,
        b,
        strobe,
        effect,
        colorShift,
      }),
    );
  }

  updateFixture() {
    if (!isConnected) return;

    this.data.master !== this.master &&
      websocket.send(`CH|${this.channel}|${Math.round(this.master)}`);
    this.data.r !== this.r &&
      websocket.send(`CH|${this.channel + 1}|${this.r}`);
    this.data.g !== this.g &&
      websocket.send(`CH|${this.channel + 2}|${this.g}`);
    this.data.b !== this.b &&
      websocket.send(`CH|${this.channel + 3}|${this.b}`);
    this.data.strobe !== this.strobe &&
      websocket.send(`CH|${this.channel + 4}|${this.strobe}`);
    this.data.effect !== this.effect &&
      websocket.send(`CH|${this.channel + 5}|${this.effect}`);
    this.data.colorShift !== this.colorShift &&
      websocket.send(`CH|${this.channel + 6}|${this.colorShift}`);
  }
}

const lights = [
  new Light("JEREMY_SL", 1),
  new Light("BECKY_SL", 17),
  new Light("TORI_SL", 33),
  new Light("ARLO_SL", 49),
  new Light("JEREMY_SR", 65),
  new Light("TORI_SR", 81),
  new Light("BECKY_SR", 97),
  new Light("ARLO_SR", 113),
];

const lightsObj = lights.reduce(
  (obj, light) => Object.assign(obj, { [light.name]: light }),
  {},
);

export { lights, lightsObj };
