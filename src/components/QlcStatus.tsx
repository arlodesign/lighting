"use client";

import React, { useEffect, useState } from "react";
import {
  qlcConnection,
  type QlcStatus,
} from "@/runtime/transport/qlcConnection";

export function QlcStatus({
  variant = "pill" as const,
}: {
  variant?: "pill" | "banner";
}) {
  // Initialize to a stable value for SSR to avoid hydration mismatch; update after mount
  const [status, setStatus] = useState<QlcStatus>("disconnected");
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return qlcConnection.subscribe((e) => setStatus(e.status));
  }, []);

  const retry = () => qlcConnection.retryNow();

  if (variant === "banner") {
    if (dismissed) return null;
    if (status === "connected") return null;
    return (
      <div
        role="status"
        aria-live="polite"
        className="mb-4 p-3 rounded border bg-zinc-900 text-zinc-100 border-zinc-700 flex items-start justify-between gap-3"
      >
        <div>
          <div className="font-medium">QLC+ not connected</div>
          <div className="text-sm text-zinc-400">
            {mounted && status === "connecting"
              ? "Attempting to connect to ws://127.0.0.1:9999/qlcplusWS..."
              : "Lights will not output until connected."}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={retry}
            className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            Try again
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="px-3 py-2 rounded bg-zinc-800 text-white hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // pill
  const label =
    status === "connected"
      ? "QLC+: Connected"
      : status === "connecting"
      ? "QLC+: Connecting"
      : "QLC+: Disconnected";
  const color =
    status === "connected"
      ? "bg-emerald-600"
      : status === "connecting"
      ? "bg-amber-600"
      : "bg-red-700";
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <span className={`px-3 py-1 rounded text-white text-sm ${color}`}>
        {label}
      </span>
      {status !== "connected" && (
        <button
          onClick={retry}
          className="px-2 py-1 rounded bg-zinc-800 text-white text-sm hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          Retry
        </button>
      )}
    </div>
  );
}
