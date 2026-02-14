#!/usr/bin/env node
// Script de desarrollo - ejecuta TypeScript directo sin compilar

import { spawn } from "node:child_process";
import process from "node:process";

const args = process.argv.slice(2);

const child = spawn("npx", ["tsx", "src/entry.ts", ...args], {
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
