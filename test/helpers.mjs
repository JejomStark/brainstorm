// Shared helpers: run the CLI against a fake lavish-axi so no browser or server starts.
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CLI = fileURLToPath(new URL("../skills/brainstorm/scripts/brainstorm.mjs", import.meta.url));

/** Creates a fake lavish-axi that prints a session URL and exits. */
export function fakeLavish() {
  const folder = mkdtempSync(path.join(tmpdir(), "brainstorm-fake-lavish-"));
  const bin = path.join(folder, "lavish-axi");
  writeFileSync(bin, "#!/usr/bin/env node\nprocess.stdout.write('url: http://127.0.0.1:0/session\\nnext_step: edit the page\\n');\n");
  chmodSync(bin, 0o755);
  return bin;
}

/**
 * @param {string[]} args
 * @param {string} cwd
 */
export function runCli(args, cwd) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, BRAINSTORM_LAVISH_BIN: fakeLavish() },
  });
}
