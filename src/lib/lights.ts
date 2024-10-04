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
  alert("QLC+ connection error!");
  console.error("QLC+ connection error!", event);
};

websocket.onmessage = function (event) {
  console.debug("QLC+ message", event);
};

class Light {
  name!: string;
  channel!: number;
  master!: number;
  r!: number;
  g!: number;
  b!: number;
  strobe!: number;
  effect!: number;
  colorShift!: number;
  li!: HTMLLIElement;
  dot!: HTMLDivElement;

  constructor(name: string, channel: number) {
    this.name = name;

    const data = window.localStorage.getItem(this.name)
      ? JSON.parse(window.localStorage.getItem(this.name))
      : {};

    this.channel = channel || data.channel || 0;
    this.master = data.master || 255;
    this.r = data.r || 0;
    this.g = data.g || 0;
    this.b = data.b || 0;
    this.strobe = data.strobe || 0;
    this.effect = data.effect || 0;
    this.colorShift = data.colorShift || 0;

    this.li = document.createElement("li");
    this.li.setAttribute("id", name);

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
    if (this.r === r && this.g === g && this.b === b) return;

    this.r = r;
    this.g = g;
    this.b = b;

    this.updateDot();
    this.updateStorage();
    this.updateFixture();
  }

  updateDot() {
    this.dot.style.backgroundColor = `rgb(${this.r},${this.g},${this.b})`;
    this.dot.style.opacity = String(this.master / 255);
  }

  updateStorage() {
    window.localStorage.setItem(this.name, JSON.stringify(this));
  }

  updateFixture() {
    if (isConnected === true) {
      websocket.send(`CH|${this.channel}|${this.master}`);
      websocket.send(`CH|${this.channel + 1}|${this.r}`);
      websocket.send(`CH|${this.channel + 2}|${this.g}`);
      websocket.send(`CH|${this.channel + 3}|${this.b}`);
      websocket.send(`CH|${this.channel + 4}|${this.strobe}`);
      websocket.send(`CH|${this.channel + 5}|${this.effect}`);
      websocket.send(`CH|${this.channel + 6}|${this.colorShift}`);
    } else {
      !youHaveBeenWarned && alert("You must connect to QLC+ WebSocket first!");
      youHaveBeenWarned = true;
    }
  }
}

const lights = [
  new Light("SL_1", 1),
  new Light("SL_2", 17),
  new Light("SL_3", 33),
  new Light("SL_4", 49),
  new Light("SR_1", 65),
  new Light("SR_2", 81),
  new Light("SR_3", 97),
  new Light("SR_4", 113),
];

export { lights };
