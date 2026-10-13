import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const PROBE_VERSION = 1;
const REPORT_DIR = path.join(import.meta.dirname, "..", "probe-reports");

/** Everything the probe learns. Kept loose (unknown) where the shape depends on the section. */
export interface ProbeReport {
  probeVersion: number;
  startedAt: string;
  finishedAt?: string;
  machine: {
    hostname: string;
    platform: string;
    osRelease: string;
    arch: string;
    cpu: string;
    totalMemGb: number;
    node: string;
  };
  midi?: unknown;
  dmx?: unknown;
  mic?: unknown;
  /** Free-form notes typed during the run, keyed by step. */
  notes: Record<string, string>;
  errors: string[];
}

export function createReport(): ProbeReport {
  return {
    probeVersion: PROBE_VERSION,
    startedAt: new Date().toISOString(),
    machine: {
      hostname: os.hostname(),
      platform: os.platform(),
      osRelease: os.release(),
      arch: os.arch(),
      cpu: os.cpus()[0]?.model ?? "unknown",
      totalMemGb: Math.round(os.totalmem() / 1e9),
      node: process.version,
    },
    notes: {},
    errors: [],
  };
}

let reportFile: string | undefined;

/** Write the report to disk. Called after every section so a crash or Ctrl-C loses nothing. */
export async function saveReport(report: ProbeReport): Promise<string> {
  await mkdir(REPORT_DIR, { recursive: true });
  if (!reportFile) {
    const stamp = report.startedAt.replace(/[:.]/g, "-").slice(0, 19);
    reportFile = path.join(REPORT_DIR, `probe-${stamp}.json`);
  }
  await writeFile(reportFile, JSON.stringify(report, null, 2) + "\n");
  return reportFile;
}
