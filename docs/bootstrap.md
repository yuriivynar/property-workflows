# Чекліст розробника, день 0

<!--
Заповнюєте ви одразу після заняття, у цьому порядку: власне репо, власні Supabase і Vercel, перший зелений CI, ruleset.
Мета — застосунок працює локально й на вашому прод-URL, міграції в базу застосовує лише CI, а в main усе йде через PR.
Для кожного пункту — доказ: посилання (run CI, PR, preview), назва змінної або знімок екрана в docs/img/
(без справжніх назв клієнта й людей: зображення spec:check не перевіряє).
ЗНАЧЕННЯ СЕКРЕТІВ І ПАРОЛІВ НІКОЛИ НЕ ПИШІТЬ — лише назви змінних і де вони задані.
Заповнений файл (розділи 1–6) — ваш перший PR, тип «Реалізація» (розділ 7): він же перевіряє ruleset. Посилання на сам
цей PR і на preview допишіть наступним PR. Пояснення кроків — README, «Шлях розробника».
Docker не потрібен: локально — лише npm run dev проти вашої бази; міграції на одноразовій базі перевіряє CI (db-check).
-->

Моє репо: https://github.com/yuriivynar/property-workflows · Прод-URL: https://property-workflows-eta.vercel.app
Репо вимог PM: https://github.com/solomchaak/property-workflows-spec · Організація Supabase: `property-workflows` (Free)

## 1. Інструменти й репо

- [x] Node 24 (`node -v`), Git, GitHub CLI (`gh auth status`); OpenSpec CLI глобально тієї ж версії, що в `package.json`:
      `npm i -g @fission-ai/openspec@1.14.1` → `openspec --version` = `1.14.1` — Node `v24.12.0`, Git `2.54.0`,
      gh `2.100.0` (вхід виконано), OpenSpec `1.14.1`, телеметрію OpenSpec вимкнено
- [x] Репо створено з шаблону (**Use this template → Create a new repository**): власник — ваш особистий акаунт, назва —
      `<team-slug>`, **Public** (ruleset на GitHub Free діє лише в публічних репо; PM у нотатці-порівнянні посилається на
      рядки вашого коду) — https://github.com/yuriivynar/property-workflows (generated from
      `koldovsky/2026-quitcode-06-project-template`, публічне)
- [x] `git clone https://github.com/<dev>/<team-slug>.git` → `npm ci` → `cp .env.example .env.local`
      (у PowerShell: `Copy-Item .env.example .env.local`) — клон у `D:\property-workflows`; `.env.local` ігнорується git
      (`git check-ignore -v .env.local` → `.gitignore:34:.env*`)
- [x] CodeRabbit (GitHub App) встановлено на це репо (github.com/apps/coderabbitai → Configure → Only select repositories) —
      лише репо `property-workflows`; доказ — рев'ю CodeRabbit у цьому PR
- [ ] (Якщо PM надіслав список справжніх назв клієнта особистим повідомленням) — локальний `product/denylist.local.txt`
      (у `.gitignore`; `npm run spec:check` читає його й значень не друкує) — не застосовно: PM списку не надсилав
      (лише посилання на репо вимог)

## 2. Supabase: власна база

- [x] Організацію й проєкт створено у вашому акаунті (один із двох безкоштовних проєктів; регіон — найближчий) —
      організація `property-workflows` (Free), регіон Central EU (Frankfurt)
- [x] Authentication: «Allow new users to sign up» **вимкнено**, «Confirm email» **вимкнено**
      (точні назви й місце перемикачів перевірте в інтерфейсі) — обидва перемикачі на одному знімку:
      [docs/img/auth-signups.png](img/auth-signups.png)
- [x] (Після розділу 4, коли є прод-URL) Authentication → URL Configuration: Site URL = прод-URL Vercel; Redirect URLs
      `http://localhost:3000/**`, `https://*-<slug>.vercel.app/**` — Site URL `https://property-workflows-eta.vercel.app/`;
      Redirect URLs `http://localhost:3000/**`, `https://*-yvynar-8355.vercel.app/**` — [docs/img/url-config.png](img/url-config.png)
- [x] `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
      (Project Settings → API Keys; точну назву розділу перевірте в інтерфейсі) і `DEMO_USER_PASSWORD` (≥ 8 символів).
      Значення не комітимо й не вставляємо в чат — задано лише локально; у git і в чаті значень немає

## 3. GitHub: environment `production` і секрети

- [x] Settings → Environments → `production` (якщо перший прогін CI вже створив його автоматично — відкрийте наявний;
      `Production`, яке створює Vercel для своїх деплоїв, — те саме середовище: регістр у назвах GitHub не розрізняє):
      **Deployment branches** = Selected branches → `main` — середовище створив перший прогін CI; перевірка:
      `gh api repos/yuriivynar/property-workflows/environments/production/deployment-branch-policies` → лише `main` (branch)
- [x] Секрет environment `SUPABASE_DB_URL` = рядок **Session pooler** (порт **5432**, не 6543) з Supabase → **Connect**;
      пароль у рядку percent-encoded — `SUPABASE_DB_URL` в environment `production`
      (`gh secret list --env production`); секретів репозиторію немає (`gh secret list` порожній)
- [ ] Запасний шлях (лише якщо `--db-url` не працює): секрети environment `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`,
      `SUPABASE_PROJECT_ID` (README, «Міграції в прод: запасний шлях») — не потрібно: `db-deploy` працює через `--db-url`
- [ ] (Необов'язково) секрет репо `SPEC_DENYLIST` — ті самі справжні назви через кому, для CI — не задано: PM списку не надсилав

## 4. Vercel

- [x] Add New → Project → імпорт вашого репо, Node 24.x — проєкт `property-workflows`, прод-URL
      https://property-workflows-eta.vercel.app
- [x] Змінні Production і Preview — лише `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
      `SUPABASE_SECRET_KEY` — **ніколи** — рівно ці дві змінні, обидві для Production і Preview, тип Config (значення
      публічні за задумом: потрапляють у JS-бандл); `SUPABASE_SECRET_KEY` у Vercel немає; без Marketplace-інтеграції Supabase
- [x] Settings → Deployment Protection → **Require Log In** вимкнено → Save (інакше PM і викладач не відкриють ваші preview;
      точну назву перемикача перевірте в інтерфейсі) — [docs/img/require-login.png](img/require-login.png)
- [x] Після змінних — редеплой; прод-URL відкривається — https://property-workflows-eta.vercel.app/login
      (вхід як `admin@example.test`: [docs/img/prod-login.png](img/prod-login.png))

## 5. База й перший зелений CI

- [x] Actions → CI → **Run workflow** (гілка `main`, `include_seed` ✓) → job `db-deploy` застосував першу міграцію й сид —
      https://github.com/yuriivynar/property-workflows/actions/runs/39328874597 (у лозі `db-deploy`:
      `Applying migration 20261012000000_profiles_and_roles.sql...`, `Seeding data from supabase/seed.sql...`);
      `include_seed` більше не вмикаємо
- [x] `npm run users:demo` (синтетичні користувачі з `supabase/demo-users.json`) → `npm run dev` → `http://localhost:3000` →
      вхід як `admin@example.test` працює локально й на прод-URL — прод: [docs/img/prod-login.png](img/prod-login.png)
- [x] CI на `main` зелений: `spec`, `app`, `conformance`, `db-check`, `db-deploy` —
      https://github.com/yuriivynar/property-workflows/actions/runs/39320850914 (перший прогін, push) і
      https://github.com/yuriivynar/property-workflows/actions/runs/39328874597 (з `include_seed`)

## 6. Ruleset `solo-main` (лише після зеленого CI на `main`)

- [x] Settings → Rules → Rulesets → **New ruleset → Import a ruleset** → `solo-main.json` з курсового репо
      (`materials/rulesets/solo-main.json`) або вручну: target — гілка за замовчуванням (`main`); Restrict deletions;
      Block force pushes; Require a pull request — **0 approvals** (колег у вашому репо немає); Require status checks
      (джерело GitHub Actions, без «up to date»): `spec`, `app`, `conformance`, `db-check`; Allowed merge methods —
      **Squash** і **Merge**; Bypass list — **порожній** (навіть для власника); Enforcement — Active
      (точні назви полів перевірте в інтерфейсі) — створено з `solo-main.json` через
      `gh api repos/yuriivynar/property-workflows/rulesets --method POST`; [docs/img/ruleset.png](img/ruleset.png);
      `gh api repos/yuriivynar/property-workflows/rules/branches/main` → `deletion`, `non_fast_forward`,
      `pull_request` (0 approvals, squash і merge), `required_status_checks` (`spec`, `app`, `conformance`, `db-check`)

## 7. Перший PR (перевірка ruleset-у)

- [x] `git switch -c setup/bootstrap` → цей файл із доказами розділів 1–6 → push → `gh pr create --web` (тип «Реалізація»)
      → окремим коментарем `@coderabbitai review` — https://github.com/yuriivynar/property-workflows/pull/1
      (рев'ю: https://github.com/yuriivynar/property-workflows/pull/1#issuecomment-6285120474; PR створено `gh pr create`
      з тілом за шаблоном замість `--web`)
- [x] Поки перевірки не зелені, кнопка merge заблокована; push у `main` напряму відхиляється — поки `spec`, `app`,
      `conformance`, `db-check` PR #1 були в черзі, `gh pr view 1 --json mergeStateStatus` → `BLOCKED`, після них —
      `CLEAN`. Push голови PR #1 (`c516add`) у `main` після зелених перевірок ruleset пропустив як злиття PR #1 (rule
      suite `pass`: коміт уже був у PR, що виконав усі правила) — це записано в описі PR #1; коміт поза таким PR
      правило `pull_request` не пропускає
- [x] Vercel створив preview для PR — https://property-workflows-git-setup-bootstrap-yvynar-8355.vercel.app/login
      (відкривається без входу у Vercel)
- [x] **Squash and merge** → прод-деплой Vercel пройшов — PR #1 злито як fast-forward (див. пункт вище), наступні PR —
      Squash and merge, напр. https://github.com/yuriivynar/property-workflows/pull/2; після кожного merge статус Vercel
      на коміті `main` — `success`, https://property-workflows-eta.vercel.app/login відкривається
- [x] (З першою задачею, що має міграцію) `db-check` зелений, після merge `db-deploy` застосував її у вашу базу — PR #5
      (https://github.com/yuriivynar/property-workflows/pull/5): `db-check`
      https://github.com/yuriivynar/property-workflows/actions/runs/39421510002/job/118623330644; після merge `db-deploy`
      https://github.com/yuriivynar/property-workflows/actions/runs/39422164120 — у лозі `Applying migration
      20261020115700_roles_manager_admin.sql`, `…_workflow_runs.sql`, `…_workflow_templates_reference_data.sql`

## 8. Вимоги PM і специфікація

- [ ] Адресу репо вимог PM узято з чату команди; на зустрічі команди (дні 0–2, до кінця 15.10, організує PM; якщо
      команда не зібралася — діра в чат команди до обіду 16.10) — перший раунд питань до брифу
- [ ] PM написав у чаті команди «вимоги оновлено» (у курсі перші вимоги — до кінця 16.10) → у Claude Code чи Cursor
      `/requirements-sync <pm>/<team-slug>-spec` → PR «Оновлення вимог» злито; шапка `docs/conformance.md` показує
      адресу, джерело (issues чи docs) і дату знімка — <!-- посилання на PR -->
- [ ] Читання вимог: скіл `spec-clarify` → питання — issues «Питання до вимог» у репо PM через вебформу → журнал
      `docs/spec-reading.md` — <!-- посилання на issues -->
- [ ] Переклад у специфікацію (гілка `spec/add-<зріз>`): `/opsx:propose add-<зріз>` → `npx openspec validate add-<зріз> --strict`
      → скіл `spec-review` → `npx openspec archive add-<зріз> -y` → `/conformance` → PR «Специфікація» злито;
      `npm run ac:coverage` без «вимогу PM ще не перекладено» — <!-- посилання на PR -->
