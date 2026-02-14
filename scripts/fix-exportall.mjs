#!/usr/bin/env node
/**
 * Workaround for rolldown bug #8184: __exportAll is not a function
 * https://github.com/rolldown/rolldown/issues/8184
 *
 * This script patches generated chunks to include __exportAll definition
 * instead of importing it from other chunks.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const __exportAllDefinition = `
// Workaround for rolldown bug #8184
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
\tlet target = {};
\tfor (var name in all) {
\t\t__defProp(target, name, { get: all[name], enumerable: true });
\t}
\tif (!no_symbols) {
\t\t__defProp(target, Symbol.toStringTag, { value: "Module" });
\t}
\treturn target;
};
`.trim();

async function* walkDir(dir) {
  const files = await readdir(dir, { withFileTypes: true });
  for (const file of files) {
    const path = join(dir, file.name);
    if (file.isDirectory()) {
      yield* walkDir(path);
    } else {
      yield path;
    }
  }
}

async function main() {
  const distDir = "./dist";
  const filesToPatch = [];

  // Find all files that import __exportAll
  for await (const file of walkDir(distDir)) {
    if (!file.endsWith(".js")) continue;

    const content = await readFile(file, "utf-8");
    if (content.includes('import { w as __exportAll }') || content.includes("w as __exportAll")) {
      filesToPatch.push(file);
    }
  }

  console.log(`[fix-exportall] Found ${filesToPatch.length} files to patch`);

  for (const file of filesToPatch) {
    let content = await readFile(file, "utf-8");

    // Remove the import of __exportAll
    content = content.replace(
      /import\s*\{\s*w\s+as\s+__exportAll\s*\}\s*from\s*["'][^"']+["'];?\n?/g,
      ""
    );

    // Add the definition at the top (after other imports)
    const lastImportIndex = content.lastIndexOf("import ");
    const nextNewlineAfterImport = content.indexOf("\n", lastImportIndex);

    if (nextNewlineAfterImport !== -1) {
      const before = content.slice(0, nextNewlineAfterImport + 1);
      const after = content.slice(nextNewlineAfterImport + 1);
      content = before + "\n" + __exportAllDefinition + "\n\n" + after;
    } else {
      content = __exportAllDefinition + "\n\n" + content;
    }

    await writeFile(file, content, "utf-8");
    console.log(`[fix-exportall] Patched: ${file}`);
  }

  console.log("[fix-exportall] Done!");
}

main().catch((err) => {
  console.error("[fix-exportall] Error:", err);
  process.exit(1);
});
