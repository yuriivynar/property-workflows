#!/usr/bin/env node
// Архітектурне правило «перевірка входу й ролі — у кожній дії» (ADR docs/decisions/0003-…; рубрика WS7, D):
//   1) кожна експортована async-функція в src/app/**/actions.ts викликає getClaims() або requireAdmin() /
//      currentUser() / requireUser() — напряму або через локальну функцію того самого файлу, яка це робить;
//      виняток — дії, що СТВОРЮЮТЬ сесію (вхід, активація за посиланням): src/app/login/, src/app/auth/;
//   2) жодного getSession( у src/ — для авторизації лише getClaims() (він перевіряє підпис JWT);
//   3) жодного src/middleware.ts — у Next.js 16 це src/proxy.ts, і proxy — лише UX, не захист.
// Без залежностей (Node 24). Код виходу: 0 — OK, 1 — порушення, 2 — немає теки src/.
// Використання: node scripts/check-actions-claims.mjs [--root <тека>]
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const root = path.resolve(rootIndex >= 0 && args[rootIndex + 1] ? args[rootIndex + 1] : process.cwd());
const src = path.join(root, "src");

if (!existsSync(src)) {
  console.error(`check-actions-claims: немає теки ${src}`);
  process.exit(2);
}

const CHECKS = ["getClaims(", "requireAdmin(", "currentUser(", "requireUser("];
const EXEMPT = [path.join("src", "app", "login") + path.sep, path.join("src", "app", "auth") + path.sep];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

/** Код без коментарів і рядкових літералів (щоб «getClaims(» у коментарі не рахувався). */
function stripNoise(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\.|[^'\\\n])*'/g, "''");
}

/** Тіла функцій файлу: { name, exported, body }. Тіло — від першої «{» після сигнатури до парної «}». */
function functionsOf(code) {
  const result = [];
  const re = /(export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(/g;
  let match;
  while ((match = re.exec(code))) {
    let i = code.indexOf("{", re.lastIndex);
    // пропускаємо «{» у типах параметрів: шукаємо «)» сигнатури, потім першу «{» тіла
    let depth = 1;
    let j = re.lastIndex;
    while (j < code.length && depth > 0) {
      if (code[j] === "(") depth++;
      else if (code[j] === ")") depth--;
      j++;
    }
    i = code.indexOf("{", j);
    if (i < 0) continue;
    let braces = 0;
    let k = i;
    for (; k < code.length; k++) {
      if (code[k] === "{") braces++;
      else if (code[k] === "}" && --braces === 0) break;
    }
    result.push({ name: match[2], exported: Boolean(match[1]), body: code.slice(i, k + 1) });
  }
  return result;
}

const violations = [];
const files = walk(src);

for (const file of files) {
  const rel = path.relative(root, file);
  const code = stripNoise(readFileSync(file, "utf8"));

  if (code.includes("getSession(")) {
    violations.push(`${rel}  [no-getSession]  getSession( — для авторизації лише getClaims()`);
  }

  if (path.basename(file) !== "actions.ts" || EXEMPT.some((prefix) => rel.startsWith(prefix))) continue;

  const fns = functionsOf(code);
  const direct = new Set(fns.filter((f) => CHECKS.some((c) => f.body.includes(c))).map((f) => f.name));
  // Локальна функція рахується, якщо вона сама перевіряє (один рівень достатньо для наших хелперів).
  const checks = (f) => direct.has(f.name) || [...direct].some((name) => f.body.includes(`${name}(`));

  for (const fn of fns.filter((f) => f.exported)) {
    if (!checks(fn)) {
      violations.push(
        `${rel}  [action-claims]  ${fn.name}() — немає getClaims() / requireAdmin() / currentUser() до запису`,
      );
    }
  }
}

if (existsSync(path.join(src, "middleware.ts"))) {
  violations.push("src/middleware.ts  [no-middleware]  у Next.js 16 — src/proxy.ts; proxy — лише UX, не захист");
}

if (violations.length) {
  for (const v of violations) console.error(v);
  console.error(`\ncheck-actions-claims: ${violations.length} порушень. Правило — docs/decisions/0003-authz-in-actions-and-database.md.`);
  process.exit(1);
}
const actions = files.filter((f) => path.basename(f) === "actions.ts").length;
console.log(`check-actions-claims: OK — ${actions} файлів actions.ts, кожна дія перевіряє вхід і роль; getSession() і middleware.ts немає.`);
