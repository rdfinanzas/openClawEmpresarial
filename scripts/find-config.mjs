#!/usr/bin/env node
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const paths = [
  join(homedir(), ".openclaw", "config.json"),
  join(process.cwd(), ".openclaw", "config.json"),
  join(process.cwd(), "config.json"),
];

console.log("🔍 Buscando config.json...\n");

for (const path of paths) {
  console.log("Probando:", path);
  if (existsSync(path)) {
    console.log("✅ ENCONTRADO!\n");
    console.log("📁 Ubicación:", path);
    console.log("\n📄 Contenido:");
    console.log(readFileSync(path, "utf-8"));
    process.exit(0);
  }
}

console.log("\n❌ No se encontró config.json en las ubicaciones comunes.");
console.log("\n💡 Buscando en todo el disco C:\\... (esto puede tardar)");
