import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const directory = await mkdtemp(path.join(os.tmpdir(), "api-server-live-smoke-"));
const output = path.join(directory, "manufacturer-guide.live-smoke.cjs");
try {
  await build({
    entryPoints: [path.resolve("tests/manufacturer-guide.live-smoke.ts")],
    outfile: output,
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["*.node"],
  });
  const result = spawnSync(process.execPath, [output], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
  });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}