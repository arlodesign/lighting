import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const rl = createInterface({ input: stdin, output: stdout });
let closed = false;
const whenClosed = new Promise<string>((resolve) =>
  rl.on("close", () => {
    closed = true;
    resolve("");
  }),
);

export const c = {
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

/** Ctrl-D (or piped input running out) closes stdin; treat every later prompt as "Enter". */
export async function ask(question: string): Promise<string> {
  if (closed) return "";
  // A question that's pending when stdin closes would otherwise wait forever.
  return (await Promise.race([rl.question(`${question} `), whenClosed])).trim();
}

/** Ask until the answer is one of `choices` (case-insensitive). Empty answer → `fallback` if given. */
export async function choose<T extends string>(
  question: string,
  choices: readonly T[],
  fallback?: T,
): Promise<T> {
  const hint = choices
    .map((ch) => (ch === fallback ? ch.toUpperCase() : ch))
    .join("/");
  for (;;) {
    if (closed) return fallback ?? choices[0]!;
    const answer = (await ask(`${question} [${hint}]`)).toLowerCase();
    if (answer === "" && fallback) return fallback;
    const match = choices.find((ch) => ch.toLowerCase() === answer);
    if (match) return match;
    console.log(c.yellow(`  Please type one of: ${choices.join(", ")}`));
  }
}

export async function yesNo(
  question: string,
  fallback: "y" | "n" = "y",
): Promise<boolean> {
  return (await choose(question, ["y", "n"] as const, fallback)) === "y";
}

export async function pause(
  message = "Press Enter to continue…",
): Promise<string> {
  return ask(c.dim(message));
}

export function heading(text: string): void {
  console.log(`\n${c.bold(c.cyan(`━━ ${text} ━━`))}`);
}

export function closePrompt(): void {
  rl.close();
}
