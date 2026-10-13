const cuesDiv = document.getElementById("cues");

class Cue {
  name!: string;
  key!: string;
  li!: HTMLLIElement;

  constructor(name: string, key: string) {
    this.name = name;
    this.key = key;

    this.li = document.createElement("li");
    this.li.innerText = name;
    this.li.classList.add("cue");
    cuesDiv.append(this.li);
  }
  set isCurrent(bool: boolean) {
    bool
      ? this.li.classList.add("is-current")
      : this.li.classList.remove("is-current");
    bool && console.debug("CUE: ", this.name, `[${this.key}]`);
  }
}

const cues = [
  new Cue("1", "z"),
  new Cue("2", "5"),
  new Cue("3", "m"),
  new Cue("4", "-"),
  new Cue("X", "Enter"),
];

const a = document.createElement("a");
a.innerText = "🏠";
a.href = "/";
a.classList.add("cue");
cuesDiv.append(a);

export { cues };
