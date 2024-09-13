const cuesDiv = document.getElementById("cues");

class Cue {
  constructor(name, key, isCurrent = false) {
    this.name = name;
    this.key = key;

    this.li = document.createElement("li");
    this.li.innerText = name;
    this.li.classList.add("cue");
    cuesDiv.append(this.li);
  }
  set isCurrent(bool) {
    bool
      ? this.li.classList.add("is-current")
      : this.li.classList.remove("is-current");
  }
}

const cues = [
  new Cue("1", "z"),
  new Cue("2", "5"),
  new Cue("3", "m"),
  new Cue("4", "-"),
  new Cue("X", "Enter"),
];

export { cues };
