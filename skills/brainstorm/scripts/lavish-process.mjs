// The only module that runs `lavish-axi`: opening the session and waiting for feedback.
// Never `lavish-axi share`: a brainstorm session stays on the machine.

import { spawn } from "node:child_process";

const LAVISH_BIN = process.env.BRAINSTORM_LAVISH_BIN || "lavish-axi";

/**
 * Runs lavish-axi and returns its output. A launch failure or a non-zero
 * exit code surfaces as an error that quotes stderr.
 * @param {string[]} args
 * @param {{ input?: string }} [options]
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
function runLavish(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(LAVISH_BIN, args, { stdio: ["pipe", "pipe", "pipe"] });
    const stdoutChunks = [];
    const stderrChunks = [];
    child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk) => stderrChunks.push(chunk));
    child.on("error", (error) => reject(new Error(`Cannot run ${LAVISH_BIN}: ${error.message}. Install it with "npm install -g lavish-axi".`)));
    child.on("close", (code, signal) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const cause = signal ? `signal ${signal}` : `code ${code}`;
      reject(new Error(`${LAVISH_BIN} ${args[0]} failed (${cause}).\n${stderr || stdout}`));
    });
    // Ctrl-C or an agent timeout must also stop the child poll.
    const stopChild = () => child.kill("SIGTERM");
    process.once("SIGTERM", stopChild);
    process.once("SIGINT", stopChild);
    child.on("close", () => {
      process.off("SIGTERM", stopChild);
      process.off("SIGINT", stopChild);
    });
    child.stdin.end(options.input ?? "");
  });
}

/**
 * Opens (or resumes) the Lavish session of the page.
 * @param {string} pagePath
 */
export async function openSession(pagePath) {
  const { stdout } = await runLavish([pagePath]);
  return stdout;
}

/**
 * Waits for the next user feedback. With `reply`, first shows that message
 * in the Lavish conversation.
 * @param {string} pagePath
 * @param {string | undefined} reply
 */
export async function pollFeedback(pagePath, reply) {
  const args = ["poll", pagePath];
  if (reply) args.push("--agent-reply-file", "-");
  const { stdout } = await runLavish(args, { input: reply ?? "" });
  return stdout;
}

/**
 * Shows a final message in Lavish without waiting for feedback.
 * @param {string} pagePath
 * @param {string} reply
 */
export async function sendReply(pagePath, reply) {
  const { stdout } = await runLavish(["reply", pagePath, "--agent-reply-file", "-"], { input: reply });
  return stdout;
}
