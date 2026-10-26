import { cpSync, existsSync, mkdirSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const repoData = path.resolve(frontendRoot, "..", "data");
const dest = path.join(frontendRoot, "data");

if (!existsSync(path.join(repoData, "processed", "listings.json"))) {
  console.warn("[copy-data] ../data/processed/listings.json missing — skipping");
  process.exit(0);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(path.join(repoData, "processed"), path.join(dest, "processed"), { recursive: true });
cpSync(path.join(repoData, "images"), path.join(dest, "images"), { recursive: true });
console.log("[copy-data] copied processed + images into frontend/data");
