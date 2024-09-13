const lightsDiv = document.getElementById("lights");

class Light {
  constructor(name, channel, r, g, b) {
    this.name = name;

    const data = window.localStorage.getItem(this.name)
      ? JSON.parse(window.localStorage.getItem(this.name))
      : {};

    this.channel = channel || data.channel || 0;
    this.r = r || data.r || 0;
    this.g = g || data.g || 0;
    this.b = b || data.b || 0;

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
  set color({ r, g, b }) {
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
  }

  updateStorage() {
    window.localStorage.setItem(this.name, JSON.stringify(this));
  }

  updateFixture() {
    // send message to lights
  }
}

const lights = [
  new Light("SL_1"),
  new Light("SL_2"),
  new Light("SL_3"),
  new Light("SL_4"),
  new Light("SR_1"),
  new Light("SR_2"),
  new Light("SR_3"),
  new Light("SR_4"),
];

export { lights };
