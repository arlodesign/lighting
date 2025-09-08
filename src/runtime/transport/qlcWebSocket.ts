"use client";

import type { DmxPatch, Transport } from "../types";
import { qlcConnection } from "./qlcConnection";

// QLC+ WebSocket Transport: sends one message per changed channel
export class QlcPlusWebSocketTransport implements Transport {
  async send(diff: DmxPatch): Promise<void> {
    // Send each channel change as CH|<address>|<value>
    for (const [addrStr, val] of Object.entries(diff)) {
      const addr = Number(addrStr);
      qlcConnection.sendChannel(addr, val as unknown as number);
    }
  }
}

