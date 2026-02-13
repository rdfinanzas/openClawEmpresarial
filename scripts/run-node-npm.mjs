#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const env = { ...process.env };
const cwd = process.cwd();
const distRoot = path.join(cwd, "dist");
const distEntry = path.join(distRoot, "/entry.js");

const runNode = () => {
  const nodeProcess = spawn(process.execPath, ["openclaw.mjs", ...args], {
    cwd,
    env,
    stdio: "inherit",
  });

  nodeProcess.on("exit", (exitCode, exitSignal) => {
    if (exitSignal) {
      process.exit(1);
    }
    process.exit(exitCode ?? 1);
  });
};

// Verificar si dist existe
if (!fs.existsSync(distEntry)) {
  console.log("[openclaw] Building with npx tsdown...");
  const build = spawn("npx", ["tsdown"], {
    cwd,
    env,
    stdio: "inherit",
    shell: true,
  });

  build.on("exit", (code, signal) => {
    if (signal || (code !== 0 && code !== null)) {
      process.exit(code ?? 1);
    }
    runNode();
  });
} else {
  runNode();
}
