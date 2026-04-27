#!/usr/bin/env node
// Codemod: replace inline `interface SessionUser` blocks with import from
// "@/lib/auth-types". Files claiming `branchId: string` non-null get
// BranchedSessionUser (which adds non-null branchId+branchName); rest get
// the canonical SessionUser.
//
// Usage:
//   node scripts/codemod-session-user.mjs            # apply changes
//   node scripts/codemod-session-user.mjs --dry-run  # preview only

import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { exec as execCb } from "node:child_process";

const exec = promisify(execCb);
const DRY_RUN = process.argv.includes("--dry-run");

const ROOT = process.cwd();
const SKIP_FILES = new Set([
  "src/lib/auth-types.ts",        // canonical lives here
  "src/lib/transferencias.ts",    // exports its own SessionUser variant — separate beast
]);

// Match `[export] interface SessionUser { ... }` block + trailing newline(s).
// Non-greedy body, multiline.
const INTERFACE_RE = /^(export\s+)?interface\s+SessionUser\s*\{[\s\S]*?\n\}\n?\n?/m;

// Detect branched shape: any line `branchId: string;` (no `| null`)
const BRANCHED_RE = /^\s*branchId:\s*string;\s*$/m;

async function listCandidateFiles() {
  // Use git ls-files to scope to tracked .ts/.tsx in src/
  const { stdout } = await exec("git ls-files src", { cwd: ROOT, maxBuffer: 4 * 1024 * 1024 });
  return stdout
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p && (p.endsWith(".ts") || p.endsWith(".tsx")))
    .filter((p) => !SKIP_FILES.has(p));
}

function classify(blockText) {
  return BRANCHED_RE.test(blockText) ? "branched" : "canonical";
}

function alreadyImports(content, identifier) {
  const re = new RegExp(`from ["']@/lib/auth-types["']`);
  if (!re.test(content)) return false;
  const importRe = new RegExp(
    `import\\s+(?:type\\s+)?\\{[^}]*\\b${identifier}\\b[^}]*\\}\\s+from\\s+["']@/lib/auth-types["']`,
  );
  return importRe.test(content);
}

function insertImport(content, identifier) {
  if (alreadyImports(content, identifier)) return content;
  // Prepend at line 1. TS doesn't care about import order, and prepending is
  // robust against multi-line imports (`import { a,\n  b,\n} from "x"`) that
  // would otherwise need AST-level handling.
  return `import type { ${identifier} } from "@/lib/auth-types";\n${content}`;
}

function rewriteUsages(content, fromName, toName) {
  // Replace standalone identifier occurrences only (avoid SessionUserXXX).
  const re = new RegExp(`\\b${fromName}\\b`, "g");
  return content.replace(re, toName);
}

async function processFile(file) {
  const abs = `${ROOT}/${file}`;
  let content;
  try {
    content = await readFile(abs, "utf-8");
  } catch {
    return null;
  }
  const match = content.match(INTERFACE_RE);
  if (!match) return null;

  const block = match[0];
  const kind = classify(block);
  const target = kind === "branched" ? "BranchedSessionUser" : "SessionUser";

  let next = content.replace(INTERFACE_RE, "");
  if (target === "BranchedSessionUser") {
    next = rewriteUsages(next, "SessionUser", "BranchedSessionUser");
  }
  next = insertImport(next, target);

  // Tidy: collapse 3+ consecutive blank lines down to 2 (handles CRLF + LF)
  next = next.replace(/(\r?\n){3,}/g, (m) => (m.includes("\r") ? "\r\n\r\n" : "\n\n"));

  if (next === content) return { file, kind, changed: false };

  if (!DRY_RUN) {
    await writeFile(abs, next, "utf-8");
  }
  return { file, kind, changed: true };
}

async function main() {
  const files = await listCandidateFiles();
  const results = [];
  for (const f of files) {
    const r = await processFile(f);
    if (r) results.push(r);
  }

  const canonical = results.filter((r) => r.kind === "canonical");
  const branched = results.filter((r) => r.kind === "branched");

  console.log(`mode:           ${DRY_RUN ? "DRY-RUN" : "APPLY"}`);
  console.log(`total matches:  ${results.length}`);
  console.log(`  canonical:    ${canonical.length}`);
  console.log(`  branched:     ${branched.length}`);
  console.log("");
  console.log("--- canonical (use SessionUser) ---");
  canonical.forEach((r) => console.log(r.file));
  console.log("");
  console.log("--- branched (use BranchedSessionUser) ---");
  branched.forEach((r) => console.log(r.file));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
