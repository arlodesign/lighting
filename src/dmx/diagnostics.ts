import { execFile } from "node:child_process";

const run = (cmd: string, args: string[]): Promise<string> =>
  new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { timeout: 8000, maxBuffer: 2_000_000 },
      (err, stdout, stderr) => {
        const text = (stdout || stderr || (err ? String(err) : "")).trim();
        resolve(
          text.length > 6000 ? `${text.slice(0, 6000)}\n…(truncated)` : text,
        );
      },
    );
  });

/**
 * What the OS thinks of the FTDI adapter: which driver claimed it and which device nodes
 * exist. Cheap to collect, and the first thing to read when "nothing lights up".
 * Every command is best-effort — a missing tool just yields an empty/err string.
 */
export async function collectDriverInfo(): Promise<Record<string, string>> {
  if (process.platform !== "darwin") {
    return {
      devNodes: await run("sh", ["-c", "ls -l /dev/ttyUSB* /dev/ttyACM* 2>&1"]),
    };
  }
  const [devNodes, usb, systemExtensions, kexts] = await Promise.all([
    run("sh", ["-c", "ls -l /dev/cu.* 2>&1"]),
    run("sh", [
      "-c",
      "ioreg -p IOUSB -w0 2>&1 | grep -iE 'ft232|ftdi|usb serial|dmx' ",
    ]),
    run("sh", ["-c", "systemextensionsctl list 2>&1 | grep -iE 'ftdi|serial'"]),
    run("sh", ["-c", "kextstat 2>&1 | grep -iE 'ftdi|usbserial'"]),
  ]);
  return { devNodes, usb, systemExtensions, kexts };
}
