import { afterEach, describe, expect, it } from "vitest";
import { WebSocketServer } from "ws";
import { QlcOutput } from "./qlcOutput.ts";

const servers: WebSocketServer[] = [];
const outputs: QlcOutput[] = [];

afterEach(async () => {
  for (const o of outputs.splice(0)) await o.stop();
  for (const s of servers.splice(0)) await new Promise((r) => s.close(r));
});

/** A fake QLC+: collects every message it receives. */
async function fakeQlc(port = 0) {
  const received: string[] = [];
  const wss = new WebSocketServer({ port, path: "/qlcplusWS" });
  servers.push(wss);
  await new Promise((r) => wss.once("listening", r));
  wss.on("connection", (ws) =>
    ws.on("message", (m) => received.push(String(m))),
  );
  const address = wss.address();
  const actualPort =
    typeof address === "object" && address ? address.port : port;
  return { wss, received, port: actualPort };
}

const until = async (cond: () => boolean, ms = 2000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 10));
  }
};

function output(port: number) {
  const o = new QlcOutput({
    url: `ws://127.0.0.1:${port}/qlcplusWS`,
    fps: 100,
    channels: 16,
  });
  outputs.push(o);
  return o;
}

describe("QlcOutput", () => {
  it("sends changed channels as CH|<1-based address>|<value>", async () => {
    const qlc = await fakeQlc();
    const o = output(qlc.port);
    o.universe[0] = 255; // channel 1
    o.universe[4] = 7; // channel 5
    await o.start();
    await until(
      () =>
        qlc.received.includes("CH|1|255") && qlc.received.includes("CH|5|7"),
    );
    expect(o.connected).toBe(true);
  });

  it("sends only what changed", async () => {
    const qlc = await fakeQlc();
    const o = output(qlc.port);
    await o.start();
    await until(() => qlc.received.length >= 16); // initial full sync of 16 channels (all 0)
    const before = qlc.received.length;
    await new Promise((r) => setTimeout(r, 120)); // many ticks with no changes
    expect(qlc.received.length).toBe(before);
    o.universe[2] = 99;
    await until(() => qlc.received.includes("CH|3|99"));
    expect(qlc.received.length).toBe(before + 1);
  });

  it("keeps trying while QLC+ isn't running, then connects and syncs", async () => {
    const first = await fakeQlc();
    const port = first.port;
    await new Promise((r) => first.wss.close(r)); // QLC+ "not running"
    servers.length = 0;
    const o = output(port);
    o.universe[0] = 42;
    await o.start();
    await new Promise((r) => setTimeout(r, 150));
    expect(o.connected).toBe(false);
    expect(o.stats.errors).toBeGreaterThan(0);

    const qlc = await fakeQlc(port); // QLC+ "starts"
    await until(() => qlc.received.includes("CH|1|42"), 4000);
    expect(o.connected).toBe(true);
  });

  it("re-sends everything after QLC+ restarts", async () => {
    const first = await fakeQlc();
    const port = first.port;
    const o = output(port);
    o.universe[1] = 200;
    await o.start();
    await until(() => first.received.includes("CH|2|200"));

    for (const c of first.wss.clients) c.terminate();
    await new Promise((r) => first.wss.close(r));
    servers.length = 0;
    const second = await fakeQlc(port);
    await until(() => second.received.includes("CH|2|200"), 4000);
  });
});
