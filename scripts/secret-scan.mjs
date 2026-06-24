import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignored = new Set(["node_modules", ".npm-cache", ".git", "dist", "dist-client", "coverage", "storage"]);
const patterns = [
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,
  /Future@\d+/i,
  /(N8N_API_KEY|META_ACCESS_TOKEN|SMTP_PASSWORD|DATABASE_URL)=.+/i,
  /password\s*[:=]\s*["'][^"']{8,}["']/i,
  /api[_-]?key\s*[:=]\s*["'][^"']{12,}["']/i,
  /secret\s*[:=]\s*["'][^"']{12,}["']/i
];

let failed = false;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else scan(full);
  }
}

function scan(file) {
  const rel = path.relative(root, file);
  if (rel === ".env.example") return;
  const text = fs.readFileSync(file, "utf8");
  patterns.forEach((pattern) => {
    if (pattern.test(text)) {
      console.error(`Potential secret pattern in ${rel}: ${pattern}`);
      failed = true;
    }
  });
}

walk(root);
if (failed) process.exit(1);
console.log("Secret scan passed.");
